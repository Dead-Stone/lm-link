import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";

/** Match ModelPicker capability filters / LM Studio modality badges. */
export const CAPABILITY_VISION_ICON = "image-outline" as const;
export const CAPABILITY_VIDEO_ICON = "videocam-outline" as const;
export const CAPABILITY_THINKING_ICON = "bulb-outline" as const;

/** Unsupported thinking/vision — light grey in light mode, dim in dark mode. */
const CAPABILITY_INACTIVE_LIGHT = "#c0c0c0";

function capabilityColors(
  colors: ThemeColors,
  isDark: boolean,
  highlighted: boolean,
  thinking: boolean,
  vision: boolean,
  video: boolean
): {
  thinking: string;
  vision: string;
  video: string;
} {
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
      video: video
        ? highlighted
          ? "#fcd34d"
          : "#f59e0b"
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
    video: video
      ? highlighted
        ? "#b45309"
        : "#d97706"
      : inactive,
  };
}

export function ModelCapabilityIcons({
  thinking = false,
  vision = false,
  video = false,
  colors,
  size = 14,
  highlighted = false,
}: {
  thinking?: boolean;
  vision?: boolean;
  video?: boolean;
  colors: ThemeColors;
  size?: number;
  highlighted?: boolean;
}) {
  const { isDark } = useTheme();

  const palette = useMemo(
    () => capabilityColors(colors, isDark, highlighted, thinking, vision, video),
    [colors, isDark, highlighted, thinking, vision, video]
  );

  if (!thinking && !vision && !video) {
    return null;
  }

  return (
    <View style={styles.row}>
      {vision ? (
        <Ionicons
          name={CAPABILITY_VISION_ICON}
          size={size}
          color={palette.vision}
          accessibilityLabel="Vision model"
        />
      ) : null}
      {video ? (
        <Ionicons
          name={CAPABILITY_VIDEO_ICON}
          size={size}
          color={palette.video}
          accessibilityLabel="Video model"
        />
      ) : null}
      {thinking ? (
        <Ionicons
          name={CAPABILITY_THINKING_ICON}
          size={size}
          color={palette.thinking}
          accessibilityLabel="Thinking model"
        />
      ) : null}
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
