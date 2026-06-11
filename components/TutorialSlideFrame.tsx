import React, { ReactNode } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type Props = {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  style?: ViewStyle;
  children: ReactNode;
};

/** Parallax + crossfade per tutorial page while horizontally paging. */
export default function TutorialSlideFrame({
  index,
  scrollX,
  pageWidth,
  style,
  children,
}: Props) {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * pageWidth;
    const opacity = interpolate(
      scrollX.value,
      [center - pageWidth * 0.85, center, center + pageWidth * 0.85],
      [0.45, 1, 0.45],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollX.value,
      [center - pageWidth, center, center + pageWidth],
      [0.94, 1, 0.94],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      [center - pageWidth, center, center + pageWidth],
      [10, 0, 10],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  return <Animated.View style={[styles.frame, style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
});
