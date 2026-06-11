import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { ThemeColors } from "../lib/theme";

/** Light purple fill that grows left → right with load progress (0–1). */
export default function ModelLoadProgressFill({
  progress,
  colors,
  fillColor,
}: {
  progress: number;
  colors: ThemeColors;
  /** Override default `colors.primaryGlow` (e.g. grey wash in light mode). */
  fillColor?: string;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ratio = Math.min(1, Math.max(0, progress));
    Animated.timing(widthAnim, {
      toValue: ratio,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  if (progress <= 0) return null;

  return (
    <Animated.View pointerEvents="none" style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width,
            backgroundColor: fillColor ?? colors.primaryGlow,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
});
