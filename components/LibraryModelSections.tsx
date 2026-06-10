import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import SectionHintLines, { createSectionSubtitleStyle } from "./SectionHintLines";
import { ThemeColors } from "../lib/theme";

const LAYOUT_TRANSITION = LinearTransition.duration(340);
const ROW_ENTER = FadeIn.duration(300);
const ROW_EXIT = FadeOut.duration(240);

export function AnimatedLibraryRow({
  children,
  rowKey,
}: {
  children: React.ReactNode;
  rowKey: string;
}) {
  return (
    <Animated.View
      key={rowKey}
      entering={ROW_ENTER}
      exiting={ROW_EXIT}
      layout={LAYOUT_TRANSITION}
    >
      {children}
    </Animated.View>
  );
}

export function LibrarySectionEmpty({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => createEmptyStyles(colors), [colors]);
  return (
    <Animated.View layout={LAYOUT_TRANSITION} style={styles.wrap}>
      <Text style={styles.text}>No items found</Text>
    </Animated.View>
  );
}

type LibraryModelSectionProps = {
  title: string;
  hint?: string;
  colors: ThemeColors;
  isEmpty: boolean;
  children: React.ReactNode;
  style?: object;
};

export function LibraryModelSection({
  title,
  hint,
  colors,
  isEmpty,
  children,
  style,
}: LibraryModelSectionProps) {
  const styles = useMemo(() => createSectionStyles(colors), [colors]);

  return (
    <Animated.View layout={LAYOUT_TRANSITION} style={[styles.section, style]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <SectionHintLines colors={colors} line={hint} /> : null}
      {isEmpty ? <LibrarySectionEmpty colors={colors} /> : children}
    </Animated.View>
  );
}

function createSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 8 },
    title: createSectionSubtitleStyle(colors),
  });
}

function createEmptyStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    text: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
      fontStyle: "italic",
    },
  });
}
