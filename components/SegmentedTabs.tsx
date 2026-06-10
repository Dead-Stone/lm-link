import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radii, ThemeColors } from "../lib/theme";

export type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
};

type Props<T extends string> = {
  tabs: SegmentedTabItem<T>[];
  selected: T;
  onChange: (id: T) => void;
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
};

/** Settings-style segmented control — icon + label, purple selected pill. */
export default function SegmentedTabs<T extends string>({
  tabs,
  selected,
  onChange,
  colors,
  style,
}: Props<T>) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.bar, style]}>
      {tabs.map((tab) => {
        const isDisabled = !!tab.disabled;
        const isSelected = tab.id === selected;
        return (
          <Pressable
            key={tab.id}
            onPress={() => !isDisabled && onChange(tab.id)}
            style={[
              styles.tab,
              isSelected && styles.tabSelected,
              isDisabled && styles.tabDisabled,
            ]}
          >
            <Ionicons
              name={isDisabled ? "lock-closed-outline" : tab.icon}
              size={15}
              color={
                isDisabled
                  ? colors.textDim
                  : isSelected
                    ? colors.primaryLight
                    : colors.textDim
              }
            />
            <Text
              style={[
                styles.tabLabel,
                isDisabled
                  ? styles.tabLabelDisabled
                  : isSelected
                    ? styles.tabLabelSelected
                    : styles.tabLabelIdle,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      backgroundColor: colors.surfaceHover,
      borderRadius: radii.md,
      padding: 3,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: radii.sm - 2,
    },
    tabSelected: {
      backgroundColor: colors.primaryGlow,
    },
    tabDisabled: {
      opacity: 0.85,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    tabLabelSelected: {
      color: colors.primaryLight,
    },
    tabLabelIdle: {
      color: colors.textDim,
    },
    tabLabelDisabled: {
      color: colors.textDim,
    },
  });
}
