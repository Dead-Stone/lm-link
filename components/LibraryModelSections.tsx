import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type CollapsibleLibrarySectionProps = {
  title: string;
  count?: number;
  hint?: string;
  colors: ThemeColors;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  style?: object;
};

/** Section block for unified model library. */
export function LibraryFlowSection({
  title,
  subtitle,
  colors,
  children,
  style,
  first = false,
  collapsible = false,
  expanded = true,
  onToggle,
  hideTitle = false,
}: {
  title: string;
  subtitle?: string;
  colors: ThemeColors;
  children: React.ReactNode;
  style?: object;
  /** Less top margin when first block under the sheet header. */
  first?: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** Hide section heading (browse list uses search + filters only). */
  hideTitle?: boolean;
}) {
  const styles = useMemo(() => createFlowSectionStyles(colors), [colors]);
  const showHeader = collapsible || !hideTitle;

  const headerContent = (
    <>
      {!hideTitle ? (
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && (!collapsible || expanded) ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.headerText} />
      )}
      {collapsible ? (
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textDim}
        />
      ) : null}
    </>
  );

  return (
    <Animated.View
      layout={LAYOUT_TRANSITION}
      style={[styles.section, first && styles.sectionFirst, style]}
    >
      {showHeader ? (
        collapsible && onToggle ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={({ pressed }) => [
              styles.header,
              styles.headerCollapsible,
              pressed && styles.headerPressed,
            ]}
          >
            {headerContent}
          </Pressable>
        ) : (
          <View style={styles.header}>{headerContent}</View>
        )
      ) : null}
      {!collapsible || expanded ? (
        <Animated.View layout={LAYOUT_TRANSITION}>{children}</Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function CollapsibleLibrarySection({
  title,
  count,
  hint,
  colors,
  expanded,
  onToggle,
  children,
  style,
}: CollapsibleLibrarySectionProps) {
  const styles = useMemo(() => createCollapsibleStyles(colors), [colors]);
  const label = count != null && count > 0 ? `${title} (${count})` : title;

  return (
    <Animated.View layout={LAYOUT_TRANSITION} style={[styles.section, style]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Text style={styles.title}>{label}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textDim}
        />
      </Pressable>
      {expanded ? (
        <Animated.View layout={LAYOUT_TRANSITION}>
          {hint ? <SectionHintLines colors={colors} line={hint} /> : null}
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function createFlowSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 8,
      marginTop: 20,
    },
    sectionFirst: {
      marginTop: 8,
    },
    header: {
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    headerCollapsible: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 0,
    },
    headerPressed: {
      opacity: 0.78,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: -0.25,
      lineHeight: 21,
    },
    subtitle: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

function createSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 8 },
    title: createSectionSubtitleStyle(colors),
  });
}

function createCollapsibleStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 12 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 4,
    },
    headerPressed: { opacity: 0.78 },
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
