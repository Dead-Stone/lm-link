import { StyleSheet } from "react-native";
import { ChatColors, ThemeColors } from "../../lib/theme";
import { createScreenHeaderTitleStyle } from "../../lib/typography";

const STAGE_TILE_SIZE = 64;
const STAGE_STRIP_TOP_BLEED = 18;
const STAGE_STRIP_HORIZONTAL_PAD = 20;
const STAGE_STRIP_EDGE_OUTSET = 8;

export const composerFieldStyles = StyleSheet.create({
  shell: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.22)",
  },
  content: {
    minHeight: 40,
    justifyContent: "center",
  },
});

export function createEmptyHeroStyles() {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      gap: 18,
    },
    pressed: {
      opacity: 0.78,
    },
    nameWrap: {
      alignSelf: "center",
      alignItems: "center",
      maxWidth: "100%",
    },
    nameMeasure: {
      alignItems: "center",
    },
    name: {
      fontSize: 28,
      fontWeight: "600",
      textAlign: "center",
      letterSpacing: -0.4,
    },
    nameSizer: {
      opacity: 0,
    },
    nameMask: {
      color: "#000000",
      backgroundColor: "transparent",
    },
    masked: {
      position: "absolute",
      top: 0,
    },
    shineSweep: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
    },
  });
}

export function createOdStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 16,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    barCol: {
      marginHorizontal: 16,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    text: { color: colors.textDim, fontSize: 11, flex: 1 },
    ctx: { color: colors.placeholder, fontSize: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryLight },
    progressTrack: { height: 2, backgroundColor: colors.borderStrong, borderRadius: 1, overflow: "hidden" },
    progressFill: { height: 2, backgroundColor: colors.primary, borderRadius: 1 },
  });
}

export function createMainChatStyles(colors: ThemeColors, chat: ChatColors, isDark: boolean) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
  chatBody: { flex: 1, position: "relative" },
  composerBottomFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    zIndex: 9,
  },
  composerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  composerDockFront: {
    zIndex: 12,
  },
  attachMenuScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 11,
    backgroundColor: "transparent",
  },
  dotBgLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  dotTopCap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },

  header: {
    backgroundColor: colors.bg,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: createScreenHeaderTitleStyle(colors, "left"),
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 2,
  },
  headerIconBtn: { padding: 4, flexShrink: 0 },

  systemBannerReveal: {
    overflow: "hidden",
  },
  systemBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  systemBannerIcon: {
    flexShrink: 0,
    marginTop: 2,
  },
  systemBannerBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  systemBannerLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  systemBannerText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },

  typingWrap: { paddingHorizontal: 16, marginBottom: 8, alignSelf: "flex-start" },

  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  errorLabel: { color: colors.error, fontSize: 11, fontWeight: "700", marginBottom: 3 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },

  // ── Staged attachments (transparent top, solid composer bg at bottom) ─────
  attachmentsBar: {
    marginTop: -STAGE_STRIP_TOP_BLEED,
    marginHorizontal: -STAGE_STRIP_EDGE_OUTSET,
    marginBottom: 0,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  attachmentsBarScroll: {
    maxHeight: STAGE_TILE_SIZE + STAGE_STRIP_TOP_BLEED + 10,
  },
  attachmentsBarContent: {
    paddingHorizontal: STAGE_STRIP_HORIZONTAL_PAD,
    paddingTop: STAGE_STRIP_TOP_BLEED + 4,
    paddingBottom: 6,
    gap: 8,
    alignItems: "center",
  },
  stageTile: {
    width: STAGE_TILE_SIZE,
    height: STAGE_TILE_SIZE,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.65)",
  },
  stageTileImage: {
    width: STAGE_TILE_SIZE,
    height: STAGE_TILE_SIZE,
  },
  stageFileTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 4,
  },
  stageFileExt: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
    maxWidth: STAGE_TILE_SIZE - 8,
  },
  stageRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },

  // ── Input bar ──────────────────────────────────────────────────────────────
  inputFooter: {
    backgroundColor: colors.bg,
  },
  inputFooterWithAttachments: {
    backgroundColor: "transparent",
  },
  inputBarSurface: {
    backgroundColor: colors.bg,
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  inputBarWithAttachments: {
    paddingTop: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  inputMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
    minHeight: 20,
    paddingTop: 2,
    paddingBottom: 0,
    backgroundColor: colors.bg,
  },
  footerSolidStrip: {
    marginHorizontal: -12,
    backgroundColor: colors.bg,
  },
  footerModelPicker: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    gap: 6,
  },
  footerModelPickerPressed: { opacity: 0.65 },
  footerModelName: {
    flexShrink: 1,
    minWidth: 0,
    color: chat.modelAccent,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  footerModelChevron: {
    flexShrink: 0,
    opacity: 0.8,
  },
  footerModelTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  poweredByRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    gap: 4,
    opacity: 0.55,
  },
  poweredByText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 0.15,
  },
  poweredByBrand: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  attachAnchor: {
    position: "relative",
    zIndex: 4,
    elevation: 8,
    flexShrink: 0,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: chat.inputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  attachBtnStaged: {
    borderColor: isDark ? colors.primaryBorder : "rgba(139,92,246,0.22)",
  },
  attachBtnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  attachBtnDisabled: {
    opacity: 0.38,
  },
  attachMenuPopover: {
    position: "absolute",
    left: 0,
    bottom: 48,
    width: 188,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.42 : 0.16,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 6,
  },
  attachMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attachMenuItemPressed: {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  attachMenuItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  attachMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
    marginHorizontal: 10,
  },
  textInput: {
    color: chat.inputText,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: chat.sendBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnActive: {
    backgroundColor: chat.sendBgActive,
    ...(isDark
      ? {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }
      : {}),
  },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopIcon: { width: 13, height: 13, borderRadius: 2, backgroundColor: colors.textMuted },

  });
}

