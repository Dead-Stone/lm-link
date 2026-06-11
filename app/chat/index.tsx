import { Redirect } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useApp } from "../../lib/context";
import { useTheme } from "../../lib/theme";
import { isChatMessage } from "../../lib/types";

export default function ChatTabIndex() {
  const { conversations, activeConversation, isLoading } = useApp();
  const { colors } = useTheme();

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const withMessages = conversations.filter((c) => c.messages.some(isChatMessage));

  if (activeConversation && withMessages.some((c) => c.id === activeConversation.id)) {
    return <Redirect href={`/chat/${activeConversation.id}`} />;
  }

  if (withMessages.length > 0) {
    return <Redirect href={`/chat/${withMessages[0].id}`} />;
  }

  return <Redirect href="/chat/new" />;
}
