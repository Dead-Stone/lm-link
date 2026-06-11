import { useMemo } from "react";
import { Platform } from "react-native";
import { useSettings } from "./context";

export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  primary: string;
  primaryLight: string;
  primaryGlow: string;
  primaryBorder: string;
  success: string;
  successMuted: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  errorTextSoft: string;
  input: string;
  inputText: string;
  placeholder: string;
  overlay: string;
  overlayLight: string;
  switchTrackOff: string;
  statsBar: string;
  markdownBody: string;
  markdownCodeBg: string;
  markdownCodeText: string;
  markdownFenceBg: string;
  markdownFenceBorder: string;
  markdownStrong: string;
  markdownEm: string;
  markdownHeading: string;
  markdownBlockquoteBg: string;
  markdownHr: string;
  lmCenter: string;
  lmInner: string;
  lmOuter: string;
};

const darkColors: ThemeColors = {
  bg: "#000000",
  bgElevated: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#161616",
  border: "#1e1e1e",
  borderStrong: "#2a2a2a",
  text: "#f5f5f5",
  textMuted: "#888888",
  textDim: "#555555",
  primary: "#a78bfa",
  primaryLight: "#c4b5fd",
  primaryGlow: "rgba(167,139,250,0.12)",
  primaryBorder: "rgba(196,181,253,0.22)",
  success: "#c4b5fd",
  successMuted: "#ddd6fe",
  error: "#f87171",
  errorBg: "#1c0f0f",
  errorBorder: "#3a1a1a",
  errorTextSoft: "#fca5a5",
  input: "#111111",
  inputText: "#f0f0f0",
  placeholder: "#444444",
  overlay: "rgba(0,0,0,0.72)",
  overlayLight: "rgba(0,0,0,0.6)",
  switchTrackOff: "#888888",
  statsBar: "#050505",
  markdownBody: "#e5e5e5",
  markdownCodeBg: "#161b22",
  markdownCodeText: "#e6edf3",
  markdownFenceBg: "#0d1117",
  markdownFenceBorder: "#30363d",
  markdownStrong: "#ffffff",
  markdownEm: "#c0c0c0",
  markdownHeading: "#ffffff",
  markdownBlockquoteBg: "#111111",
  markdownHr: "#2a2a2a",
  lmCenter: "#ddd6fe",
  lmInner: "#c4b5fd",
  lmOuter: "#a78bfa",
};

const lightColors: ThemeColors = {
  bg: "#f5f5f5",
  bgElevated: "#ffffff",
  surface: "#ffffff",
  surfaceHover: "#ebebeb",
  border: "#e0e0e0",
  borderStrong: "#cccccc",
  text: "#111111",
  textMuted: "#666666",
  textDim: "#999999",
  primary: "#262626",
  primaryLight: "#404040",
  primaryGlow: "rgba(0, 0, 0, 0.06)",
  primaryBorder: "rgba(0, 0, 0, 0.12)",
  success: "#404040",
  successMuted: "#666666",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorTextSoft: "#b91c1c",
  input: "#ffffff",
  inputText: "#111111",
  placeholder: "#999999",
  overlay: "rgba(0, 0, 0, 0.45)",
  overlayLight: "rgba(0, 0, 0, 0.32)",
  switchTrackOff: "#cccccc",
  statsBar: "#f0f0f0",
  markdownBody: "#333333",
  markdownCodeBg: "#f0f0f0",
  markdownCodeText: "#111111",
  markdownFenceBg: "#f5f5f5",
  markdownFenceBorder: "#e0e0e0",
  markdownStrong: "#111111",
  markdownEm: "#555555",
  markdownHeading: "#111111",
  markdownBlockquoteBg: "#f5f5f5",
  markdownHr: "#e0e0e0",
  lmCenter: "#666666",
  lmInner: "#444444",
  lmOuter: "#262626",
};

export function getThemeColors(theme: ThemeMode): ThemeColors {
  return theme === "dark" ? darkColors : lightColors;
}

/** Darker purple accents for light mode (settings, chat model picker, etc.). */
const lightPurpleAccents = {
  primary: "#6d28d9",
  primaryLight: "#7c3aed",
  primaryGlow: "rgba(124, 58, 237, 0.12)",
  primaryBorder: "rgba(124, 58, 237, 0.22)",
  success: "#7c3aed",
  successMuted: "#8b5cf6",
  lmCenter: "#a78bfa",
  lmInner: "#7c3aed",
  lmOuter: "#6d28d9",
} as const;

export type AccentColors = {
  /** Purple for icons / labels — lighter in dark mode, darker in light mode. */
  purple: string;
  /** Solid purple for buttons. */
  purpleFill: string;
  /** Light purple tint for selected tabs / rows. */
  tabSelectedBg: string;
};

