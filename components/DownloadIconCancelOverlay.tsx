import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";

/** Default ModelModeBadgeIcon size in download rows. */
const DEFAULT_BADGE_SIZE = 26;
/** Padding around badge — mask hugs icon center, not the full slot. */
const MASK_RING = 5;

type Props = {
  onPress: () => void;
  /** Badge draw size — mask is centered and sized to this icon. */
  badgeSize?: number;
};

function maskDiameter(badgeSize: number) {
  return badgeSize + MASK_RING * 2;
}

/** Download-btn shape, darker opaque mask over the badge. */
function cancelBtnColors(colors: ThemeColors, isDark: boolean) {
  return isDark
    ? {
        glow: "rgba(48, 10, 10, 0.82)",
        border: "rgba(252, 165, 165, 0.38)",
        icon: colors.errorTextSoft,
      }
    : {
        glow: "rgba(185, 28, 28, 0.62)",
        border: "rgba(127, 29, 29, 0.42)",
        icon: "#fff",
      };
}

export default function DownloadIconCancelOverlay({
  onPress,
  badgeSize = DEFAULT_BADGE_SIZE,
}: Props) {
  const { colors, isDark } = useTheme();
  const palette = useMemo(() => cancelBtnColors(colors, isDark), [colors, isDark]);
  const diameter = maskDiameter(badgeSize);
  const iconSize = Math.round(diameter * 0.5);

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          width: diameter,
          height: diameter,
          marginLeft: -diameter / 2,
          marginTop: -diameter / 2,
          backgroundColor: palette.glow,
          borderColor: palette.border,
        },
        pressed && styles.btnPressed,
      ]}
      accessibilityLabel="Cancel download"
      accessibilityRole="button"
    >
      <Ionicons name="close-outline" size={iconSize} color={palette.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  btnPressed: { opacity: 0.82 },
});
