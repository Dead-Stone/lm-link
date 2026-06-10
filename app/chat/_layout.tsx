import { Stack } from "expo-router";
import React from "react";
import MainHubCarousel from "../../components/MainHubCarousel";
import { useTheme } from "../../lib/theme";

export default function ChatTabLayout() {
  const { colors } = useTheme();
  return (
    <MainHubCarousel>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "none",
          animationTypeForReplace: "pop",
          freezeOnBlur: false,
        }}
      />
    </MainHubCarousel>
  );
}
