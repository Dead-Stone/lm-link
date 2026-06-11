import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ErrorKind, presentError } from "../lib/errors";
import { createModalTheme } from "../lib/modal-theme";
import { radii, spacing, ThemeColors, useTheme } from "../lib/theme";

export interface ThemedErrorProps {
  message: string | null;
  kind?: ErrorKind;
  title?: string;
  hint?: string;
  /** modal = overlay dialog, banner = dismissible strip, inline = compact row, panel = centered card */
  variant?: "modal" | "banner" | "inline" | "panel";
  visible?: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export default function ThemedError({
  message,
  kind,
  title: titleOverride,
  hint: hintOverride,
  variant = "banner",
  visible,
  onDismiss,
  onRetry,
  retryLabel = "Try again",
  actionIcon = "refresh",
  style,
}: ThemedErrorProps) {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const styles = useMemo(() => createThemedErrorStyles(colors), [colors]);

  if (!message) return null;

  const pres = presentError(message, kind);
  const title = titleOverride ?? pres.title;
  const hint = hintOverride ?? pres.hint;
  const icon = pres.icon;

  if (variant === "modal") {
    const show = visible ?? true;
    return (
      <Modal visible={show} transparent animationType="fade" onRequestClose={onDismiss}>
        <Pressable style={modalStyles.overlay} onPress={onDismiss}>
          <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
            <View style={modalStyles.dialogIcon}>
              <Ionicons name={icon} size={28} color={colors.error} />
            </View>
            <Text style={modalStyles.dialogTitle}>{title}</Text>
            <Text style={modalStyles.dialogMessage}>{message}</Text>
            {hint ? <Text style={modalStyles.dialogHint}>{hint}</Text> : null}
            <View style={modalStyles.actionRow}>
              <Pressable style={modalStyles.secondaryBtn} onPress={onDismiss}>
                <Text style={modalStyles.secondaryBtnText}>Dismiss</Text>
              </Pressable>
              {onRetry ? (
                <Pressable
                  style={[modalStyles.primaryBtn, { flexDirection: "row", gap: 6 }]}
                  onPress={onRetry}
                >
                  <Ionicons name={actionIcon} size={16} color="#fff" />
                  <Text style={modalStyles.primaryBtnText}>{retryLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (variant === "panel") {
    return (
      <View style={[styles.panel, style]}>
        <View style={styles.panelIcon}>
          <Ionicons name={icon} size={32} color={colors.textMuted} />
        </View>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelMessage}>{message}</Text>
        {hint ? <Text style={styles.panelHint}>{hint}</Text> : null}
        {onRetry ? (
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Ionicons name={actionIcon} size={15} color="#fff" />
            <Text style={styles.retryBtnText}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (variant === "inline") {
    return (
      <View style={[styles.inline, style]}>
        <Ionicons name={icon} size={16} color={colors.error} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.inlineTitle}>{title}</Text>
          <Text style={styles.inlineMessage}>{message}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.textDim} />
        </Pressable>
      </View>
    );
  }

  // banner (default)
  return (
    <Pressable style={[styles.banner, style]} onPress={onDismiss}>
      <View style={styles.bannerIcon}>
        <Ionicons name={icon} size={18} color={colors.error} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerMessage}>{message}</Text>
      </View>
      <Ionicons name="close" size={16} color={colors.textDim} />
    </Pressable>
  );
}

function createThemedErrorStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panelIcon: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
      alignSelf: "center",
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      paddingHorizontal: 20,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    retryBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },

    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.errorBg,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.errorBorder,
    },
    bannerIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      backgroundColor: colors.errorBg,
      alignItems: "center",
      justifyContent: "center",
    },
    bannerTitle: {
      color: colors.error,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 2,
    },
    bannerMessage: {
      color: colors.errorTextSoft,
      fontSize: 13,
      lineHeight: 18,
    },

    inline: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.errorBg,
      borderRadius: radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.errorBorder,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    inlineTitle: {
      color: colors.error,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 2,
    },
    inlineMessage: {
      color: colors.errorTextSoft,
      fontSize: 13,
      lineHeight: 18,
    },

    panel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
    },
    panelTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    panelMessage: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    panelHint: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
  });
}
