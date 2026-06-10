import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_ABOUT_DESCRIPTION,
  APP_ABOUT_HIGHLIGHTS,
  APP_ABOUT_LEGAL_FOOTER,
  APP_ABOUT_TAGLINE,
  APP_ABOUT_TRADEMARK,
  LM_STUDIO_URL,
} from "../lib/about-app";
import { APP_DISPLAY_NAME } from "../lib/app-name";
import { PRIVACY_POLICY_URL, SOURCE_CODE_URL, THIRD_PARTY_NOTICES_URL } from "../lib/app-id";
import { appVersion } from "../lib/app-version";
import {
  CREATOR_FULL_NAME,
  CREATOR_PIXEL_FACE,
  CREATOR_SITE_LABEL,
  CREATOR_SITE_URL,
  FOOTER_LEGAL_SUFFIX,
} from "../lib/creator";
import { createScreenHeaderTitleStyle } from "../lib/typography";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";

const SETTINGS_SUBTEXT = {
  fontSize: 12,
  lineHeight: 16,
} as const;

const VERSION_EASTER_EGG_TAPS = 5;
const TAP_RESET_MS = 2500;
const DEVELOPER_CARD_HEIGHT = 90;

function useAboutColors() {
  const { colors, isDark } = useTheme();
  return useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useAboutColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Divider() {
  const colors = useAboutColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAboutColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [versionTapCount, setVersionTapCount] = useState(0);
  const [developerRevealed, setDeveloperRevealed] = useState(false);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const developerReveal = useRef(new Animated.Value(0)).current;
  const versionTapPulse = useRef(new Animated.Value(0)).current;

  const versionShade = developerRevealed ? 0 : versionTapCount / VERSION_EASTER_EGG_TAPS;

  useEffect(() => {
    return () => {
      if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!developerRevealed) {
      developerReveal.setValue(0);
      return;
    }

    Animated.timing(developerReveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [developerRevealed, developerReveal]);

  const onVersionPress = useCallback(() => {
    if (developerRevealed) return;

    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    const next = versionTapCount + 1;
    setVersionTapCount(next);

    versionTapPulse.setValue(0);
    Animated.sequence([
      Animated.timing(versionTapPulse, {
        toValue: 1,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(versionTapPulse, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (next >= VERSION_EASTER_EGG_TAPS - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (next >= VERSION_EASTER_EGG_TAPS) {
      setVersionTapCount(0);
      setDeveloperRevealed(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    tapResetTimer.current = setTimeout(() => {
      setVersionTapCount(0);
      versionTapPulse.setValue(0);
    }, TAP_RESET_MS);
  }, [developerRevealed, versionTapCount, versionTapPulse]);

  const openLmStudio = () => {
    void Linking.openURL(LM_STUDIO_URL);
  };

  const openPortfolio = () => {
    void Linking.openURL(CREATOR_SITE_URL);
  };

  const versionRipple =
    Platform.OS === "android"
      ? { color: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)" }
      : undefined;

  const versionTapFlash = versionTapPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.22],
  });

  const developerCardHeight = developerReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DEVELOPER_CARD_HEIGHT],
  });
  const developerCardOpacity = developerReveal.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.5, 1],
  });
  const developerCardSlide = developerReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 0],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.topBarBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.topBarTitle}>About</Text>
        <View style={styles.topBarBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="About">
          <View style={styles.introBlock}>
            <Text style={styles.appName}>{APP_DISPLAY_NAME}</Text>
            <Text style={styles.appTagline}>{APP_ABOUT_TAGLINE}</Text>
            <Text style={styles.appDescription}>{APP_ABOUT_DESCRIPTION}</Text>
            <Text style={styles.trademarkDisclaimer}>{APP_ABOUT_TRADEMARK}</Text>
            <Text style={styles.disclaimer}>{APP_ABOUT_LEGAL_FOOTER}</Text>
            <Text style={styles.disclaimer}>{FOOTER_LEGAL_SUFFIX}</Text>
          </View>

          <Divider />

          {APP_ABOUT_HIGHLIGHTS.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Ionicons name={item.icon} size={20} color={colors.primaryLight} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={[styles.rowValue, styles.rowValueMuted]}>{item.detail}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}

          <Divider />

          <Pressable onPress={openLmStudio} style={styles.row}>
            <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Powered by LM Studio</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]}>lmstudio.ai</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textDim} />
          </Pressable>

          <Divider />

          <Pressable
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            style={styles.row}
          >
            <Ionicons name="shield-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={1}>
                How LM Link handles your data
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textDim} />
          </Pressable>

          <Divider />

          <Pressable
            onPress={() => void Linking.openURL(THIRD_PARTY_NOTICES_URL)}
            style={styles.row}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Open Source Licenses</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={1}>
                Third-party notices
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textDim} />
          </Pressable>

          <Divider />

          <Pressable onPress={() => void Linking.openURL(SOURCE_CODE_URL)} style={styles.row}>
            <Ionicons name="logo-github" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Source Code</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={1}>
                MIT licensed on GitHub
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textDim} />
          </Pressable>

          <Divider />

          <Pressable
            onPress={onVersionPress}
            disabled={developerRevealed}
            android_ripple={versionRipple}
            style={({ pressed }) => [
              styles.row,
              styles.versionRow,
              pressed && !developerRevealed && styles.versionRowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Version v${appVersion()}`}
          >
            {versionShade > 0 ? (
              <View
                pointerEvents="none"
                style={[styles.versionShade, { opacity: versionShade * 0.34 }]}
              />
            ) : null}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.versionShade,
                styles.versionShadeFlash,
                { opacity: versionTapFlash },
              ]}
            />
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.rowLabel, styles.versionRowContent, { flex: 1 }]}>Version</Text>
            <Text
              style={[
                styles.rowValue,
                styles.rowValueMuted,
                styles.versionValue,
                styles.versionRowContent,
              ]}
            >
              v{appVersion()}
            </Text>
          </Pressable>

          {developerRevealed ? (
            <>
              <Divider />
              <Animated.View
                style={[
                  styles.developerRevealWrap,
                  {
                    height: developerCardHeight,
                    opacity: developerCardOpacity,
                  },
                ]}
              >
                <Animated.View
                  style={{ transform: [{ translateY: developerCardSlide }] }}
                >
                  <Pressable
                    onPress={openPortfolio}
                    style={({ pressed }) => [
                      styles.developerCard,
                      pressed && styles.developerCardPressed,
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel={`${CREATOR_FULL_NAME}, ${CREATOR_SITE_LABEL}`}
                  >
                    <View style={styles.developerLogoWrap}>
                      <Image
                        source={CREATOR_PIXEL_FACE}
                        style={styles.developerLogo}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.developerCopy}>
                      <Text style={styles.developerName}>{CREATOR_FULL_NAME}</Text>
                      <Text style={styles.developerSite}>{CREATOR_SITE_LABEL}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={colors.textDim} />
                  </Pressable>
                </Animated.View>
              </Animated.View>
            </>
          ) : null}
        </Section>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      paddingBottom: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topBarBtn: { width: 36, alignItems: "center", justifyContent: "center" },
    topBarTitle: createScreenHeaderTitleStyle(colors),
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    section: { marginBottom: 24 },
    sectionTitle: {
      color: colors.textDim,
      ...SETTINGS_SUBTEXT,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    group: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 16,
    },
    introBlock: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 8,
    },
    appName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      letterSpacing: -0.25,
    },
    appTagline: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500",
    },
    appDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    trademarkDisclaimer: {
      color: colors.textDim,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 8,
    },
    disclaimer: {
      color: colors.textDim,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
    rowValue: { color: colors.textMuted, ...SETTINGS_SUBTEXT, marginTop: 2 },
    rowValueMuted: { color: colors.textDim },
    versionValue: { marginTop: 0, fontVariant: ["tabular-nums"] },
    versionRow: {
      overflow: "hidden",
      position: "relative",
    },
    versionRowPressed: {
      backgroundColor: colors.surfaceHover,
    },
    versionShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.surfaceHover,
    },
    versionShadeFlash: {
      backgroundColor: colors.primaryLight,
    },
    versionRowContent: {
      zIndex: 1,
    },
    developerRevealWrap: {
      overflow: "hidden",
    },
    developerCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: DEVELOPER_CARD_HEIGHT,
    },
    developerCardPressed: {
      backgroundColor: colors.surfaceHover,
    },
    developerLogoWrap: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    developerLogo: {
      width: "100%",
      height: "100%",
    },
    developerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    developerName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      letterSpacing: -0.15,
    },
    developerSite: {
      color: colors.primaryLight,
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
    },
  });
}
