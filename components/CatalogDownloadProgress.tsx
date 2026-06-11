import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { ThemeColors } from "../lib/theme";

type Props = {
  progress: number | null;
  onCancel?: () => void;
  colors: ThemeColors;
  style?: ViewStyle;
  trackStyle?: ViewStyle;
};

export default function CatalogDownloadProgress({
  progress,
  onCancel,
  colors,
  style,
  trackStyle,
}: Props) {
  const ratio = Math.min(1, Math.max(0, progress ?? 0));
  const pct = Math.round(ratio * 100);

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.track, { backgroundColor: colors.borderStrong }, trackStyle]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%` as `${number}%`,
              backgroundColor: colors.primary,
              minWidth: pct > 0 ? 4 : 0,
            },
          ]}
        />
      </View>
      {onCancel ? (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          accessibilityLabel="Cancel download"
        >
          <Ionicons name="close" size={13} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    width: "100%",
    gap: 6,
    marginTop: 6,
  },
  track: {
    flex: 1,
    minWidth: 0,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  cancelBtn: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  cancelBtnPressed: {
    opacity: 0.65,
  },
});
