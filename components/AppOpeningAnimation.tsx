import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { APP_BRAND_TITLE, APP_BRAND_TITLE_SUFFIX } from "../lib/app-name";
import { androidHeadLottieColorFilters } from "../lib/android-head-lottie";
import { brandMarkCornerMask } from "../lib/brand-mark";
import { AppFonts } from "../lib/typography";
import { useTheme } from "../lib/theme";

const lmStudioLogo = require("../assets/lm-studio-logo.png");
const androidFaceOverlay = require("../assets/android-face-overlay.json");

const androidHeadColorFilters = androidHeadLottieColorFilters();

const MARK_BOX = 140;
const markCorners = brandMarkCornerMask(MARK_BOX);
const LOTTIE_END_FRAME = 108;
const POP_IN_MS = 340;
const BADGE_LEAD_MS = 160;
const BADGE_IN_MS = 220;
const HOLD_MS = 160;
const EXIT_MS = 260;
const TOTAL_BUDGET_MS = 2800;

const easePop = Easing.out(Easing.cubic);

export default function AppOpeningAnimation({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors.bg), [colors.bg]);

  const lottieRef = useRef<LottieView>(null);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const markScale = useRef(new Animated.Value(0.9)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const finaleStartedRef = useRef(false);
  const lottieReadyRef = useRef(false);
  const badgeGateRef = useRef(false);
  const lottieStartedRef = useRef(false);

  const playLottie = useCallback(() => {
    lottieRef.current?.play(0, LOTTIE_END_FRAME);
  }, []);

  const tryStartBadge = useCallback(() => {
    if (!badgeGateRef.current || !lottieReadyRef.current || lottieStartedRef.current) return;
    lottieStartedRef.current = true;
    Animated.timing(badgeOpacity, {
      toValue: 1,
      duration: BADGE_IN_MS,
      easing: easePop,
      useNativeDriver: true,
    }).start();
    playLottie();
  }, [badgeOpacity, playLottie]);

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

  const handleLottieComplete = useCallback(() => {
    if (finaleStartedRef.current) return;
    finaleStartedRef.current = true;
    setTimeout(() => closeOverlay(), HOLD_MS);
  }, [closeOverlay]);

  const handleLottieLayout = useCallback(() => {
    if (lottieReadyRef.current) return;
    lottieReadyRef.current = true;
    tryStartBadge();
  }, [tryStartBadge]);

  useEffect(() => {
    const badgeLead = setTimeout(() => {
      badgeGateRef.current = true;
      tryStartBadge();
    }, BADGE_LEAD_MS);

    const playFallback = setTimeout(() => {
      badgeGateRef.current = true;
      lottieReadyRef.current = true;
      tryStartBadge();
    }, BADGE_LEAD_MS + 120);

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
    ]).start(({ finished }) => {
      if (!finished) return;
      badgeGateRef.current = true;
      tryStartBadge();
    });

    return () => {
      clearTimeout(badgeLead);
      clearTimeout(playFallback);
    };
  }, [markOpacity, markScale, titleOpacity, tryStartBadge]);

  useEffect(() => {
    const fallback = setTimeout(() => handleLottieComplete(), TOTAL_BUDGET_MS);
    return () => clearTimeout(fallback);
  }, [handleLottieComplete]);

  return (
    <Animated.View style={[styles.root, { opacity: overlayOpacity }]}>
      <View style={styles.stage} pointerEvents="none">
        <View style={styles.heroColumn}>
          <Animated.View
            style={[
              styles.markAnchor,
              markCorners,
              {
                opacity: markOpacity,
                transform: [{ scale: markScale }],
              },
            ]}
          >
            <Image source={lmStudioLogo} style={styles.markLogo} resizeMode="cover" />

            <Animated.View style={[styles.badgeLayer, { opacity: badgeOpacity }]}>
              <LottieView
                ref={lottieRef}
                source={androidFaceOverlay}
                autoPlay={false}
                loop={false}
                resizeMode="contain"
                style={styles.badgeLottie}
                colorFilters={androidHeadColorFilters}
                onAnimationFinish={handleLottieComplete}
                onLayout={handleLottieLayout}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.titleBlock, { opacity: titleOpacity }]}>
            <Text style={[styles.title, { color: colors.text }]}>{APP_BRAND_TITLE}</Text>
            <Text style={[styles.titleSuffix, { color: colors.textMuted }]}>
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
    titleBlock: {
      alignSelf: "center",
      marginTop: 12,
    },
    title: {
      fontFamily: AppFonts.brandSubtitle,
      fontSize: 30,
      letterSpacing: -0.4,
      lineHeight: 36,
    },
    titleSuffix: {
      fontFamily: AppFonts.androidBrand,
      fontSize: 12,
      letterSpacing: 0.3,
      lineHeight: 16,
      marginTop: 2,
      alignSelf: "flex-end",
    },
    markAnchor: {
      width: MARK_BOX,
      height: MARK_BOX,
      overflow: "hidden",
    },
    markLogo: {
      ...StyleSheet.absoluteFillObject,
      width: MARK_BOX,
      height: MARK_BOX,
    },
    badgeLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      elevation: 2,
    },
    badgeLottie: {
      width: MARK_BOX,
      height: MARK_BOX,
    },
  });
}
