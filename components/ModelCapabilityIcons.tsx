import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ModelModality } from "../lib/vision-models";
import { ThemeColors, useTheme } from "../lib/theme";

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
  text: string;
  thinking: string;
  vision: string;
  video: string;
} {
  const inactive = isDark ? colors.textDim : CAPABILITY_INACTIVE_LIGHT;

  if (isDark) {
    return {
      text: highlighted ? colors.primaryLight : inactive,
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
    text: highlighted ? colors.textMuted : inactive,
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
  modalities = ["text"],
  thinking = false,
  colors,
  size = 14,
  highlighted = false,
  /** Chat footer — show all capability icons; unsupported ones stay grey. */
  showUnsupported = false,
}: {
  modalities?: ModelModality[];
  thinking?: boolean;
  colors: ThemeColors;
  size?: number;
  highlighted?: boolean;
  showUnsupported?: boolean;
}) {
  const { isDark } = useTheme();
  const hasText = modalities.includes("text");
  const hasVision = modalities.includes("image");
  const hasVideo = modalities.includes("video");

  const palette = useMemo(
    () => capabilityColors(colors, isDark, highlighted, thinking, hasVision, hasVideo),
    [colors, isDark, highlighted, thinking, hasVision, hasVideo]
  );

  if (!showUnsupported && !thinking && !hasVision && !hasVideo && !hasText) {
    return null;
  }

  const glyphSize = Math.max(10, size - 2);

  return (
    <View style={styles.row}>
      {(showUnsupported || hasText) && (
        <Text
          style={{
            color: palette.text,
            fontSize: glyphSize,
            fontWeight: "700",
            lineHeight: glyphSize + 2,
          }}
          accessibilityLabel="Text model"
        >
          Aa
        </Text>
      )}
      {(showUnsupported || hasVision) && (
        <Ionicons
          name="image-outline"
          size={size}
          color={palette.vision}
          accessibilityLabel={hasVision ? "Vision model" : "No vision"}
        />
      )}
      {(showUnsupported || hasVideo) && (
        <Ionicons
          name="videocam-outline"
          size={size}
          color={palette.video}
          accessibilityLabel={hasVideo ? "Video model" : "No video"}
        />
      )}
      {(showUnsupported || thinking) && (
        <Ionicons
          name="bulb-outline"
          size={size}
          color={palette.thinking}
          accessibilityLabel={thinking ? "Thinking model" : "Not a thinking model"}
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