export function getAccentColors(isDark: boolean): AccentColors {
  if (isDark) {
    return {
      purple: darkColors.primaryLight,
      purpleFill: darkColors.primary,
      tabSelectedBg: darkColors.primaryGlow,
    };
  }
  return {
    purple: lightPurpleAccents.primaryLight,
    purpleFill: lightPurpleAccents.primary,
    tabSelectedBg: lightPurpleAccents.primaryGlow,
  };
}

/** Radial halo behind loaded-model deck icons. */
export function getLoadedDeckGlowColor(isDark: boolean): string {
  return isDark ? "#6d28d9" : "#a3a3a3";
}

/** Load-progress wash behind loaded-model deck icons. */
export function getLoadedDeckLoadFillColor(isDark: boolean): string {
  return isDark ? "rgba(124, 58, 237, 0.12)" : "rgba(0, 0, 0, 0.07)";
}

/** Settings keeps purple accent tokens in light mode. */
export function getSettingsPalette(colors: ThemeColors, isDark: boolean): ThemeColors {
  if (isDark) return colors;
  return {
    ...colors,
    ...lightPurpleAccents,
  };
}

export type ChatColors = {
  userBubbleBg: string;
  userBubbleText: string;
  inputBg: string;
  inputText: string;
  inputIcon: string;
  sendBg: string;
  sendBgActive: string;
  sendIcon: string;
  sendIconActive: string;
  modelAccent: string;
};

/** Chat input + user bubbles grey in light mode; model picker accents stay purple. */
export function getChatColors(colors: ThemeColors, isDark: boolean): ChatColors {
  if (isDark) {
    return {
      userBubbleBg: colors.surfaceHover,
      userBubbleText: colors.text,
      inputBg: colors.input,
      inputText: colors.inputText,
      inputIcon: colors.textMuted,
      sendBg: colors.surfaceHover,
      sendBgActive: colors.primary,
      sendIcon: colors.placeholder,
      sendIconActive: "#ffffff",
      modelAccent: colors.primaryLight,
    };
  }

  return {
    userBubbleBg: "#e6e6e6",
    userBubbleText: colors.text,
    inputBg: "#ececec",
    inputText: colors.text,
    inputIcon: "#888888",
    sendBg: "#e0e0e0",
    sendBgActive: "#8f8f8f",
    sendIcon: "#aaaaaa",
    sendIconActive: "#ffffff",
    modelAccent: lightPurpleAccents.primaryLight,
  };
}

/** @deprecated Use useTheme().colors */
export const colors = darkColors;

export function useTheme() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";
  return useMemo(() => {
    const colors = getThemeColors(settings.theme);
    return {
      theme: settings.theme,
      isDark,
      colors,
      accent: getAccentColors(isDark),
      chatColors: getChatColors(colors, isDark),
      statusBarStyle: (isDark ? "light" : "dark") as "light" | "dark",
    };
  }, [settings.theme, isDark]);
}

/** Purple selection accents in light mode — model lists, library, settings tabs. */
export function useAccentPalette(): ThemeColors {
  const { colors, isDark } = useTheme();
  return useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
}

export function getMarkdownStyles(c: ThemeColors) {
  const codeFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return {
    body: {
      color: c.markdownBody,
      fontSize: 15,
      lineHeight: 22,
      flexShrink: 1,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      color: c.markdownBody,
      flexShrink: 1,
    },
    bullet_list_content: { flex: 1, flexShrink: 1 },
    ordered_list_content: { flex: 1, flexShrink: 1 },
    code_inline: {
      backgroundColor: c.markdownCodeBg,
      color: c.markdownCodeText,
      fontFamily: codeFont,
      fontSize: 13,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: c.markdownFenceBg,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: c.markdownFenceBorder,
      color: c.markdownCodeText,
      fontFamily: codeFont,
      fontSize: 13,
    },
    code_block: {
      backgroundColor: c.markdownFenceBg,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: c.markdownFenceBorder,
      color: c.markdownCodeText,
      fontFamily: codeFont,
      fontSize: 13,
    },
    strong: { color: c.markdownStrong, fontWeight: "700" as const },
    em: { color: c.markdownEm, fontStyle: "italic" as const },
    heading1: { color: c.markdownHeading, fontSize: 20, fontWeight: "700" as const, marginBottom: 6 },
    heading2: { color: c.markdownHeading, fontSize: 18, fontWeight: "600" as const, marginBottom: 4 },
    heading3: { color: c.markdownBody, fontSize: 16, fontWeight: "600" as const, marginBottom: 4 },
    bullet_list: { marginVertical: 6 },
    ordered_list: { marginVertical: 6 },
    list_item: { color: c.markdownBody, marginBottom: 4 },
    blockquote: {
      backgroundColor: c.markdownBlockquoteBg,
      borderLeftColor: c.primary,
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 6,
    },
    hr: { backgroundColor: c.markdownHr, height: 1, marginVertical: 12 },
    link: { color: c.primary, textDecorationLine: "underline" as const },
  };
}

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
