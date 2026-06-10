import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { APP_DISPLAY_NAME } from "../lib/app-name";
import { radii, ThemeColors, useTheme } from "../lib/theme";
import TutorialAppSpotlight, { isTutorialAppSpotlightId } from "./TutorialAppSpotlight";
import { TutorialFrostedPlate } from "./TutorialMockText";

export type SetupGuideIllustrationId =
  | "lm-studio-load"
  | "lm-studio-developer"
  | "lm-studio-server"
  | "lm-studio-copy-url"
  | "lm-link-scan"
  | "lm-link-connection"
  | "lm-link-save"
  | "lm-link-token"
  | "lm-link-chat";

function IllustrationFrame({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createIllustrationStyles>;
}) {
  return (
    <View style={styles.frame}>
      <View style={styles.frameChrome}>
        <View style={styles.frameDots}>
          <View style={[styles.frameDot, { backgroundColor: "#ff5f57" }]} />
          <View style={[styles.frameDot, { backgroundColor: "#febc2e" }]} />
          <View style={[styles.frameDot, { backgroundColor: "#28c840" }]} />
        </View>
        <Text style={styles.frameLabel}>{label}</Text>
      </View>
      <View style={styles.frameBody}>{children}</View>
    </View>
  );
}

function LmStudioLoadMock({
  styles,
  isDark,
}: {
  styles: ReturnType<typeof createIllustrationStyles>;
  isDark: boolean;
}) {
  return (
    <>
      <View style={styles.mockSidebar}>
        <View style={[styles.mockSidebarItem, styles.mockSidebarItemActive]}>
          <Ionicons name="chatbubbles-outline" size={12} color="#c4b5fd" />
          <Text style={styles.mockSidebarTextActive}>Chat</Text>
        </View>
        <View style={styles.mockSidebarItem}>
          <Ionicons name="cube-outline" size={12} color="#6b7280" />
          <Text style={styles.mockSidebarText}>Models</Text>
        </View>
        <View style={styles.mockSidebarItem}>
          <Ionicons name="search-outline" size={12} color="#6b7280" />
          <Text style={styles.mockSidebarText}>Search</Text>
        </View>
      </View>
      <View style={styles.mockMain}>
        <TutorialFrostedPlate isDark={isDark} style={styles.mockTitlePlate}>
          <Text style={styles.mockTitle}>Chat · Pick a model</Text>
        </TutorialFrostedPlate>
        <View style={[styles.mockModelRow, styles.mockModelRowHighlight]}>
          <View style={styles.mockModelDot} />
          <Text style={styles.mockModelName}>Qwen3 4B Instruct</Text>
          <View style={styles.mockPill}>
            <Ionicons name="play" size={8} color="#c4b5fd" />
            <Text style={styles.mockPillText}>Load</Text>
          </View>
        </View>
        <View style={[styles.mockModelRow, styles.mockModelRowMuted]}>
          <View style={styles.mockModelDot} />
          <Text style={styles.mockModelName}>Mistral 7B</Text>
          <Text style={styles.mockModelMeta}>7B</Text>
        </View>
      </View>
    </>
  );
}

function LmStudioDeveloperMock({
  styles,
  isDark,
}: {
  styles: ReturnType<typeof createIllustrationStyles>;
  isDark: boolean;
}) {
  return (
    <>
      <View style={styles.mockSidebar}>
        <View style={styles.mockSidebarItem}>
          <Ionicons name="chatbubbles-outline" size={12} color="#6b7280" />
          <Text style={styles.mockSidebarText}>Chat</Text>
        </View>
        <View style={styles.mockSidebarItem}>
          <Ionicons name="cube-outline" size={12} color="#6b7280" />
          <Text style={styles.mockSidebarText}>Models</Text>
        </View>
        <View style={[styles.mockSidebarItem, styles.mockSidebarItemActive]}>
          <Ionicons name="swap-horizontal-outline" size={12} color="#c4b5fd" />
          <Text style={styles.mockSidebarTextActive}>Developer</Text>
        </View>
      </View>
      <View style={styles.mockMain}>
        <TutorialFrostedPlate isDark={isDark} style={styles.mockCalloutPlate}>
          <View style={styles.mockArrowCalloutInner}>
            <Ionicons name="arrow-back" size={12} color="#a78bfa" />
            <Text style={styles.mockHighlightText}>Tap the ↔ Developer icon</Text>
          </View>
        </TutorialFrostedPlate>
        <TutorialFrostedPlate isDark={isDark}>
          <Text style={styles.mockDimText}>Local Server settings appear here</Text>
        </TutorialFrostedPlate>
      </View>
    </>
  );
}

