import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { HfDownloadIssue } from "../lib/huggingface-gated";
import { createModalTheme } from "../lib/modal-theme";
import { getSettingsPalette, useTheme } from "../lib/theme";

type Props = {
  visible: boolean;
  issue: HfDownloadIssue | null;
  acceptLoading?: boolean;
  onAccept?: () => void;
  onOpenBrowser: () => void;
  onCancel: () => void;
};

function titleForIssue(issue: HfDownloadIssue): string {
  switch (issue.kind) {
    case "token_missing":
      return "Hugging Face token needed";
    case "token_invalid":
      return "Invalid Hugging Face token";
    case "access_pending":
      return "Access pending";
    case "acceptance_required":
      return "Model access required";
  }
}

export default function HfModelAccessDialog({
  visible,
  issue,
  acceptLoading = false,
  onAccept,
  onOpenBrowser,
  onCancel,
}: Props) {
  const { colors: baseColors, isDark } = useTheme();
  const colors = useMemo(
    () => getSettingsPalette(baseColors, isDark),
    [baseColors, isDark]
  );
  const styles = useMemo(() => createModalTheme(colors), [colors]);

  if (!issue) return null;

  const showAccept =
    issue.kind === "acceptance_required" && !!onAccept;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dialogIcon}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.dialogTitle}>{titleForIssue(issue)}</Text>
          <Text style={styles.dialogMessage}>{issue.message}</Text>
          <View style={{ gap: 8, marginTop: 4 }}>
            {showAccept ? (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
                onPress={onAccept}
                disabled={acceptLoading}
              >
                {acceptLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Accept & retry</Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.72 }]}
              onPress={onOpenBrowser}
            >
              <Text style={styles.secondaryBtnText}>Open on Hugging Face</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.72 }]}
              onPress={onCancel}
            >
              <Text style={styles.secondaryBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
