import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { APP_DISPLAY_NAME } from "../lib/app-name";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import type { SetupGuideIllustrationId } from "./SetupGuideIllustrations";
import WifiScanRadar from "./WifiScanRadar";

type AppPreviewId =
  | "lm-link-scan"
  | "lm-link-connection"
  | "lm-link-save"
  | "lm-link-token"
  | "lm-link-chat";

type SettingsVariant = "scan" | "connection" | "save" | "token";

const SCAN_DEVICES = [{ url: "http://192.168.1.5:1234/v1", displayName: "My Mac" }];

function SettingsScreenChrome({
  children,
  styles,
  colors,
}: {
  children: React.ReactNode;
  styles: ReturnType<typeof createPreviewStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.screenHeader}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
        <Text style={styles.screenTitle}>Settings</Text>
        <View style={{ width: 16 }} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        {children}
      </View>
    </View>
  );
}

function SettingsConnectionPreview({
  variant,
  styles,
  colors,
}: {
  variant: SettingsVariant;
  styles: ReturnType<typeof createPreviewStyles>;
  colors: ThemeColors;
}) {
  const showAdvanced = variant === "token";
  const showTypedUrl = variant === "connection" || variant === "save" || variant === "token";
  const highlightString = variant === "connection" || variant === "save";
  const highlightActions = variant === "save";
  const connectionText = "http://192.168.1.5:1234/v1";

  return (
    <SettingsScreenChrome styles={styles} colors={colors}>
      <View style={styles.statusRow}>
        <View style={styles.statusIcon}>
          <Ionicons
            name="desktop-outline"
            size={14}
            color={highlightActions ? colors.primaryLight : colors.textMuted}
          />
        </View>
        <View style={styles.statusPlate}>
          <Text style={styles.statusTitle}>
            {highlightActions ? "Ready to save" : "Not connected"}
          </Text>
          <Text style={styles.statusSub}>
            {highlightActions ? "Test passed — tap Save" : "Enter a connection string"}
          </Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Name</Text>
        <View style={styles.fieldInput}>
          <Text style={styles.fieldValue}>My Mac</Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Connection string</Text>
        <View style={[styles.fieldPlate, highlightString && styles.fieldPlateHighlight]}>
          <View style={styles.fieldInput}>
            {showTypedUrl ? (
              <Text style={styles.fieldValueMono}>{connectionText}</Text>
            ) : (
              <Text style={styles.fieldPlaceholder}>http://192.168.1.x:1234/v1</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.optionsGroup}>
        <View style={[styles.optionRow, variant === "scan" && styles.optionRowHighlight]}>
          <Ionicons name="wifi-outline" size={15} color={colors.primaryLight} />
          <Text style={styles.optionLabel}>Scan local network</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textDim} />
        </View>

        <View style={[styles.optionRow, showAdvanced && styles.optionRowHighlight]}>
          <Ionicons name="key-outline" size={15} color={colors.textMuted} />
          <Text style={styles.optionLabel}>Advanced keys</Text>
          <Ionicons
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={13}
            color={colors.textDim}
          />
        </View>
      </View>

      {showAdvanced ? (
        <View style={[styles.advancedBlock, styles.advancedBlockHighlight]}>
          <Text style={styles.advancedHint}>
            API token for downloads and when authentication is enabled — LM Studio → Developer →
            Manage Tokens
          </Text>
          <View style={styles.fieldPlate}>
            <View style={styles.fieldInput}>
              <Text style={styles.fieldValueMono}>sk-lm-••••••••••••</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.actionRow, highlightActions && styles.actionRowHighlight]}>
        <View style={[styles.secondaryBtn, highlightActions && styles.secondaryBtnHighlight]}>
          <Ionicons
            name={highlightActions ? "checkmark-circle-outline" : "pulse-outline"}
            size={13}
            color={highlightActions ? colors.primaryLight : colors.text}
          />
          <Text style={styles.secondaryBtnText}>Test</Text>
        </View>
        <View style={[styles.primaryBtn, highlightActions && styles.primaryBtnHighlight]}>
          <Ionicons name="save-outline" size={13} color="#fff" />
          <Text style={styles.primaryBtnText}>Save</Text>
        </View>
      </View>
    </SettingsScreenChrome>
  );
}

function ScanNetworkPreview({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createPreviewStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.screenHeader}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
        <Text style={styles.screenTitle}>Settings</Text>
        <View style={{ width: 16 }} />
      </View>
      <Text style={styles.sectionTitle}>Connection</Text>
      <View style={[styles.optionRow, styles.optionRowHighlight]}>
        <Ionicons name="wifi-outline" size={15} color={colors.primaryLight} />
        <Text style={styles.optionLabel}>Scan local network</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.textDim} />
      </View>
      <View style={styles.scanSheet}>
        <View style={styles.scanSheetHeader}>
          <Text style={styles.scanSheetTitle}>Scan local network</Text>
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </View>
        <WifiScanRadar active size={132} colors={colors} devices={SCAN_DEVICES} />
        <View style={styles.scanResultPlate}>
          <View style={styles.scanResultRow}>
            <Ionicons name="desktop-outline" size={14} color={colors.primaryLight} />
            <Text style={styles.scanResultText}>My Mac · 192.168.1.5:1234</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.textDim} />
          </View>
        </View>
      </View>
    </View>
  );
}

