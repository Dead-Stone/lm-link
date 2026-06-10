import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
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

  return (
    <View style={[styles.root, style]}>
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
    </View>
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