function LmStudioServerMock({
  styles,
  isDark,
}: {
  styles: ReturnType<typeof createIllustrationStyles>;
  isDark: boolean;
}) {
  return (
    <View style={styles.mockMainFull}>
      <TutorialFrostedPlate isDark={isDark} style={styles.mockTitlePlate}>
        <Text style={styles.mockTitle}>Developer · Local Server</Text>
      </TutorialFrostedPlate>
      <View style={styles.mockToggleGroup}>
        <View style={[styles.mockToggleRow, styles.mockToggleRowHighlight]}>
          <Text style={styles.mockToggleLabel}>Serve on Local Network</Text>
          <View style={styles.mockToggleOn}>
            <View style={styles.mockToggleKnob} />
          </View>
        </View>
        <View style={[styles.mockToggleRow, styles.mockToggleRowHighlight]}>
          <Text style={styles.mockToggleLabel} numberOfLines={2}>
            Allow network access (CORS)
          </Text>
          <View style={styles.mockToggleOn}>
            <View style={styles.mockToggleKnob} />
          </View>
        </View>
      </View>
      <View style={styles.mockStartBtn}>
        <Ionicons name="play-circle" size={14} color="#fff" />
        <Text style={styles.mockStartBtnText}>Start Server</Text>
      </View>
      <TutorialFrostedPlate isDark={isDark} style={styles.mockRunningPlate}>
        <View style={styles.mockRunningInner}>
          <View style={styles.mockStatusDot} />
          <Text style={styles.mockRunningText}>Running on port 1234</Text>
        </View>
      </TutorialFrostedPlate>
    </View>
  );
}

function LmStudioCopyUrlMock({
  styles,
  isDark,
}: {
  styles: ReturnType<typeof createIllustrationStyles>;
  isDark: boolean;
}) {
  return (
    <View style={styles.mockMainFull}>
      <TutorialFrostedPlate isDark={isDark} style={styles.mockTitlePlate}>
        <Text style={styles.mockTitle}>Developer · Network address</Text>
      </TutorialFrostedPlate>
      <TutorialFrostedPlate isDark={isDark} style={styles.mockUrlBoxHighlight}>
        <Text style={styles.mockUrlLabel}>Reachable at</Text>
        <View style={styles.mockUrlRow}>
          <Text style={styles.mockUrlValue}>http://192.168.1.5:1234</Text>
          <View style={styles.mockCopyBtn}>
            <Ionicons name="copy-outline" size={12} color="#c4b5fd" />
          </View>
        </View>
      </TutorialFrostedPlate>
      <TutorialFrostedPlate isDark={isDark} style={styles.mockSuffixPlate}>
        <View style={styles.mockSuffixCallout}>
          <Text style={styles.mockSuffixText}>In {APP_DISPLAY_NAME}, add </Text>
          <Text style={styles.mockSuffixBadge}>/v1</Text>
          <Text style={styles.mockSuffixText}> at the end</Text>
        </View>
      </TutorialFrostedPlate>
    </View>
  );
}

export default function SetupGuideIllustration({
  id,
  colors,
}: {
  id: SetupGuideIllustrationId;
  colors: ThemeColors;
}) {
  const { isDark } = useTheme();
  const styles = useMemo(() => createIllustrationStyles(colors, isDark), [colors, isDark]);

  if (isTutorialAppSpotlightId(id)) {
    return <TutorialAppSpotlight id={id} colors={colors} />;
  }

  const macLabels: Record<string, string> = {
    "lm-studio-load": "LM Studio · Load Model",
    "lm-studio-developer": "LM Studio · Open Developer",
    "lm-studio-server": "LM Studio · Start Server",
    "lm-studio-copy-url": "LM Studio · Copy Address",
  };

  return (
    <IllustrationFrame label={macLabels[id]} styles={styles}>
      {id === "lm-studio-load" ? (
        <LmStudioLoadMock styles={styles} isDark={isDark} />
      ) : null}
      {id === "lm-studio-developer" ? (
        <LmStudioDeveloperMock styles={styles} isDark={isDark} />
      ) : null}
      {id === "lm-studio-server" ? (
        <LmStudioServerMock styles={styles} isDark={isDark} />
      ) : null}
      {id === "lm-studio-copy-url" ? (
        <LmStudioCopyUrlMock styles={styles} isDark={isDark} />
      ) : null}
    </IllustrationFrame>
  );
}

