import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { APP_BRAND_TITLE, APP_BRAND_TITLE_SUFFIX } from "../lib/app-name";
import { HERO_GIF_PLAY_MS } from "../lib/brand-mark";
import { AppFonts } from "../lib/typography";
import { ThemeColors, useTheme } from "../lib/theme";

const openingHeroGif = require("../assets/hero-animation.gif");

/** On-screen hero — GIF is 512px native; displayed at MARK_BOX for splash layout.
 *  Native splash (splash-icon.png @ 200px) shows the static mark until this GIF loads. */
const MARK_BOX = 200;
/** Keep in sync with compose-readme-hero.mjs (slide-in → rest peek). */
const GIF_PLAY_MS = HERO_GIF_PLAY_MS;
const POP_IN_MS = 280;
const HOLD_MS = 80;
const EXIT_MS = 220;
const MIN_HERO_MS = POP_IN_MS + GIF_PLAY_MS + HOLD_MS;
const MAX_BOOTSTRAP_MS = 30_000;

const easePop = Easing.out(Easing.cubic);

type Props = {
  onFinish: () => void;
  fontsReady?: boolean;
  readyToExit?: boolean;
  statusLabel?: string | null;
  loadProgress?: number | null;
};

export default function AppOpeningAnimation({
  onFinish,
  fontsReady = true,
  readyToExit = true,
  statusLabel = null,
  loadProgress = null,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const titleColor = isDark ? "#ffffff" : colors.primaryLight;

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const markScale = useRef(new Animated.Value(0.9)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const [minHeroDone, setMinHeroDone] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => setMinHeroDone(true), MIN_HERO_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (readyToExit && minHeroDone) {
      closeOverlay();
    }
  }, [readyToExit, minHeroDone, closeOverlay]);

  useEffect(() => {
    const fallback = setTimeout(() => closeOverlay(), MAX_BOOTSTRAP_MS);
    return () => clearTimeout(fallback);
  }, [closeOverlay]);

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
    ]).start();
  }, [markOpacity, markScale]);

  useEffect(() => {
    if (!fontsReady) {
      titleOpacity.setValue(0);
      return;
    }
    Animated.timing(titleOpacity, {
      toValue: 1,
      duration: POP_IN_MS,
      easing: easePop,
      useNativeDriver: true,
    }).start();
  }, [fontsReady, titleOpacity]);

  const waitingForBootstrap = minHeroDone && !readyToExit;
  const displayStatus =
    statusLabel?.trim() ||
    (waitingForBootstrap ? "Getting ready…" : null);

  useEffect(() => {
    Animated.timing(statusOpacity, {
      toValue: displayStatus ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [displayStatus, statusOpacity]);

  useEffect(() => {
    const ratio =
      loadProgress == null ? 0 : Math.min(1, Math.max(0, loadProgress));
    Animated.timing(progressWidth, {
      toValue: ratio,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [loadProgress, progressWidth]);

  const progressFillWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const showProgress = loadProgress != null && loadProgress > 0;

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
              resizeMode="stretch"
              fadeDuration={0}
            />
          </Animated.View>

          <Animated.View style={[styles.titleBlock, { opacity: titleOpacity }]}>
            <Text style={[styles.title, { color: titleColor }]}>{APP_BRAND_TITLE}</Text>
            <Text style={[styles.titleSuffix, { color: colors.textDim }]}>
              {APP_BRAND_TITLE_SUFFIX}
            </Text>
          </Animated.View>

          <Animated.View
            style={[styles.statusBlock, { opacity: statusOpacity }]}
            pointerEvents="none"
          >
            {displayStatus ? (
              <Text style={[styles.statusText, { color: colors.textMuted }]} numberOfLines={1}>
                {displayStatus}
              </Text>
            ) : null}
            {showProgress ? (
              <View style={[styles.progressTrack, { backgroundColor: colors.borderStrong }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: progressFillWidth, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
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
      width: MARK_BOX,
    },
    markWrap: {
      width: MARK_BOX,
      height: MARK_BOX,
    },
    markGif: {
      width: MARK_BOX,
      height: MARK_BOX,
    },
    titleBlock: {
      minWidth: MARK_BOX,
      marginTop: 12,
      alignItems: "flex-end",
    },
    title: {
      fontFamily: AppFonts.openingBrand,
      fontSize: 40,
      letterSpacing: 1.1,
      lineHeight: 44,
      textAlign: "right",
      includeFontPadding: false,
    },
    titleSuffix: {
      fontFamily: AppFonts.androidBrand,
      fontSize: 13,
      letterSpacing: 0.2,
      lineHeight: 16,
      marginTop: 3,
      textAlign: "right",
      includeFontPadding: false,
    },
    statusBlock: {
      width: MARK_BOX + 48,
      marginTop: 14,
      alignItems: "center",
      gap: 8,
      minHeight: 28,
    },
    statusText: {
      fontFamily: AppFonts.brandSubtitle,
      fontSize: 13,
      lineHeight: 16,
      textAlign: "center",
      includeFontPadding: false,
    },
    progressTrack: {
      width: "100%",
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: 3,
      borderRadius: 2,
    },
  });
}
