import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type Props = {
  count: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  activeColor: string;
};

function TutorialDot({
  index,
  scrollX,
  pageWidth,
  activeColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  activeColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const center = index * pageWidth;
    const width = interpolate(
      scrollX.value,
      [center - pageWidth, center, center + pageWidth],
      [5, 18, 5],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      [center - pageWidth, center, center + pageWidth],
      [0.26, 1, 0.26],
      Extrapolation.CLAMP
    );
    return {
      width,
      opacity,
      backgroundColor: activeColor,
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

export default function TutorialProgressDots({ count, scrollX, pageWidth, activeColor }: Props) {
  return (
    <View style={styles.track}>
      {Array.from({ length: count }, (_, i) => (
        <TutorialDot
          key={i}
          index={i}
          scrollX={scrollX}
          pageWidth={pageWidth}
          activeColor={activeColor}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});
