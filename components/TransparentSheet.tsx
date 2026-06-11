import { BlurView } from "expo-blur";
import React, { useEffect } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GESTURE_TIMING_ENTER } from "../lib/gesture-motion";
import { useTheme } from "../lib/theme";

const blurProps =
  Platform.OS === "android"
    ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
    : {};

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Frosted full-screen sheet — chat stays visible behind (iOS-style transparent modal). */
export default function TransparentSheet({ children, style }: Props) {
  const { isDark } = useTheme();
  const frostedTint = isDark ? "rgba(12, 12, 12, 0.42)" : "rgba(255, 255, 255, 0.52)";
  const fallbackBg = isDark ? "rgba(12, 12, 12, 0.9)" : "rgba(255, 255, 255, 0.94)";
  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    enterOpacity.value = withTiming(1, GESTURE_TIMING_ENTER);
  }, [enterOpacity]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
  }));

  return (
    <Animated.View style={[styles.root, style, shellStyle]}>
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={isDark ? 48 : 58}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFillObject}
          {...blurProps}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackBg }]} />
      )}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: frostedTint }]}
      />
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
  },
});
