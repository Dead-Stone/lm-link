import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemeColors } from "../lib/theme";

type Props = {
  /** Chats: right arrow · Settings: left arrow · Modals: drag handle bar */
  kind: "right" | "left" | "down";
  colors: ThemeColors;
  onPress?: () => void;
};

export default function DismissAffordance({ kind, colors, onPress }: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (kind === "down") {
    const handle = <View style={styles.downBar} />;
    if (!onPress) {
      return <View style={styles.downSlot}>{handle}</View>;
    }
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.downSlot, pressed && styles.arrowSlotPressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {handle}
      </Pressable>
    );
  }

  const icon = (
    <Ionicons
      name={kind === "left" ? "chevron-back" : "chevron-forward"}
      size={22}
      color={colors.textMuted}
    />
  );

  if (!onPress) {
    return <View style={styles.arrowSlot}>{icon}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.arrowSlot, pressed && styles.arrowSlotPressed]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={kind === "left" ? "Go back" : "Close"}
    >
      {icon}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    arrowSlot: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    arrowSlotPressed: {
      opacity: 0.55,
    },
    downSlot: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    downBar: {
      width: 28,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.textDim,
    },
  });
}
