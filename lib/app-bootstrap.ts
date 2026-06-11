import { inferChatMode } from "./chat-mode";
import { defaultLocalModelKey, resolveNewChatModelTarget } from "./new-chat-init";
import { Conversation, isChatMessage, Settings } from "./types";

export function resolveStartupConversation(
  conversations: Conversation[],
  activeConversationId: string | null
): Conversation | null {
  const withMessages = conversations.filter((c) => c.messages.some(isChatMessage));
  if (
    activeConversationId &&
    withMessages.some((c) => c.id === activeConversationId)
  ) {
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  }
  if (withMessages.length > 0) {
    return withMessages[0];
  }
  return null;
}

/** On-device model to warm-load before the first chat screen mounts. */
export function resolveStartupLocalModelKey(
  conversations: Conversation[],
  settings: Settings,
  activeConversationId: string | null
): string | null {
  const startupConv = resolveStartupConversation(conversations, activeConversationId);
  if (startupConv) {
    const fromKey = startupConv.localModelKey?.trim();
    if (fromKey) return defaultLocalModelKey(fromKey);
    if (startupConv.model?.trim()) return null;
    const { mode, localKey } = inferChatMode(startupConv);
    if (mode === "local" && localKey) return defaultLocalModelKey(localKey);
    return null;
  }

  const target = resolveNewChatModelTarget(conversations, settings);
  if (target?.mode === "local" && target.localKey) {
    return defaultLocalModelKey(target.localKey);
  }
  return null;
}
