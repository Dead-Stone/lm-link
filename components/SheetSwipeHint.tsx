import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors } from "../lib/theme";

/** Height of the swipe-hint band — include in `downStartZoneHeight` for pull-to-dismiss. */
export const SHEET_SWIPE_HINT_BAND = 48;

type Props = {
  colors: ThemeColors;
  hint?: string;
  onPress?: () => void;
};

export default function SheetSwipeHint({
  colors,
  hint = "Swipe down to close",
  onPress,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <>
      <View style={styles.handle} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.wrap} accessibilityLabel={hint || undefined}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${hint}. Tap to close.` : "Close"}
    >
      {content}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 6,
      paddingHorizontal: 20,
    },
    wrapPressed: {
      opacity: 0.72,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textDim,
      opacity: 0.5,
    },
    hint: {
      marginTop: 7,
      fontSize: 11,
      fontWeight: "500",
      color: colors.textDim,
      letterSpacing: 0.15,
    },
  });
}
