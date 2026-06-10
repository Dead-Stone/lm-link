import { FlashList, FlashListRef } from "@shopify/flash-list";
import React, { memo, useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MessageBubble from "../MessageBubble";
import TypingIndicator from "../TypingIndicator";
import { StreamingMessageStats } from "../../lib/message-stats";
import { isChatMessage, Message } from "../../lib/types";

export type ChatMessageRowProps = {
  message: Message;
  onRetryUser: (id: string) => void;
  onRetryAssistant: (id: string) => void;
  onCopy: (content: string) => void;
  onEdit: (id: string) => void;
};

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  onRetryUser,
  onRetryAssistant,
  onCopy,
  onEdit,
}: ChatMessageRowProps) {
  if (!isChatMessage(message)) {
    return <MessageBubble message={message} />;
  }
  if (message.role === "user") {
    return (
      <MessageBubble
        message={message}
        onRetry={() => onRetryUser(message.id)}
        onCopy={() => onCopy(message.content)}
        onEdit={() => onEdit(message.id)}
      />
    );
  }
  return (
    <MessageBubble
      message={message}
      onCopy={() => onCopy(message.content)}
      onRetry={() => onRetryAssistant(message.id)}
    />
  );
});

type Props = {
  messages: Message[];
  streamingContent: string;
  showTypingIndicator: boolean;
  streamingStats?: StreamingMessageStats | null;
  bottomInset?: number;
  onContentSizeChange?: () => void;
  listRef: React.RefObject<FlashListRef<Message> | null>;
  onRetryUser: (id: string) => void;
  onRetryAssistant: (id: string) => void;
  onCopy: (content: string) => void;
  onEdit: (id: string) => void;
};

function ChatMessagesList({
  messages,
  streamingContent,
  showTypingIndicator,
  streamingStats,
  bottomInset = 0,
  onContentSizeChange,
  listRef,
  onRetryUser,
  onRetryAssistant,
  onCopy,
  onEdit,
}: Props) {
  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <ChatMessageRow
        message={item}
        onRetryUser={onRetryUser}
        onRetryAssistant={onRetryAssistant}
        onCopy={onCopy}
        onEdit={onEdit}
      />
    ),
    [onCopy, onEdit, onRetryAssistant, onRetryUser]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <View style={styles.flex}>
      <FlashList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={onContentSizeChange}
        drawDistance={280}
        removeClippedSubviews={Platform.OS === "android"}
        ListFooterComponent={
          <>
            {streamingContent ? (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
                  createdAt: Date.now(),
                }}
                isStreaming
                streamingStats={streamingStats ?? undefined}
              />
            ) : null}
            {showTypingIndicator ? (
              <View style={styles.typingWrap}>
                <TypingIndicator />
              </View>
            ) : null}
            {bottomInset > 0 ? <View style={{ height: 16 + bottomInset }} /> : null}
          </>
        }
      />
    </View>
  );
}

export default memo(ChatMessagesList);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingVertical: 16,
    flexGrow: 0,
    justifyContent: "flex-start",
  },
  typingWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-start",
  },
});