function ChatPreview({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createPreviewStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.chatHeader}>
        <Ionicons name="chatbubbles-outline" size={15} color={colors.text} />
        <Text style={styles.chatHeaderTitle}>New Chat</Text>
        <Ionicons name="settings-outline" size={15} color={colors.text} />
      </View>
      <View style={styles.chatBody}>
        <View style={styles.chatBubbleUser}>
          <Text style={styles.chatBubbleUserText}>Summarize this for me</Text>
        </View>
        <View style={styles.chatBubbleAssistant}>
          <Text style={styles.chatBubbleAssistantText}>Sure — pick a model below.</Text>
        </View>
      </View>
      <View style={styles.chatComposer}>
        <View style={styles.chatInputRow}>
          <View style={styles.chatAttach}>
            <Ionicons name="add" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.chatInput}>
            <Text style={styles.fieldPlaceholder}>Message…</Text>
          </View>
          <View style={styles.chatSend}>
            <Ionicons name="arrow-up" size={14} color={colors.textMuted} />
          </View>
        </View>
        <View style={styles.chatMetaRow}>
          <View style={styles.chatModelPicker}>
            <View style={styles.chatModelPickerInner}>
              <Ionicons name="laptop-outline" size={11} color={colors.primaryLight} />
              <Text style={styles.chatModelName}>Qwen3 4B Instruct</Text>
              <Ionicons name="chevron-down" size={11} color={colors.primaryLight} />
            </View>
          </View>
          <Text style={styles.poweredBy}>Powered by LM Studio</Text>
        </View>
      </View>
    </View>
  );
}

export default function TutorialAppSpotlight({
  id,
  colors: colorsProp,
}: {
  id: AppPreviewId;
  colors: ThemeColors;
}) {
  const { colors: themeColors, isDark } = useTheme();
  const colors = useMemo(
    () => getSettingsPalette(colorsProp ?? themeColors, isDark),
    [colorsProp, themeColors, isDark]
  );
  const styles = useMemo(() => createPreviewStyles(colors, isDark), [colors, isDark]);

  let preview: React.ReactNode;
  if (id === "lm-link-chat") {
    preview = <ChatPreview styles={styles} colors={colors} />;
  } else if (id === "lm-link-scan") {
    preview = <ScanNetworkPreview styles={styles} colors={colors} />;
  } else {
    const variant: SettingsVariant =
      id === "lm-link-save" ? "save" : id === "lm-link-token" ? "token" : "connection";
    preview = (
      <SettingsConnectionPreview styles={styles} colors={colors} variant={variant} />
    );
  }

  return (
    <View style={styles.frame}>
      <Text style={styles.frameCaption}>{APP_DISPLAY_NAME}</Text>
      <View style={styles.previewWrap}>{preview}</View>
    </View>
  );
}

