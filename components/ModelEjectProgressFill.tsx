import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { MODEL_ROW_EJECT_FILL_MS } from "../lib/model-row-action";
import { useTheme } from "../lib/theme";

/** Grey wash that grows right → left while a model is ejected (mirror of load fill). */
export default function ModelEjectProgressFill({ active }: { active: boolean }) {
  const { isDark } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0.05);
    Animated.timing(progress, {
      toValue: 1,
      duration: MODEL_ROW_EJECT_FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const fillColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)";

  if (!active) return null;

  return (
    <Animated.View pointerEvents="none" style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: fillColor }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
});
