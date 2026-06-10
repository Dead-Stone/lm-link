import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatImageFrame from "./ChatImageFrame";
import AssistantMessageMarkdown from "./AssistantMessageMarkdown";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import { SpeedStatRow } from "./ModelPicker";
import { useSettings } from "../lib/context";
import {
  formatMessageStatsLabel,
  formatStreamingStatsLabel,
  StreamingMessageStats,
} from "../lib/message-stats";
import { useSmoothStreamingText } from "../lib/use-smooth-streaming-text";
import { ChatColors, ThemeColors, useTheme } from "../lib/theme";
import { Message, MessageImage, ChatModelMode } from "../lib/types";

const blurProps =
  Platform.OS === "android"
    ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
    : {};

// ─── Blinking cursor ──────────────────────────────────────────────────────────

function BlinkingCursor() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[{ color: colors.primaryLight, fontSize: 16, fontWeight: "300", lineHeight: 22 }, { opacity }]}>|</Animated.Text>
  );
}

// ─── Image thumbnail row (user messages only) ─────────────────────────────────

function ImageThumbnails({ images, hasTextAbove }: { images: MessageImage[]; hasTextAbove?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const imgStyles = useMemo(() => createImgStyles(colors), [colors]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  const thumbSize = images.length === 1 ? { width: 220, height: 180 } : { width: 112, height: 112 };

  return (
    <>
      <View style={[imgStyles.row, !hasTextAbove && imgStyles.rowFlush]}>
        {images.map((img, idx) => (
          <ChatImageFrame
            key={idx}
            uri={img.uri}
            width={thumbSize.width}
            height={thumbSize.height}
            borderRadius={12}
            onPress={() => setSelectedUri(img.uri)}
          />
        ))}
      </View>

      <Modal
        visible={selectedUri !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setSelectedUri(null)}
      >
        <View style={imgStyles.modalBackdrop}>
          {selectedUri ? (
            <>
              <Image
                source={{ uri: selectedUri }}
                style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
                resizeMode="cover"
              />
              <BlurView
                intensity={80}
                tint="dark"
                style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]}
                {...blurProps}
              />
              <View style={[imgStyles.modalImageWrap, { zIndex: 2 }]} pointerEvents="box-none">
                <Image
                  source={{ uri: selectedUri }}
                  style={imgStyles.fullImage}
                  resizeMode="contain"
                />
              </View>
            </>
          ) : null}
          <Pressable
            style={[imgStyles.closeBtn, { top: insets.top + 12 }]}
            onPress={() => setSelectedUri(null)}
            hitSlop={12}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function createImgStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    rowFlush: { marginTop: 0 },
    modalBackdrop: {
      flex: 1,
      width: "100%",
      height: "100%",
    },
    modalImageWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 32,
    },
    fullImage: {
      width: "100%",
      height: "100%",
    },
    closeBtn: {
      position: "absolute",
      right: 16,
      zIndex: 20,
      elevation: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.92,
    },
  });
}

// ─── Model change divider (Claude-style) ─────────────────────────────────────

function ModelChangeDivider({ label, mode }: { label: string; mode?: ChatModelMode }) {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => createDividerStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.labelWrap}>
        {mode ? (
          <ModelModeBadgeIcon
            mode={mode}
            baseUrl={settings.baseUrl}
            label={label}
            size={14}
            color={colors.textDim}
          />
        ) : null}
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

function createDividerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 14,
      paddingHorizontal: 16,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
    labelWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: "62%",
      flexShrink: 1,
    },
    label: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "400",
      flexShrink: 1,
    },
  });
}

// ─── Message actions (copy / edit / retry) ────────────────────────────────────

function MessageActions({
  variant,
  onCopy,
  onEdit,
  onRetry,
  colors,
  style,
}: {
  variant: "user" | "assistant";
  onCopy?: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  colors: ThemeColors;
  style?: object;
}) {
  const actionStyles = useMemo(() => createActionStyles(colors), [colors]);
  const catalog = {
    copy: onCopy
      ? { key: "copy", icon: "copy-outline" as const, onPress: onCopy, label: "Copy" }
      : null,
    edit: onEdit
      ? { key: "edit", icon: "pencil-outline" as const, onPress: onEdit, label: "Edit" }
      : null,
    retry: onRetry
      ? { key: "retry", icon: "refresh-outline" as const, onPress: onRetry, label: "Retry" }
      : null,
  };
  const order =
    variant === "user"
      ? (["retry", "copy", "edit"] as const)
      : (["copy", "retry"] as const);
  const items = order.map((k) => catalog[k]).filter(Boolean) as Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label: string;
  }>;

  if (items.length === 0) return null;

  return (
    <View style={[actionStyles.row, style]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          hitSlop={6}
          accessibilityLabel={item.label}
          style={({ pressed }) => [actionStyles.btn, pressed && actionStyles.btnPressed]}
        >
          <Ionicons
            name={item.icon}
            size={variant === "user" ? 16 : 15}
            color={colors.textDim}
          />
        </Pressable>
      ))}
    </View>
  );
}

function createActionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      flexShrink: 0,
    },
    btn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPressed: {
      backgroundColor: colors.surfaceHover,
      opacity: 0.85,
    },
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  message: Message;
  isStreaming?: boolean;
  streamingStats?: StreamingMessageStats;
  onCopy?: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming, streamingStats, onCopy, onEdit, onRetry }: Props) {
  const { colors, chatColors } = useTheme();
  const styles = useMemo(
    () => createBubbleStyles(colors, chatColors),
    [colors, chatColors]
  );
  const streamingText = useSmoothStreamingText(message.content, !!isStreaming);

  if (message.type === "model_change") {
    return (
      <ModelChangeDivider
        label={message.modelLabel ?? message.content}
        mode={message.modelMode}
      />
    );
  }

  const isUser = message.role === "user";

  if (isUser) {
    const showUserActions = !isStreaming && (onCopy || onEdit || onRetry);
    return (
      <View style={styles.userRow}>
        <View style={styles.userCol}>
          <View style={styles.userBubble}>
            {message.content ? (
              <Text style={styles.userText}>{message.content}</Text>
            ) : null}
            {message.images && message.images.length > 0 ? (
              <ImageThumbnails images={message.images} hasTextAbove={!!message.content} />
            ) : null}
          </View>
          {showUserActions ? (
            <MessageActions
              variant="user"
              onCopy={onCopy}
              onEdit={onEdit}
              onRetry={onRetry}
              colors={colors}
              style={styles.userActions}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const statsLabel = isStreaming
    ? streamingStats
      ? formatStreamingStatsLabel(streamingStats)
      : null
    : message.stats
      ? formatMessageStatsLabel(message.stats)
      : null;

  const showActions = !isStreaming && !!(onCopy || onRetry);
  const showStats =
    !!statsLabel || (isStreaming && streamingStats !== undefined && streamingStats !== null);
  const displayStatsLabel = statsLabel ?? (isStreaming ? "…" : null);

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantColumn}>
        <View style={styles.assistantBubble}>
          {isStreaming || message.content ? (
            <AssistantMessageMarkdown
              content={isStreaming ? streamingText : message.content}
              isStreaming={isStreaming}
              colors={colors}
              cursor={isStreaming ? <BlinkingCursor /> : undefined}
            />
          ) : null}
        </View>
        {showActions || showStats ? (
          <View style={styles.messageFooter}>
            <View style={styles.footerDivider} />
            <View style={styles.footerRow}>
              {showStats && displayStatsLabel ? (
                <SpeedStatRow
                  text={displayStatsLabel}
                  colors={colors}
                  textStyle={styles.statsText}
                  style={styles.statsRow}
                />
              ) : null}
              {showActions ? (
                <MessageActions
                  variant="assistant"
                  onCopy={onCopy}
                  onRetry={onRetry}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(MessageBubble);

// ─── Styles ───────────────────────────────────────────────────────────────────

function createBubbleStyles(colors: ThemeColors, chat: ChatColors) {
  return StyleSheet.create({
    userRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    userCol: {
      maxWidth: "80%",
      alignItems: "flex-end",
    },
    userActions: {
      marginTop: 2,
      marginRight: 2,
    },
    userBubble: {
      backgroundColor: chat.userBubbleBg,
      borderRadius: 20,
      borderBottomRightRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    userText: {
      color: chat.userBubbleText,
      fontSize: 15,
      lineHeight: 22,
    },

    assistantRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    assistantColumn: {
      width: "100%",
      maxWidth: "92%",
      alignSelf: "flex-start",
      overflow: "hidden",
    },
    assistantBubble: {
      width: "100%",
      flexShrink: 1,
      overflow: "hidden",
      paddingHorizontal: 4,
      paddingVertical: 2,
      paddingBottom: 4,
      backgroundColor: "transparent",
    },
    messageFooter: {
      width: "100%",
      flexShrink: 0,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    footerDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      minHeight: 28,
    },
    statsRow: {
      flexShrink: 1,
      minWidth: 0,
    },
    statsText: {
      color: colors.textDim,
      fontSize: 12,
    },
  });
}