export function isTutorialAppSpotlightId(
  id: SetupGuideIllustrationId
): id is AppPreviewId {
  return (
    id === "lm-link-scan" ||
    id === "lm-link-connection" ||
    id === "lm-link-save" ||
    id === "lm-link-token" ||
    id === "lm-link-chat"
  );
}

function createPreviewStyles(colors: ThemeColors, isDark: boolean) {
  const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

  return StyleSheet.create({
    frame: {
      borderRadius: radii.lg,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    frameCaption: {
      textAlign: "center",
      color: colors.textDim,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    previewWrap: {
      height: 340,
      overflow: "hidden",
      backgroundColor: colors.bg,
    },
    scanSheet: {
      marginTop: 10,
      borderRadius: radii.lg,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 8,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.35 : 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    scanSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    scanSheetTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    scanResultPlate: {
      alignSelf: "stretch",
      padding: 8,
      borderRadius: radii.md,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    scanResultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    scanResultText: {
      flex: 1,
      color: colors.text,
      fontSize: 10,
      fontWeight: "600",
      fontFamily: mono,
    },
    screen: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 10,
    },
    screenHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    screenTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    section: { gap: 8 },
    sectionTitle: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    statusPlate: { flex: 1, gap: 2 },
    statusTitle: { color: colors.text, fontSize: 11, fontWeight: "600" },
    statusSub: { color: colors.textMuted, fontSize: 9 },
    fieldBlock: { gap: 4 },
    fieldLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "500" },
    fieldPlate: { alignSelf: "stretch" },
    fieldPlateHighlight: {
      padding: 8,
      borderRadius: radii.md,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    fieldInput: {
      paddingVertical: 2,
      paddingHorizontal: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    fieldPlaceholder: { color: colors.placeholder, fontSize: 10 },
    fieldValue: { color: colors.text, fontSize: 10, fontWeight: "500" },
    fieldValueMono: {
      color: colors.text,
      fontSize: 10,
      fontFamily: mono,
    },
    optionsGroup: { gap: 2 },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    optionRowHighlight: {
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    optionLabel: { flex: 1, color: colors.text, fontSize: 10, fontWeight: "500" },
    advancedBlock: { gap: 6, paddingTop: 2 },
    advancedBlockHighlight: {
      padding: 8,
      borderRadius: radii.md,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    advancedHint: { color: colors.textMuted, fontSize: 8, lineHeight: 11 },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 6,
      paddingTop: 4,
    },
    actionRowHighlight: {
      padding: 6,
      marginHorizontal: -6,
      borderRadius: radii.md,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryBtnHighlight: {
      borderColor: colors.primaryBorder,
    },
    secondaryBtnText: { color: colors.text, fontSize: 10, fontWeight: "600" },
    primaryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    primaryBtnHighlight: {
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    primaryBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 8,
    },
    chatHeaderTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
    chatBody: { flex: 1, gap: 8, paddingTop: 4 },
    chatBubbleUser: {
      alignSelf: "flex-end",
      maxWidth: "72%",
      padding: 8,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceHover : "#e6e6e6",
    },
    chatBubbleUserText: { color: colors.text, fontSize: 9, lineHeight: 12 },
    chatBubbleAssistant: {
      alignSelf: "flex-start",
      maxWidth: "78%",
      padding: 8,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    chatBubbleAssistantText: { color: colors.textMuted, fontSize: 9, lineHeight: 12 },
    chatComposer: {
      gap: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    chatInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    chatAttach: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? colors.input : "#ececec",
      alignItems: "center",
      justifyContent: "center",
    },
    chatInput: {
      flex: 1,
      minHeight: 28,
      borderRadius: 14,
      backgroundColor: isDark ? colors.input : "#ececec",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    chatSend: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? colors.surfaceHover : "#e0e0e0",
      alignItems: "center",
      justifyContent: "center",
    },
    chatMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    chatModelPicker: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    chatModelPickerInner: { flexDirection: "row", alignItems: "center", gap: 4 },
    chatModelName: { color: colors.primaryLight, fontSize: 9, fontWeight: "600" },
    poweredBy: { color: colors.textDim, fontSize: 8 },
  });
}
