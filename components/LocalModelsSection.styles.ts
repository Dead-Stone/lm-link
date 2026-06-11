import { Platform, StyleSheet } from "react-native";
import { radii, ThemeColors } from "../lib/theme";
import { createSectionSubtitleStyle } from "./SectionHintLines";

export function createStorageStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginBottom: 0 },
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    label: { color: colors.textMuted, fontSize: 12, flex: 1 },
    free: { color: colors.textDim, fontSize: 12 },
    track: { height: 3, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: "hidden" },
    fill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  });
}

export function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  containerReady: { borderColor: colors.primaryBorder },
  containerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryGlow,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  modelIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  name: { color: colors.text, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  desc: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  detailStats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },

  progressWrap: { marginBottom: 12 },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  progressTitle: { color: colors.primaryLight, fontSize: 12, fontWeight: "600", flex: 1 },
  track: { height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  fill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  progressMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  progressMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  progressPct: { color: colors.primaryLight, fontSize: 12, fontWeight: "700" },
  progressBytes: { color: colors.textDim, fontSize: 11 },
  progressSpeed: { color: colors.textMuted, fontSize: 11 },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(248,113,113,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: colors.error, fontSize: 12, flex: 1, lineHeight: 18 },

  actions: {},
  transferActions: { flexDirection: "row", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  btnPrimary: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  btnSecondary: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  btnTextSecondary: { color: colors.primaryLight, fontSize: 14, fontWeight: "600" },
  btnChat: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  btnDanger: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder },
  btnDangerIcon: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: 14,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextDanger: { color: colors.error, fontSize: 14, fontWeight: "600" },
  readyRow: { flexDirection: "row", gap: 8 },
  });
}

export function createBannerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: "rgba(245,158,11,0.06)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.3)",
      padding: 16,
      marginBottom: 20,
    },
    iconWrap: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: "rgba(245,158,11,0.1)",
      borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    title: { color: "#f59e0b", fontSize: 14, fontWeight: "700", marginBottom: 6 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    codeRow: {
      backgroundColor: colors.markdownCodeBg,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.markdownFenceBorder,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 6,
      alignSelf: "flex-start",
    },
    code: { color: colors.markdownCodeText, fontFamily: "Courier", fontSize: 12 },
  });
}

export function createLocalDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { maxHeight: "82%", paddingBottom: 12 },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      alignSelf: "center",
      marginBottom: 12,
    },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    icon: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBody: {
      flex: 1,
      minWidth: 0,
    },
    publisher: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 26,
    },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
    descriptionWrap: { marginTop: 8 },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    fields: { marginTop: 16, gap: 12 },
    field: { gap: 4 },
    fieldLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    fieldValueRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    fieldValue: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
    fieldMono: {
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      fontSize: 12,
      lineHeight: 18,
    },
    copyBtn: { padding: 4, marginTop: -2 },
    actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  });
}

export function createCatalogRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    rowWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
    },
    rowBrowse: { alignItems: "center" },
    rowPressed: { opacity: 0.82 },
    icon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
      position: "relative",
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    name: { color: colors.text, fontSize: 16, fontWeight: "600", lineHeight: 21, flexShrink: 1 },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    progressTrack: {
      height: 4,
      backgroundColor: colors.borderStrong,
      borderRadius: 2,
      marginTop: 6,
      overflow: "hidden",
      flex: 1,
      minWidth: 0,
    },
    progressFill: { height: 4, backgroundColor: colors.primary },
    downloadBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      marginTop: 2,
      flexShrink: 0,
    },
    downloadBtnActive: {},
    downloadBtnDisabled: { opacity: 0.6 },
    downloadBtnPressed: { opacity: 0.8 },
    rowError: { marginTop: 6, marginHorizontal: 0 },
  });
}

export function createInstalledRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      position: "relative",
      overflow: "hidden",
    },
    rowSelected: {
      backgroundColor: colors.primaryGlow,
      borderRadius: radii.sm,
    },
    rowBrowse: {
      paddingHorizontal: 0,
    },
    rowPressed: { opacity: 0.82 },
    rowMuteWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      zIndex: 1,
    },
    icon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    name: { color: colors.text, fontSize: 16, fontWeight: "600", lineHeight: 21, flexShrink: 1 },
    nameSelected: { color: colors.primaryLight },
    subtitle: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    statsSelected: { color: colors.primaryLight },
    useBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    useBtnSelected: {
      backgroundColor: colors.bgElevated,
      borderColor: colors.primaryBorder,
    },
    useBtnPressed: { opacity: 0.85 },
    useBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    useBtnTextSelected: { color: colors.primaryLight },
    readyIcon: { paddingHorizontal: 4 },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    actionBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnPressed: { opacity: 0.7 },
  });
}

export function createLocalModelsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    statText: { color: colors.primaryLight, fontSize: 13 },

    librarySection: { marginBottom: 0 },
    librarySectionSpaced: { marginTop: 6 },
    librarySectionTitle: createSectionSubtitleStyle(colors),
    quickDownloadBlock: { marginBottom: 4 },
    quickDownloadPlatformTitle: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginTop: 8,
      marginBottom: 2,
    },
    libraryLoading: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 8,
    },
    libraryLoadingText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    emptySearch: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      gap: 6,
    },
    emptySearchTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 4 },
    emptySearchBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
      maxWidth: 280,
    },

    providerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 20,
      marginBottom: 10,
    },
    providerIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    providerLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    footnote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      marginTop: 12, padding: 14,
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    footnoteText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, flex: 1 },
    footnoteLink: { color: colors.primary, fontWeight: "600" },
  });
}

