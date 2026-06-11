import { Ionicons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import NewChatIcon from "../NewChatIcon";
import { createScreenHeaderTitleStyle } from "../../lib/typography";
import { screenHeaderTopPadding } from "../../lib/safe-area-layout";
import { ThemeColors, useTheme } from "../../lib/theme";

type Props = {
  title: string;
  paddingTop: number;
  colors: ThemeColors;
  onOpenConversations: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  newChatDisabled?: boolean;
};

function ChatHeader({
  title,
  paddingTop,
  colors,
  onOpenConversations,
  onNewChat,
  onOpenSettings,
  newChatDisabled = false,
}: Props) {
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const titleStyle = createScreenHeaderTitleStyle(colors, "left");

  return (
    <View style={[styles.header, { paddingTop: screenHeaderTopPadding(paddingTop), zIndex: 2 }]}>
      <View style={styles.headerTop}>
        <View style={[styles.headerLeading, styles.headerIconChip]}>
          <Pressable
            onPress={onOpenConversations}
            style={({ pressed }) => [
              styles.headerLeadingBtn,
              pressed && styles.headerLeadingBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="Open chats"
          >
            <Ionicons name="chatbubbles-outline" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerLeadingDivider} />
          <Pressable
            onPress={onNewChat}
            disabled={newChatDisabled}
            style={({ pressed }) => [
              styles.headerLeadingBtn,
              newChatDisabled && styles.headerLeadingBtnDisabled,
              pressed && !newChatDisabled && styles.headerLeadingBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="New chat"
            accessibilityState={{ disabled: newChatDisabled }}
          >
            <NewChatIcon
              size={22}
              color={newChatDisabled ? colors.textDim : colors.primaryLight}
            />
          </Pressable>
        </View>

        <Text
          style={[titleStyle, styles.headerTitle]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>

        <View style={styles.headerActions}>
          <Pressable onPress={onOpenSettings} style={styles.headerIconBtn} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default memo(ChatHeader);

function createStyles(colors: ThemeColors, isDark: boolean) {
  const iconShadowOpacity = isDark ? 0.22 : 0.08;

  return StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.bg,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.03 : 0.015,
          shadowRadius: 1,
        },
        android: {
          elevation: 0,
        },
        default: {},
      }),
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 36,
      gap: 4,
    },
    headerLeading: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      overflow: "hidden",
    },
    headerLeadingBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerLeadingBtnPressed: {
      backgroundColor: colors.surfaceHover,
    },
    headerLeadingBtnDisabled: {
      opacity: 0.42,
    },
    headerLeadingDivider: {
      width: StyleSheet.hairlineWidth,
      height: 20,
      backgroundColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 8,
      paddingRight: 4,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIconChip: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: iconShadowOpacity,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
        default: {},
      }),
    },
  });
}
