import { Conversation, Message } from "./types";

/** Drop in-memory base64 before writing to AsyncStorage. */
export function stripConversationForStorage(conv: Conversation): Conversation {
  return {
    ...conv,
    messages: conv.messages.map(stripMessageForStorage),
  };
}

function stripMessageForStorage(message: Message): Message {
  if (!message.images?.length) return message;
  return {
    ...message,
    images: message.images.map(({ uri, mimeType, filename }) => ({
      uri,
      mimeType,
      filename,
    })),
  };
}
