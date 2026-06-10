import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";

/** Unsupported thinking/vision — light grey in light mode, dim in dark mode. */
const CAPABILITY_INACTIVE_LIGHT = "#c0c0c0";

function capabilityColors(
  colors: ThemeColors,
  isDark: boolean,
  highlighted: boolean,
  thinking: boolean,
  vision: boolean
): { thinking: string; vision: string } {
  const inactive = isDark ? colors.textDim : CAPABILITY_INACTIVE_LIGHT;

  if (isDark) {
    return {
      thinking: thinking
        ? highlighted
          ? "#fde68a"
          : "#fbbf24"
        : inactive,
      vision: vision
        ? highlighted
          ? "#93c5fd"
          : "#60a5fa"
        : inactive,
    };
  }

  return {
    thinking: thinking
      ? highlighted
        ? "#b45309"
        : "#d97706"
      : inactive,
    vision: vision
      ? highlighted
        ? "#1d4ed8"
        : "#2563eb"
      : inactive,
  };
}

export function ModelCapabilityIcons({
  thinking = false,
  vision = false,
  colors,
  size = 14,
  highlighted = false,
  /** Chat footer — show both icons; unsupported ones stay grey. Lists omit this. */
  showUnsupported = false,
}: {
  thinking?: boolean;
  vision?: boolean;
  colors: ThemeColors;
  size?: number;
  highlighted?: boolean;
  showUnsupported?: boolean;
}) {
  const { isDark } = useTheme();
  const palette = useMemo(
    () => capabilityColors(colors, isDark, highlighted, thinking, vision),
    [colors, isDark, highlighted, thinking, vision]
  );

  if (!showUnsupported && !thinking && !vision) {
    return null;
  }

  return (
    <View style={styles.row}>
      {(showUnsupported || thinking) && (
        <Ionicons
          name="bulb-outline"
          size={size}
          color={palette.thinking}
          accessibilityLabel={thinking ? "Thinking model" : "Not a thinking model"}
        />
      )}
      {(showUnsupported || vision) && (
        <Ionicons
          name="image-outline"
          size={size}
          color={palette.vision}
          accessibilityLabel={vision ? "Vision model" : "Text only"}
        />
      )}
    </View>
  );
}

export const modelNameGroupStyle = StyleSheet.create({
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 0,
  },
});
