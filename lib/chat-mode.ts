import { LOCAL_MODEL_CATALOG } from "./local-models";
import { isSameModelId } from "./model-id";
import { Conversation, Message } from "./types";

export type ChatModelMode = "remote" | "local";

export function inferChatMode(conv: Conversation): { mode: ChatModelMode; localKey: string | null } {
  if (conv.localModelKey) {
    return { mode: "local", localKey: conv.localModelKey };
  }

  const lastMarker = [...conv.messages]
    .reverse()
    .find((m) => m.type === "model_change");

  if (lastMarker?.modelMode === "local") {
    const key =
      LOCAL_MODEL_CATALOG.find((m) => m.name === lastMarker.modelLabel)?.key ?? null;
    return { mode: "local", localKey: key };
  }

  if (lastMarker?.modelMode === "remote") {
    return { mode: "remote", localKey: null };
  }

  return { mode: "remote", localKey: null };
}

export function conversationUsesLocalModel(conv: Conversation, localKey: string): boolean {
  if (conv.localModelKey === localKey) return true;
  const { mode, localKey: inferredKey } = inferChatMode(conv);
  return mode === "local" && inferredKey === localKey;
}

export function conversationUsesRemoteModel(conv: Conversation, modelId: string): boolean {
  return !!conv.model && isSameModelId(conv.model, modelId);
}

export function appendModelChangeMarker(
  conversation: Conversation,
  label: string,
  mode: ChatModelMode,
  generateId: () => string
): Conversation {
  const lastMarker = [...conversation.messages]
    .reverse()
    .find((m) => m.type === "model_change");
  if (lastMarker?.modelLabel === label && lastMarker?.modelMode === mode) {
    return conversation;
  }
  const marker: Message = {
    id: generateId(),
    type: "model_change",
    role: "system",
    content: label,
    modelLabel: label,
    modelMode: mode,
    createdAt: Date.now(),
  };
  return {
    ...conversation,
    messages: [...conversation.messages, marker],
    updatedAt: Date.now(),
  };
}
