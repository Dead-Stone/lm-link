import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { createModalTheme } from "../lib/modal-theme";
import { getSettingsPalette, useTheme } from "../lib/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ThemedConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const { colors: baseColors, isDark } = useTheme();
  const colors = useMemo(
    () => getSettingsPalette(baseColors, isDark),
    [baseColors, isDark]
  );
  const styles = useMemo(() => createModalTheme(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dialogIcon}>
            <Ionicons
              name={destructive ? "trash-outline" : "help-circle-outline"}
              size={28}
              color={destructive ? colors.error : colors.textMuted}
            />
          </View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogMessage}>{message}</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.72 }]}
              onPress={onCancel}
            >
              <Text style={styles.secondaryBtnText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                destructive ? styles.destructiveBtn : styles.primaryBtn,
                pressed && { opacity: 0.88 },
              ]}
              onPress={onConfirm}
            >
              <Text style={destructive ? styles.destructiveBtnText : styles.primaryBtnText}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
