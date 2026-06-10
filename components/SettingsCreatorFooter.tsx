import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { APP_DISPLAY_NAME } from "../lib/app-name";
import { CREATOR_FULL_NAME, CREATOR_SITE_URL, FOOTER_LEGAL_SUFFIX } from "../lib/creator";
import { LINK_BADGE_SIZE_RATIO } from "../lib/link-badge-art";
import { AppFonts } from "../lib/typography";
import { ThemeColors, useAccentPalette } from "../lib/theme";
import BrandLogo from "./BrandLogo";
import MmsSign from "./MmsSign";

const EASTER_EGG_TAPS = 3;
const TAP_RESET_MS = 2500;
const FOOTER_TEXT_GAP = 2;
const FOOTER_TITLE_LINE_HEIGHT = 13;
const FOOTER_BYLINE_LINE_HEIGHT = 12;
const FOOTER_LEGAL_LINE_HEIGHT = 11;
/** Matches title + byline + legal line heights and gaps — logo aligns to all three lines. */
const FOOTER_TEXT_BLOCK_HEIGHT =
  FOOTER_TITLE_LINE_HEIGHT +
  FOOTER_BYLINE_LINE_HEIGHT +
  FOOTER_LEGAL_LINE_HEIGHT +
  FOOTER_TEXT_GAP * 2;
const ICON_SIZE = FOOTER_TEXT_BLOCK_HEIGHT;
/** Minimum touch target — easter egg is icon-only (3× tap). */
const ICON_HIT_MIN = 44;
/** Space after the logo and before the sign (each side of the title). */
const TITLE_SIDE_PADDING = 12;
/** Matches `MmsSign` `smileWidth` in this footer. */
const SIGN_WIDTH = 44;
/** Slightly smaller Android badge than launcher */
const FOOTER_LINK_RATIO = LINK_BADGE_SIZE_RATIO * 0.88;

function iconFootprint(box: number): { width: number; height: number } {
  return { width: box, height: box };
}

