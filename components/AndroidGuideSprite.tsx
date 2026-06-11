import LottieView from "lottie-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { androidHeadLottieColorFilters } from "../lib/android-head-lottie";
import { ANDROID_HEAD_LOTTIE_REST_FRAME } from "../lib/brand-mark";

const androidHeadTutorial = require("../assets/android-head-tutorial.json");

type Props = {
  /** Lottie draw size (px). */
  size?: number;
  /** Column width — head is centered inside this slot. */
  slotWidth?: number;
  /** Vertical slot — defaults to slotWidth; use size when anchoring to the bottom edge. */
  slotHeight?: number;
  /** Pin the head to the bottom of the slot (tutorial dock). */
  anchorBottom?: boolean;
  stepKey?: number;
  /** Rise into view from below the dock (tutorial slide 0). */
  emergeFromBottom?: boolean;
  /** Hold a single rest frame — no Lottie loop or slide-change replay. */
  staticPose?: boolean;
};

const EMERGE_DISTANCE = 76;
const LOTTIE_TOTAL_FRAMES = 275;
const LOTTIE_REST_PROGRESS = ANDROID_HEAD_LOTTIE_REST_FRAME / LOTTIE_TOTAL_FRAMES;

/** Animated Android head — tutorial only (android-head-tutorial.json, centered in left slot). */
/** Extra Lottie pixels on each side — avoids sub-pixel edge clipping in the native renderer. */
const LOTTIE_EDGE_BLEED = 6;
export default function AndroidGuideSprite({
  size = 58,
  slotWidth,
  slotHeight,
  anchorBottom = false,
  stepKey = 0,
  emergeFromBottom = false,
  staticPose = false,
}: Props) {
  const lottieRef = useRef<LottieView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(emergeFromBottom ? 1 : 0)).current;
  const hasFadedIn = useRef(false);
  const colorFilters = useMemo(() => androidHeadLottieColorFilters(), []);
  const slot = slotWidth ?? size;
  const slotH = slotHeight ?? slot;
  const pad = Math.max(8, Math.round((slot - size) / 2));
  const lottieSize = size + LOTTIE_EDGE_BLEED * 2;
  const lottieOffset = -LOTTIE_EDGE_BLEED;

  const translateY = riseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, EMERGE_DISTANCE],
  });

  useEffect(() => {
    if (staticPose) {
      if (emergeFromBottom && stepKey === 0) {
        riseAnim.setValue(1);
        fadeAnim.setValue(0);
        Animated.parallel([
          Animated.spring(riseAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 42,
            friction: 10,
            velocity: 0.4,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 320,
            delay: 80,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
        return;
      }

      riseAnim.setValue(0);
      if (!hasFadedIn.current) {
        hasFadedIn.current = true;
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        fadeAnim.setValue(1);
      }
      return;
    }

    if (emergeFromBottom && stepKey === 0) {
      riseAnim.setValue(1);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(riseAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 42,
          friction: 10,
          velocity: 0.4,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 320,
          delay: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    riseAnim.setValue(0);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [emergeFromBottom, staticPose, stepKey, fadeAnim, riseAnim]);

  useEffect(() => {
    if (staticPose) return;
    lottieRef.current?.play();
  }, [staticPose, stepKey]);

  const handleLayout = () => {
    if (staticPose) return;
    lottieRef.current?.play();
  };

  return (
    <Animated.View
      style={[
        styles.slot,
        anchorBottom && styles.slotBottom,
        {
          width: slot,
          minHeight: anchorBottom ? slotH : slot,
          height: anchorBottom ? slotH : undefined,
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.frame,
          anchorBottom && styles.frameBottom,
          {
            width: slot,
            height: anchorBottom ? slotH : slot,
            padding: pad,
            paddingTop: anchorBottom ? 0 : pad,
            paddingBottom: anchorBottom ? 0 : pad,
          },
        ]}
      >
        <View style={{ width: size, height: size, overflow: "visible" }}>
          <LottieView
            ref={lottieRef}
            source={androidHeadTutorial}
            autoPlay={false}
            loop={!staticPose}
            progress={staticPose ? LOTTIE_REST_PROGRESS : undefined}
            resizeMode="contain"
            style={{
              width: lottieSize,
              height: lottieSize,
              marginLeft: lottieOffset,
              marginTop: lottieOffset,
            }}
            colorFilters={colorFilters}
            onLayout={handleLayout}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  slotBottom: {
    justifyContent: "flex-end",
  },
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  frameBottom: {
    justifyContent: "flex-end",
  },
});
