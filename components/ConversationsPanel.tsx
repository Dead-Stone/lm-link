import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DismissAffordance from "./DismissAffordance";
import NewChatIcon from "./NewChatIcon";
import ThemedConfirmDialog from "./ThemedConfirmDialog";
import { useApp } from "../lib/context";
import { useHubNavigation } from "../lib/hub-navigation";
import { screenHeaderTopPadding } from "../lib/safe-area-layout";
import { createScreenHeaderTitleStyle } from "../lib/typography";
import { AccentColors, getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import { Conversation } from "../lib/types";

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day)
    return new Date(ts).toLocaleDateString("en-US", { weekday: "short" });
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationRow({
  item,
  isActive,
  onPress,
  onDelete,
}: {
  item: Conversation;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors, accent, isDark } = useTheme();
  const palette = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createListStyles(palette, accent), [palette, accent]);
  return (
    <SwipeToDeleteRow
      onDelete={onDelete}
      deleteReveal="left"
      backgroundColor={palette.bg}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          isActive && styles.rowActive,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
            {item.title}
          </Text>
          <Text style={styles.rowDate}>{formatDate(item.updatedAt)}</Text>
        </View>
      </Pressable>
    </SwipeToDeleteRow>
  );
}

const emptyChatsAnimation = require("../assets/4622bae4-1188-11ee-a0e0-2f7bad465cc0.json");

function getEmptyLottieColorFilters(isDark: boolean, palette: ThemeColors, accent: AccentColors) {
  const faceInk = isDark ? palette.lmCenter : accent.purple;
  const layers = ["Left Eye", "Right Eye", "Smile Lip"];
  return layers.flatMap((layer) => [
    { keypath: layer, color: faceInk },
    { keypath: `Smile_lottie.${layer}`, color: faceInk },
  ]);
}

function NewChatFooter({
  onPress,
  styles,
  iconColor,
  bottomInset = 0,
  showDeleteHint = false,
}: {
  onPress: () => void;
  styles: ReturnType<typeof createListStyles>;
  iconColor: string;
  bottomInset?: number;
  showDeleteHint?: boolean;
}) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <View style={[styles.listFooter, { paddingBottom: bottomInset + 8 }]}>
      {showDeleteHint ? (
        <Text style={styles.deleteHint}>Swipe right on a chat to delete</Text>
      ) : null}
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.newChatRow, pressed && styles.newChatRowPressed]}
        accessibilityRole="button"
        accessibilityLabel="New chat"
      >
        <NewChatIcon size={18} color={iconColor} />
        <Text style={styles.newChatRowLabel}>New chat</Text>
      </Pressable>
    </View>
  );
}

function EmptyConversations({
  onNewChat,
  styles,
  iconColor,
  bottomInset,
}: {
  onNewChat: () => void;
  styles: ReturnType<typeof createListStyles>;
  iconColor: string;
  bottomInset: number;
}) {
  const { colors, accent, isDark } = useTheme();
  const palette = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const emptyStyles = useMemo(() => createEmptyStyles(palette), [palette]);
  const lottieColorFilters = useMemo(
    () => getEmptyLottieColorFilters(isDark, palette, accent),
    [isDark, palette, accent]
  );

  return (
    <View style={emptyStyles.root}>
      <View style={emptyStyles.hero}>
        <LottieView
          source={emptyChatsAnimation}
          autoPlay
          loop
          style={emptyStyles.lottie}
          colorFilters={lottieColorFilters}
        />
        <Text style={emptyStyles.title}>No chats yet</Text>
        <Text style={emptyStyles.body}>
          Start a conversation with a model on your Mac or on-device.
        </Text>
      </View>

      <NewChatFooter
        onPress={onNewChat}
        styles={styles}
        iconColor={iconColor}
        bottomInset={bottomInset}
      />
    </View>
  );
}

export default function ConversationsPanel() {
  const router = useRouter();
  const { openChat } = useHubNavigation();
  const insets = useSafeAreaInsets();
  const { conversations, removeConversation, activeConversation } = useApp();
  const { colors, accent, isDark } = useTheme();
  const palette = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createListStyles(palette, accent), [palette, accent]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const openChatRoute = useCallback(
    (chatId: string) => {
      openChat();
      router.replace(`/chat/${chatId}` as `/chat/${string}`);
    },
    [openChat, router]
  );

  const openNewChat = useCallback(() => {
    openChat();
    router.replace("/chat/new");
  }, [openChat, router]);

  const handleDelete = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) removeConversation(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, removeConversation]);

  const handleNewChat = useCallback(() => {
    openNewChat();
  }, [openNewChat]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>Chats</Text>
        <DismissAffordance kind="right" colors={colors} onPress={openChat} />
      </View>

      {conversations.length === 0 ? (
        <EmptyConversations
          onNewChat={openNewChat}
          styles={styles}
          iconColor={colors.textMuted}
          bottomInset={insets.bottom}
        />
      ) : (
        <FlatList
          style={styles.list}
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              isActive={item.id === activeConversation?.id}
              onPress={() => openChatRoute(item.id)}
              onDelete={() => handleDelete(item.id, item.title)}
            />
          )}
          ListFooterComponent={
            <NewChatFooter
              onPress={handleNewChat}
              styles={styles}
              iconColor={colors.textMuted}
              bottomInset={insets.bottom}
              showDeleteHint
            />
          }
        />
      )}

      <ThemedConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Conversation"
        message={
          deleteTarget ? `Delete "${deleteTarget.title}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

function createListStyles(colors: ThemeColors, accent: AccentColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      justifyContent: "flex-start",
      backgroundColor: colors.bg,
    },
    header: {
      paddingBottom: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...createScreenHeaderTitleStyle(colors),
      flex: 1,
      paddingHorizontal: 4,
    },
    list: {
      flex: 1,
    },
    listContent: {
      flexGrow: 0,
      justifyContent: "flex-start",
      paddingBottom: 8,
    },
    listFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 6,
      paddingHorizontal: 16,
      gap: 4,
    },
    newChatRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceHover,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    newChatRowPressed: {
      backgroundColor: colors.border,
    },
    newChatRowLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: -0.15,
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: colors.bgElevated,
    },
    rowActive: {
      backgroundColor: accent.tabSelectedBg,
    },
    rowPressed: { backgroundColor: colors.surfaceHover },
    rowContent: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
      flex: 1,
      minWidth: 0,
    },
    rowDate: { color: colors.textDim, fontSize: 13, flexShrink: 0 },

    deleteHint: {
      color: colors.textDim,
      fontSize: 10,
      lineHeight: 13,
      textAlign: "center",
      paddingBottom: 2,
    },

    deleteAction: {
      backgroundColor: "#ef4444",
      width: 72,
    },
    deleteActionPressable: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}

function createEmptyStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "space-between",
    },
    hero: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      maxWidth: 320,
      alignSelf: "center",
      paddingHorizontal: 32,
    },
    lottie: {
      width: 136,
      height: 136,
      marginBottom: 26,
      backgroundColor: "transparent",
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "600",
      letterSpacing: -0.55,
      marginBottom: 8,
      textAlign: "center",
    },
    body: {
      color: colors.textDim,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      maxWidth: 268,
    },
  });
}
