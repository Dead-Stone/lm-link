import { conversationUsesLocalModel, conversationUsesRemoteModel, ChatModelMode } from "./chat-mode";
import { Conversation, isChatMessage } from "./types";

export function findRecentChatForModel(
  conversations: Conversation[],
  mode: ChatModelMode,
  opts: { remoteModelId?: string; localKey?: string }
): Conversation | undefined {
  const matches =
    mode === "local"
      ? conversations.filter(
          (c) => !!opts.localKey && conversationUsesLocalModel(c, opts.localKey)
        )
      : conversations.filter(
          (c) =>
            !!opts.remoteModelId && conversationUsesRemoteModel(c, opts.remoteModelId)
        );
  if (matches.length === 0) return undefined;
  return [...matches].sort((a, b) => {
    const aHasChat = a.messages.some(isChatMessage);
    const bHasChat = b.messages.some(isChatMessage);
    if (aHasChat !== bHasChat) return aHasChat ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  })[0];
}

/** Route target when the current chat id no longer exists in storage. */
export function resolveChatRouteAfterMissingId(
  conversations: Conversation[],
  activeConversation: Conversation | null
): `/chat/${string}` {
  if (
    activeConversation &&
    conversations.some((c) => c.id === activeConversation.id)
  ) {
    return `/chat/${activeConversation.id}` as `/chat/${string}`;
  }
  const withMessages = conversations.filter((c) => c.messages.some(isChatMessage));
  if (withMessages.length > 0) {
    return `/chat/${withMessages[0].id}` as `/chat/${string}`;
  }
  return "/chat/new" as `/chat/${string}`;
}
