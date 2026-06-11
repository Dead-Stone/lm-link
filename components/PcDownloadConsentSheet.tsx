import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { createModalTheme } from "../lib/modal-theme";
import { getSettingsPalette, useTheme } from "../lib/theme";

type Props = {
  visible: boolean;
  mode: "enable" | "manage";
  enabled?: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onClose: () => void;
};

const TERMS_POINTS = [
  {
    icon: "desktop-outline" as const,
    title: "Installs on your Mac or PC",
    body:
      "Downloads started from LM Link are sent to LM Studio on your connected computer. They do not install on this phone.",
  },
  {
    icon: "trash-outline" as const,
    title: "Delete only on the computer",
    body:
      "Models installed this way can only be removed in LM Studio on that Mac or PC. LM Link cannot delete Mac/PC models from your phone today.",
  },
  {
    icon: "arrow-forward-circle-outline" as const,
    title: "One-way from your phone",
    body:
      "Tapping Download starts an install on your computer. That action cannot be undone from this app — use LM Studio on the desktop to cancel or remove files.",
  },
  {
    icon: "wifi-outline" as const,
    title: "Local connection required",
    body:
      "Your phone must reach your Mac or PC over local Wi‑Fi (Settings → Connection → Local). Hub relay is for chat, not downloads.",
  },
  {
    icon: "document-text-outline" as const,
    title: "Licenses and disk space",
    body:
      "You are responsible for model licenses (including gated Hugging Face repos) and free disk space on the target machine.",
  },
];

export default function PcDownloadConsentSheet({
  visible,
  mode,
  enabled = false,
  onEnable,
  onDisable,
  onClose,
}: Props) {
  const { colors: baseColors, isDark } = useTheme();
  const colors = useMemo(
    () => getSettingsPalette(baseColors, isDark),
    [baseColors, isDark]
  );
  const styles = useMemo(() => createModalTheme(colors), [colors]);
  const stackedBtn = useMemo(
    () =>
      StyleSheet.create({
        primary: { ...styles.primaryBtn, flex: undefined, alignSelf: "stretch" as const },
        destructive: { ...styles.destructiveBtn, flex: undefined, alignSelf: "stretch" as const },
        secondary: { ...styles.secondaryBtn, flex: undefined, alignSelf: "stretch" as const },
      }),
    [styles]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, sheetStyles.card]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.dialogIcon}>
            <Ionicons name="cloud-download-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.dialogTitle}>Download to Mac or PC</Text>
          <Text style={[styles.dialogMessage, { marginBottom: 12 }]}>
            Read this before enabling download buttons for computer models in Model Library.
          </Text>

          <ScrollView
            style={sheetStyles.scroll}
            contentContainerStyle={sheetStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {TERMS_POINTS.map((point) => (
              <View key={point.title} style={{ flexDirection: "row", gap: 10 }}>
                <Ionicons name={point.icon} size={18} color={colors.primaryLight} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{point.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{point.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={sheetStyles.actions}>
            {mode === "enable" || !enabled ? (
              <Pressable
                style={({ pressed }) => [stackedBtn.primary, pressed && { opacity: 0.88 }]}
                onPress={onEnable}
              >
                <Text style={styles.primaryBtnText}>Enable Mac/PC downloads</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [stackedBtn.destructive, pressed && { opacity: 0.88 }]}
                onPress={onDisable}
              >
                <Text style={styles.destructiveBtnText}>Disable Mac/PC downloads</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [stackedBtn.secondary, pressed && { opacity: 0.72 }]}
              onPress={onClose}
            >
              <Text style={styles.secondaryBtnText}>
                {mode === "enable" ? "Not now" : "Close"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  card: {
    maxHeight: "88%",
    maxWidth: 400,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: "stretch",
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  actions: {
    gap: 8,
    marginTop: 16,
    alignSelf: "stretch",
  },
});
