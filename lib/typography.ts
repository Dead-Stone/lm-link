import { TextStyle } from "react-native";
import { ThemeColors } from "./theme";

/** Display font for screen and modal page titles. */
export const AppFonts = {
  display: "PlusJakartaSans_600SemiBold",
  displayBold: "PlusJakartaSans_700Bold",
  /** LM Studio–style UI sans for the app title. */
  brandTitle: "Inter_700Bold",
  brandSubtitle: "Inter_500Medium",
  /** “for Android” — Roboto matches platform branding. */
  androidBrand: "Roboto_500Medium",
  /** Caveat script — MMS signature on signedbymms.vercel.app. */
  script: "Caveat_700Bold",
} as const;

export const pageTitleTypography: TextStyle = {
  fontFamily: AppFonts.displayBold,
  fontSize: 18,
  letterSpacing: -0.35,
  lineHeight: 24,
};

export const heroTitleTypography: TextStyle = {
  fontFamily: AppFonts.displayBold,
  fontSize: 28,
  letterSpacing: -0.6,
  lineHeight: 34,
};

export const brandTitleTypography: TextStyle = {
  fontFamily: AppFonts.brandTitle,
  fontSize: 26,
  letterSpacing: -0.45,
  lineHeight: 32,
};

export const brandSubtitleTypography: TextStyle = {
  fontFamily: AppFonts.brandSubtitle,
  fontSize: 14,
  letterSpacing: 0.15,
  lineHeight: 20,
};

/** Centered title in modal / sheet headers (Choose Model, Model Library, Settings). */
export function createPageTitleStyle(
  colors: ThemeColors,
  align: "center" | "left" = "center"
): TextStyle {
  return {
    ...pageTitleTypography,
    color: colors.text,
    textAlign: align,
    ...(align === "center" ? { flex: 1 } : {}),
  };
}

/** Screen nav bar titles (Chats, Settings, conversation name). */
export function createScreenHeaderTitleStyle(
  colors: ThemeColors,
  align: "center" | "left" = "center"
): TextStyle {
  return {
    ...pageTitleTypography,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    textAlign: align,
    ...(align === "left" ? { paddingLeft: 4 } : {}),
  };
}

/** Large onboarding / marketing headings. */
export function createHeroTitleStyle(colors: ThemeColors): TextStyle {
  return {
    ...heroTitleTypography,
    color: colors.text,
    textAlign: "center",
  };
}

/** App title — matches LM Studio’s clean Inter-style branding. */
export function createBrandTitleStyle(colors: ThemeColors): TextStyle {
  return {
    ...brandTitleTypography,
    color: colors.text,
    textAlign: "center",
  };
}

/** Brand subtitle — Inter medium, paired with the app title. */
export function createBrandSubtitleStyle(colors: ThemeColors): TextStyle {
  return {
    ...brandSubtitleTypography,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  };
}
