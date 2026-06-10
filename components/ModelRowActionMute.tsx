import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";
import {
  MODEL_ROW_ACTION_FADE_MS,
  MODEL_ROW_ACTION_FADE_OUT_MS,
  MODEL_ROW_ACTION_MUTE_OPACITY,
} from "../lib/model-row-action";

type Props = {
  children: React.ReactNode;
  active: boolean;
  mode: "load" | "eject";
  /** Load progress 0–1; ignored for eject. */
  progress?: number;
  style?: StyleProp<ViewStyle>;
};

/** Smoothly greys row text, logos, and stat icons during load or eject. */
export default function ModelRowActionMute({
  children,
  active,
  mode,
  progress,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      if (mode === "eject") {
        Animated.timing(opacity, {
          toValue: MODEL_ROW_ACTION_MUTE_OPACITY,
          duration: MODEL_ROW_ACTION_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
      return;
    }

    if (wasActive.current) {
      wasActive.current = false;
      Animated.timing(opacity, {
        toValue: 1,
        duration: MODEL_ROW_ACTION_FADE_OUT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [active, mode, opacity]);

  useEffect(() => {
    if (!active || mode !== "load") return;
    const ratio = Math.min(1, Math.max(0.03, progress ?? 0.03));
    const target = 1 - ratio * (1 - MODEL_ROW_ACTION_MUTE_OPACITY);
    Animated.timing(opacity, {
      toValue: target,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, mode, progress, opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      pointerEvents={active ? "none" : "auto"}
    >
      {children}
    </Animated.View>
  );
}
