import { BlurView } from "expo-blur";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useTypingReveal } from "../lib/use-typing-reveal";
import { radii } from "../lib/theme";

const blurProps =
  Platform.OS === "android"
    ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
    : {};

type PlateProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  isDark?: boolean;
  dense?: boolean;
  pill?: boolean;
};

/** Semi-transparent plate behind tutorial mock text. */
export function TutorialFrostedPlate({ children, style, isDark = true }: PlateProps) {
  return (
    <View
      style={[
        styles.plate,
        isDark ? styles.plateDark : styles.plateLight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Frosted glass panel for live tutorial copy. */
export function TutorialGlassPlate({
  children,
  style,
  isDark = true,
  dense = false,
  pill = false,
}: PlateProps) {
  const frostedTint = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.42)";
  const glassBorder = isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.48)";

  return (
    <View
      style={[
        styles.glassOuter,
        pill && styles.glassOuterPill,
        { borderColor: glassBorder },
        isDark ? styles.glassShadowDark : styles.glassShadowLight,
        style,
      ]}
    >
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={isDark ? 38 : 48}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFillObject}
          {...blurProps}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: frostedTint }]}
      />
      <View style={[styles.glassContent, dense && styles.glassContentDense]}>{children}</View>
    </View>
  );
}

type IslandProps = {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  primary?: boolean;
  compact?: boolean;
  disabled?: boolean;
  isDark?: boolean;
};

/** Pill-shaped glass button for tutorial chrome. */
export function TutorialGlassIsland({
  children,
  onPress,
  style,
  primary = false,
  compact = false,
  disabled = false,
  isDark = true,
}: IslandProps) {
  const frostedTint = primary
    ? isDark
      ? "rgba(124, 58, 237, 0.42)"
      : "rgba(124, 58, 237, 0.55)"
    : isDark
      ? "rgba(255,255,255,0.07)"
      : "rgba(255,255,255,0.42)";
  const glassBorder = primary
    ? isDark
      ? "rgba(167, 139, 250, 0.35)"
      : "rgba(124, 58, 237, 0.28)"
    : isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(255,255,255,0.48)";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        style,
        disabled && styles.islandDisabled,
        pressed && !disabled && styles.islandPressed,
      ]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.islandOuter,
          compact && styles.islandOuterCompact,
          { borderColor: glassBorder },
          isDark ? styles.glassShadowDark : styles.glassShadowLight,
        ]}
      >
        {Platform.OS !== "web" ? (
          <BlurView
            intensity={primary ? (isDark ? 32 : 40) : isDark ? 38 : 48}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
            {...blurProps}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: frostedTint }]}
        />
        <View style={[styles.islandContent, compact && styles.islandContentCompact]}>
          {children}
        </View>
      </View>
    </Pressable>
  );
}

type TypingProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Re-run typing when this changes (e.g. illustration id). */
  replayKey?: string | number;
  delay?: number;
  charMs?: number;
  showCursor?: boolean;
  /** When false, text resets and typing pauses until active again. */
  active?: boolean;
};

/** Smooth rAF typing — for tutorial walk copy beside the Android guide. */
export function TutorialTypingText({
  text,
  style,
  replayKey = text,
  delay = 80,
  charMs = 14,
  showCursor = true,
  active = true,
}: TypingProps) {
  const visible = useTypingReveal({ text, replayKey, delay, charMs, active });
  const fade = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const cursorLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) {
      fade.setValue(0);
      cursorLoop.current?.stop();
      return;
    }

    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    cursorLoop.current?.stop();
    cursorLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0.25,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    cursorLoop.current.start();

    return () => cursorLoop.current?.stop();
  }, [active, replayKey, fade, cursorOpacity]);

  const shown = text.slice(0, visible);
  const typing = showCursor && visible < text.length;

  return (
    <Animated.Text style={[style, { opacity: fade }]}>
      {shown}
      {typing ? (
        <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>▍</Animated.Text>
      ) : null}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plateDark: {
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  plateLight: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  glassOuter: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  glassOuterPill: {
    borderRadius: radii.pill,
  },
  glassContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  glassContentDense: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  glassShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  glassShadowLight: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  islandOuter: {
    minHeight: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: "hidden",
  },
  islandOuterCompact: {
    minWidth: 44,
    minHeight: 40,
  },
  islandContent: {
    minHeight: 42,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  islandContentCompact: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  islandPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  islandDisabled: {
    opacity: 0.38,
  },
  cursor: {
    opacity: 0.55,
  },
});
