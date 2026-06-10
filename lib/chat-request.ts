import { buildVisionImageUrl, resolveImageBase64 } from "./image-attachments";
import { isSameModelId } from "./model-id";
import { isChatMessage, LMModel, Message, MessageImage } from "./types";

export type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ApiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | VisionContentPart[];
};

/** Models whose LM Studio Jinja templates reject the system role. */
const SYSTEM_ROLE_SUPPORTED_HINTS: RegExp[] = [
  /llama[-_]?3/i,
  /llama[-_]?4/i,
  /qwen/i,
  /gemma[-_]?2/i,
  /gemma[-_]?3/i,
  /deepseek/i,
  /nemotron/i,
  /mistral[-_]large/i,
  /mistral[-_]small/i,
  /ministral/i,
  /pixtral/i,
  /gpt[-_]?oss/i,
  /granite/i,
];

const SYSTEM_ROLE_UNSUPPORTED_HINTS: RegExp[] = [
  /mistralai\/mistral-7b/i,
  /mistral[-_]?7b/i,
  /mixtral/i,
  /zephyr/i,
  /phi[-_]?3/i,
  /phi[-_]?4/i,
  /phi[-_]?2/i,
  /smollm/i,
  /vicuna/i,
  /wizardlm/i,
  /openhermes/i,
  /stablelm/i,
  /dolphin[-_]?/i,
  /codestral/i,
  /nous[-_]?hermes/i,
  /starling/i,
  /solar[-_]?10/i,
];

export function isSystemRoleUnsupportedError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /only user and assistant roles are supported/.test(m) ||
    /system role.*not supported/.test(m) ||
    /does not support.*system/.test(m) ||
    /error rendering prompt with jinja template/.test(m)
  );
}

export function modelSupportsSystemRole(
  modelId: string,
  catalog: Iterable<LMModel> = []
): boolean {
  const id = modelId.trim();
  if (!id) return true;

  for (const entry of catalog) {
    if (!isSameModelId(entry.id, id)) continue;
    const compat = `${entry.compatibility_type ?? ""} ${entry.format ?? ""}`.toLowerCase();
    if (
      compat.includes("no_system") ||
      compat.includes("system_as_user") ||
      compat.includes("system-as-user")
    ) {
      return false;
    }
    if (compat.includes("mistral") || compat === "llama-2") return false;
    break;
  }

  const key = id.toLowerCase();
  if (SYSTEM_ROLE_SUPPORTED_HINTS.some((pattern) => pattern.test(key))) return true;
  if (SYSTEM_ROLE_UNSUPPORTED_HINTS.some((pattern) => pattern.test(key))) return false;
  return true;
}

async function resolveMessageImages(message: Message): Promise<MessageImage[] | undefined> {
  if (!message.images?.length) return undefined;
  return Promise.all(
    message.images.map(async (img) => ({
      ...img,
      base64: await resolveImageBase64(img.uri, img.base64),
    }))
  );
}

async function buildUserContent(
  message: Message,
  supportsVision: boolean
): Promise<string | VisionContentPart[]> {
  if (!message.images?.length) {
    return message.content.trim() || " ";
  }

  if (!supportsVision) {
    return message.content.trim() || " ";
  }

  const parts: VisionContentPart[] = [
    { type: "text", text: message.content.trim() || "What do you see in this image?" },
  ];

  const images = await resolveMessageImages(message);
  for (const img of images ?? []) {
    try {
      if (!img.base64) continue;
      parts.push({
        type: "image_url",
        image_url: { url: buildVisionImageUrl(img.base64, img.mimeType) },
      });
    } catch {
      // skip unreadable attachment
    }
  }

  return parts.length > 1 ? parts : parts[0].type === "text" ? parts[0].text : " ";
}

function foldSystemIntoFirstUser(
  messages: ApiChatMessage[],
  systemPrompt: string
): ApiChatMessage[] {
  const prompt = systemPrompt.trim();
  if (!prompt) return messages;

  const folded = [...messages];
  const firstUserIdx = folded.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) {
    folded.unshift({ role: "user", content: prompt });
    return folded;
  }

  const first = folded[firstUserIdx];
  if (typeof first.content === "string") {
    folded[firstUserIdx] = {
      role: "user",
      content: `${prompt}\n\n${first.content}`.trim(),
    };
  } else {
    const textPart = first.content.find((p) => p.type === "text");
    const rest = first.content.filter((p) => p.type !== "text");
    const userText = textPart?.type === "text" ? textPart.text : "";
    folded[firstUserIdx] = {
      role: "user",
      content: [
        { type: "text", text: `${prompt}\n\n${userText}`.trim() },
        ...rest,
      ],
    };
  }

  return folded;
}

export async function buildChatApiMessages(options: {
  messages: Message[];
  systemPrompt?: string;
  modelId: string;
  catalog?: Iterable<LMModel>;
  supportsVision?: boolean;
  useSystemRole?: boolean;
}): Promise<ApiChatMessage[]> {
  const {
    messages,
    systemPrompt = "",
    modelId,
    catalog = [],
    supportsVision = true,
    useSystemRole = modelSupportsSystemRole(modelId, catalog),
  } = options;

  const chatRows = await Promise.all(
    messages
      .filter(isChatMessage)
      .map(async (m) => ({
        role: m.role,
        content: await buildUserContent(m, supportsVision),
      }))
  );

  const chatMessages: ApiChatMessage[] = chatRows.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  const prompt = systemPrompt.trim();
  if (!prompt) return chatMessages;

  if (useSystemRole) {
    return [{ role: "system", content: prompt }, ...chatMessages];
  }

  return foldSystemIntoFirstUser(chatMessages, prompt);
}

/** GGUF on-device inference — fold system prompt, never send a system role. */
export async function buildOnDeviceChatMessages(options: {
  messages: Message[];
  systemPrompt?: string;
  modelKey?: string | null;
  modelFilename?: string | null;
  modelName?: string | null;
}): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const modelId = [options.modelKey, options.modelFilename, options.modelName]
    .filter(Boolean)
    .join(" ");

  const apiMessages = await buildChatApiMessages({
    messages: options.messages,
    systemPrompt: options.systemPrompt,
    modelId,
    supportsVision: false,
    useSystemRole: false,
  });

  return apiMessages
    .filter((m): m is ApiChatMessage & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant"
    )
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.find((part) => part.type === "text")?.text ?? " ",
    }));
}
