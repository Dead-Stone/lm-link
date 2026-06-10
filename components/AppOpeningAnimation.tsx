import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { APP_BRAND_TITLE, APP_BRAND_TITLE_SUFFIX } from "../lib/app-name";
import { AppFonts } from "../lib/typography";
import { useTheme } from "../lib/theme";

const openingHeroGif = require("../assets/readme-hero.gif");

/** Keep in sync with scripts/compose-readme-hero.mjs (CANVAS / HERO_SIZE). */
const OPENING_GIF_CANVAS = 220;
const OPENING_GIF_ART = 200;
/** On-screen hero size. */
const MARK_BOX = 200;
/** Visible logo width/height after cropping GIF canvas padding. */
const OPENING_ART_BOX = Math.round((MARK_BOX * OPENING_GIF_ART) / OPENING_GIF_CANVAS);
const OPENING_ART_INSET = (MARK_BOX - OPENING_ART_BOX) / 2;
/** 45 frames × 50 ms (gifsicle delay). */
const GIF_PLAY_MS = 2250;
const POP_IN_MS = 340;
const HOLD_MS = 160;
const EXIT_MS = 260;
const TOTAL_BUDGET_MS = POP_IN_MS + GIF_PLAY_MS + HOLD_MS + EXIT_MS + 400;

const easePop = Easing.out(Easing.cubic);

export default function AppOpeningAnimation({ onFinish }: { onFinish: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors.bg), [colors.bg]);
  const titleColor = isDark ? "#ffffff" : colors.primaryLight;

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const markScale = useRef(new Animated.Value(0.9)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const finaleScheduledRef = useRef(false);
  const gifLoadedRef = useRef(false);

  const closeOverlay = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [onFinish, overlayOpacity]);

  const scheduleFinale = useCallback(() => {
    if (finaleScheduledRef.current) return;
    finaleScheduledRef.current = true;
    setTimeout(() => closeOverlay(), GIF_PLAY_MS + HOLD_MS);
  }, [closeOverlay]);

  const handleGifLoad = useCallback(() => {
    if (gifLoadedRef.current) return;
    gifLoadedRef.current = true;
    scheduleFinale();
  }, [scheduleFinale]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(markOpacity, {
        toValue: 1,
        duration: POP_IN_MS,
        easing: easePop,
        useNativeDriver: true,
      }),
      Animated.timing(markScale, {
        toValue: 1,
        duration: POP_IN_MS,
        easing: easePop,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: POP_IN_MS,
        easing: easePop,
        useNativeDriver: true,
      }),
    ]).start();
  }, [markOpacity, markScale, titleOpacity]);

  useEffect(() => {
    const fallback = setTimeout(() => closeOverlay(), TOTAL_BUDGET_MS);
    return () => clearTimeout(fallback);
  }, [closeOverlay]);

  return (
    <Animated.View style={[styles.root, { opacity: overlayOpacity }]}>
      <View style={styles.stage} pointerEvents="none">
        <View style={styles.heroColumn}>
          <Animated.View
            style={[
              styles.markWrap,
              {
                opacity: markOpacity,
                transform: [{ scale: markScale }],
              },
            ]}
          >
            <Image
              source={openingHeroGif}
              style={styles.markGif}
              resizeMode="contain"
              onLoad={handleGifLoad}
            />
          </Animated.View>

          <Animated.View style={[styles.titleBlock, { opacity: titleOpacity }]}>
            <Text style={[styles.title, { color: titleColor }]}>{APP_BRAND_TITLE}</Text>
            <Text style={[styles.titleSuffix, { color: colors.textDim }]}>
              {APP_BRAND_TITLE_SUFFIX}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

function createStyles(appBg: string) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: appBg,
      zIndex: 100,
    },
    stage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    heroColumn: {
      alignItems: "center",
      justifyContent: "center",
    },
    markWrap: {
      width: OPENING_ART_BOX,
      height: OPENING_ART_BOX,
      overflow: "hidden",
    },
    markGif: {
      width: MARK_BOX,
      height: MARK_BOX,
      marginLeft: -OPENING_ART_INSET,
      marginTop: -OPENING_ART_INSET,
    },
    titleBlock: {
      width: OPENING_ART_BOX,
      marginTop: 10,
      alignItems: "flex-end",
    },
    title: {
      fontFamily: AppFonts.openingBrand,
      fontSize: 32,
      letterSpacing: 1.1,
      lineHeight: 34,
      textAlign: "right",
      includeFontPadding: false,
    },
    titleSuffix: {
      fontFamily: AppFonts.androidBrand,
      fontSize: 11,
      letterSpacing: 0.2,
      lineHeight: 13,
      marginTop: 2,
      textAlign: "right",
      includeFontPadding: false,
    },
  });
}