function createIllustrationStyles(colors: ThemeColors, isDark: boolean) {
  const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
  const darkPanel = isDark ? "#1a1a22" : "#f3f4f6";
  const darkSurface = isDark ? "#121218" : "#e5e7eb";
  const darkText = isDark ? "#f3f4f6" : "#111827";
  const mutedText = isDark ? "#9ca3af" : "#6b7280";

  return StyleSheet.create({
    frame: {
      borderRadius: radii.md,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: darkSurface,
    },
    frameChrome: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: darkPanel,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    frameDots: { flexDirection: "row", gap: 5 },
    frameDot: { width: 8, height: 8, borderRadius: 4 },
    frameLabel: { color: mutedText, fontSize: 10, fontWeight: "600", flex: 1 },
    frameBody: {
      flexDirection: "row",
      minHeight: 128,
      backgroundColor: isDark ? "#0f0f14" : "#fafafa",
    },
    mockSidebar: {
      width: 72,
      paddingVertical: 8,
      paddingHorizontal: 6,
      gap: 4,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    mockSidebarItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderRadius: 6,
    },
    mockSidebarItemActive: { backgroundColor: "rgba(124, 58, 237, 0.18)" },
    mockSidebarText: { color: mutedText, fontSize: 9, fontWeight: "600" },
    mockSidebarTextActive: { color: "#a78bfa", fontSize: 9, fontWeight: "700" },
    mockMain: { flex: 1, padding: 10, gap: 8 },
    mockMainFull: { flex: 1, padding: 12, gap: 8 },
    mockTitlePlate: { alignSelf: "flex-start" },
    mockCalloutPlate: { alignSelf: "stretch" },
    mockTitle: { color: darkText, fontSize: 11, fontWeight: "700" },
    mockModelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 8,
      borderRadius: 8,
      backgroundColor: darkPanel,
    },
    mockModelRowHighlight: {
      borderWidth: 1,
      borderColor: "rgba(167, 139, 250, 0.45)",
    },
    mockModelRowMuted: { opacity: 0.55 },
    mockModelMeta: { color: mutedText, fontSize: 9, fontWeight: "600" },
    mockModelDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#a78bfa",
    },
    mockModelName: { color: darkText, fontSize: 10, fontWeight: "600", flex: 1 },
    mockPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: "rgba(124, 58, 237, 0.25)",
    },
    mockPillText: { color: "#c4b5fd", fontSize: 9, fontWeight: "700" },
    mockArrowCalloutInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    mockHighlightText: { color: "#c4b5fd", fontSize: 10, fontWeight: "600", flex: 1 },
    mockDimText: { color: mutedText, fontSize: 9, fontStyle: "italic" },
    mockStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
    mockToggleGroup: { gap: 4 },
    mockToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    mockToggleRowHighlight: {
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(167, 139, 250, 0.35)",
    },
    mockToggleLabel: { color: darkText, fontSize: 10, fontWeight: "600", flex: 1 },
    mockToggleOn: {
      width: 28,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#7c3aed",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    mockToggleKnob: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#fff",
      alignSelf: "flex-end",
    },
    mockStartBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#7c3aed",
      borderRadius: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
    },
    mockStartBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    mockRunningPlate: { alignSelf: "flex-start" },
    mockRunningInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    mockRunningText: { color: "#4ade80", fontSize: 10, fontWeight: "700" },
    mockUrlBoxHighlight: {
      gap: 4,
      borderWidth: 1,
      borderColor: "rgba(167, 139, 250, 0.55)",
    },
    mockUrlRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    mockUrlLabel: { color: mutedText, fontSize: 9 },
    mockUrlValue: {
      color: darkText,
      fontSize: 10,
      fontWeight: "600",
      fontFamily: mono,
      flex: 1,
    },
    mockCopyBtn: {
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: "rgba(124, 58, 237, 0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    mockSuffixPlate: { alignSelf: "flex-start" },
    mockSuffixCallout: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 2,
    },
    mockSuffixText: { color: mutedText, fontSize: 9 },
    mockSuffixBadge: {
      color: "#c4b5fd",
      fontSize: 9,
      fontWeight: "800",
      fontFamily: mono,
    },
  });
}
