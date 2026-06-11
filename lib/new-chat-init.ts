import { getLocalModelByKey, isModelDownloaded } from "./local-models";
import { ChatModelMode, inferChatMode } from "./chat-mode";
import { Conversation, isChatMessage, Settings } from "./types";

export type NewChatModelTarget = {
  mode: ChatModelMode;
  remoteModelId?: string;
  localKey?: string;
};

export function defaultLocalModelKey(settingsKey: string | undefined): string | null {
  const info = getLocalModelByKey(settingsKey ?? null);
  if (!info || !isModelDownloaded(info.filename)) return null;
  return info.key;
}

export function findRecentlyUsedChatModel(
  conversations: Conversation[]
): NewChatModelTarget | null {
  const sorted = [...conversations]
    .filter(
      (c) =>
        !!c.localModelKey?.trim() ||
        !!c.model?.trim() ||
        c.messages.some((m) => m.type === "model_change")
    )
    .sort((a, b) => {
      const aHasChat = a.messages.some(isChatMessage);
      const bHasChat = b.messages.some(isChatMessage);
      if (aHasChat !== bHasChat) return aHasChat ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  for (const conv of sorted) {
    if (conv.localModelKey?.trim()) {
      return { mode: "local", localKey: conv.localModelKey.trim() };
    }
    if (conv.model?.trim()) {
      return { mode: "remote", remoteModelId: conv.model.trim() };
    }
    const { mode, localKey } = inferChatMode(conv);
    if (mode === "local" && localKey) {
      return { mode: "local", localKey };
    }
  }
  return null;
}

export function resolveNewChatModelTarget(
  conversations: Conversation[],
  settings: Settings
): NewChatModelTarget | null {
  const recent = findRecentlyUsedChatModel(conversations);
  if (recent) return recent;

  const fallbackLocal = defaultLocalModelKey(settings.defaultLocalModel);
  if (fallbackLocal) {
    return { mode: "local", localKey: fallbackLocal };
  }

  const fallbackRemote = settings.defaultModel?.trim();
  if (fallbackRemote) {
    return { mode: "remote", remoteModelId: fallbackRemote };
  }

  return null;
}