export default function SettingsCreatorFooter() {
  const colors = useAccentPalette();
  const iconBox = useMemo(() => iconFootprint(ICON_SIZE), []);
  const styles = useMemo(() => createStyles(colors, iconBox), [colors, iconBox]);

  const [tapCount, setTapCount] = useState(0);
  const [signRevealed, setSignRevealed] = useState(false);
  const [titleBlockWidth, setTitleBlockWidth] = useState(0);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signOpacity = useRef(new Animated.Value(0)).current;
  const signScale = useRef(new Animated.Value(0.8)).current;
  const iconPulse = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
      pulseLoop.current?.stop();
    };
  }, []);

  useEffect(() => {
    pulseLoop.current?.stop();
    if (signRevealed) {
      iconPulse.setValue(0);
      return;
    }

    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();

    return () => pulseLoop.current?.stop();
  }, [signRevealed, iconPulse]);

  useEffect(() => {
    if (!signRevealed) {
      signOpacity.setValue(0);
      signScale.setValue(0.8);
      return;
    }

    Animated.parallel([
      Animated.timing(signOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(signScale, {
        toValue: 1,
        friction: 6,
        tension: 95,
        useNativeDriver: true,
      }),
    ]).start();
  }, [signRevealed, signOpacity, signScale]);

  /** Easter egg: only the app icon counts toward revealing the MMS sign. */
  const onIconPress = () => {
    if (signRevealed) return;

    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    const next = tapCount + 1;
    setTapCount(next);

    if (next >= EASTER_EGG_TAPS - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (next >= EASTER_EGG_TAPS) {
      setTapCount(0);
      setSignRevealed(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    tapResetTimer.current = setTimeout(() => setTapCount(0), TAP_RESET_MS);
  };

  const openCreatorSite = () => {
    void Linking.openURL(CREATOR_SITE_URL);
  };

  const year = new Date().getFullYear();

  const iconScale = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const iconGlow = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const textEdgeOffset =
    titleBlockWidth > 0 ? titleBlockWidth / 2 + TITLE_SIDE_PADDING : TITLE_SIDE_PADDING;

  return (
    <View style={styles.root}>
      <View style={styles.titleLine}>
        <View
          style={styles.titleCenter}
          onLayout={(event) => {
            setTitleBlockWidth(event.nativeEvent.layout.width);
          }}
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {APP_DISPLAY_NAME}
          </Text>
          <Text style={styles.byline}>
            by{" "}
            <Text style={styles.link} onPress={openCreatorSite}>
              {CREATOR_FULL_NAME}
            </Text>
          </Text>
          <Text style={styles.legal}>© {year} · {FOOTER_LEGAL_SUFFIX}</Text>
        </View>

        <View
          style={[styles.sideSlotLeft, { marginRight: textEdgeOffset }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onIconPress}
            disabled={signRevealed}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, pressed && !signRevealed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="App icon"
            accessibilityState={{ disabled: signRevealed }}
          >
            <Animated.View
              style={[styles.iconMark, { opacity: iconGlow, transform: [{ scale: iconScale }] }]}
              pointerEvents="none"
            >
              <BrandLogo
                size={ICON_SIZE}
                rounded
                flat
                linkSizeRatio={FOOTER_LINK_RATIO}
              />
            </Animated.View>
          </Pressable>
        </View>

        <View
          style={[styles.sideSlotRight, { marginLeft: textEdgeOffset }]}
          pointerEvents="box-none"
        >
          <Animated.View
            pointerEvents={signRevealed ? "auto" : "none"}
            style={[
              styles.signMark,
              { opacity: signOpacity, transform: [{ scale: signScale }] },
            ]}
          >
            <Pressable
              onPress={openCreatorSite}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel="Creator signature, opens website"
            >
              <MmsSign colors={colors} fontSize={14} smileWidth={SIGN_WIDTH} compact />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function createStyles(
  colors: ThemeColors,
  iconBox: { width: number; height: number }
) {
  return StyleSheet.create({
    root: {
      width: "100%",
      alignItems: "center",
      paddingTop: 4,
      paddingBottom: 2,
    },
    titleLine: {
      width: "100%",
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      minHeight: ICON_HIT_MIN,
      overflow: "visible",
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    sideSlotLeft: {
      position: "absolute",
      right: "50%",
      top: 0,
      bottom: 0,
      width: ICON_HIT_MIN,
      justifyContent: "center",
      alignItems: "center",
    },
    sideSlotRight: {
      position: "absolute",
      left: "50%",
      top: 0,
      bottom: 0,
      width: SIGN_WIDTH,
      justifyContent: "center",
      alignItems: "center",
    },
    iconBtn: {
      width: ICON_HIT_MIN,
      height: ICON_HIT_MIN,
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
    },
    iconMark: {
      width: iconBox.width,
      height: iconBox.height,
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
    },
    titleCenter: {
      alignItems: "center",
      justifyContent: "center",
      gap: FOOTER_TEXT_GAP,
      overflow: "visible",
      maxWidth: "100%",
      minHeight: FOOTER_TEXT_BLOCK_HEIGHT,
    },
    titleText: {
      fontFamily: AppFonts.brandSubtitle,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: FOOTER_TITLE_LINE_HEIGHT,
      letterSpacing: -0.1,
      textAlign: "center",
      includeFontPadding: false,
    },
    signMark: {
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
    },
    byline: {
      color: colors.textDim,
      fontSize: 10,
      lineHeight: FOOTER_BYLINE_LINE_HEIGHT,
      textAlign: "center",
      includeFontPadding: false,
    },
    link: {
      color: colors.textMuted,
      textDecorationLine: "underline",
      textDecorationColor: colors.textDim,
    },
    legal: {
      color: colors.textDim,
      fontSize: 9,
      lineHeight: FOOTER_LEGAL_LINE_HEIGHT,
      textAlign: "center",
      opacity: 0.75,
      includeFontPadding: false,
    },
    pressed: { opacity: 0.65 },
  });
}
