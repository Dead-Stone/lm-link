import React, { useMemo } from "react";
import { StyleSheet, Text, TextStyle, View } from "react-native";
import { ThemeColors } from "../lib/theme";

export function createSectionSubtitleStyle(colors: ThemeColors): TextStyle {
  return {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  };
}

export default function SectionHintLines({
  line,
  colors,
}: {
  line: string;
  colors: ThemeColors;
}) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        line: { color: colors.textDim, fontSize: 12, lineHeight: 16, marginBottom: 10 },
      }),
    [colors.textDim]
  );

  return <Text style={styles.line}>{line}</Text>;
}
