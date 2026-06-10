import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../lib/theme";

export default function ChatTabLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "none",
        animationTypeForReplace: "pop",
        freezeOnBlur: false,
      }}
    />
  );
}
