import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ThemeColors } from "../lib/theme";
import AndroidGuideSprite from "./AndroidGuideSprite";
import { TutorialTypingText } from "./TutorialMockText";

type WalkProps = {
  walk: string;
  stepKey: number;
  colors: ThemeColors;
  isDark?: boolean;
  /** Start typing only when this slide is on screen. */
  active?: boolean;
  /** Rise from below the dock — tutorial slide 0 only. */
  emergeFromBottom?: boolean;
  /** Pin head pose — no Lottie loop or slide-change motion. */
  staticHead?: boolean;
};

type NoteProps = {
  help: string;
  colors: ThemeColors;
};

/** Left column — Lottie drawn smaller than slot so antennae are not edge-clipped. */
const TUTORIAL_SPRITE_SIZE = 58;
const TUTORIAL_SPRITE_SLOT = 72;
/** Reserve space in each slide so illustrations clear the pinned mascot. */
export const TUTORIAL_GUIDE_DOCK_MIN_HEIGHT = 132;
const BUBBLE_HEAD_GAP = 4;
const BUBBLE_RADIUS = 14;
const BUBBLE_TAIL = 10;
const BUBBLE_PAD_H = 12;
const BUBBLE_PAD_V = 10;

function speechBubblePath(width: number, bodyHeight: number) {
  const r = BUBBLE_RADIUS;
  const t = BUBBLE_TAIL;
  const tailBaseL = r + 2;
  const tailBaseR = tailBaseL + 14;
  const tailTipX = 4;
  const tailTipY = bodyHeight + t;

  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `Q ${width} 0 ${width} ${r}`,
    `V ${bodyHeight - r}`,
    `Q ${width} ${bodyHeight} ${width - r} ${bodyHeight}`,
    `H ${tailBaseR}`,
    `L ${tailTipX} ${tailTipY}`,
    `L ${tailBaseL} ${bodyHeight}`,
    `H ${r}`,
    `Q 0 ${bodyHeight} 0 ${bodyHeight - r}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function TutorialSpeechBubble({
  children,
  fill,
  stroke,
  measureText,
  measureStyle,
}: {
  children: React.ReactNode;
  fill: string;
  stroke: string;
  /** Pre-size bubble from full copy — avoids relayout on every typed character. */
  measureText?: string;
  measureStyle?: StyleProp<TextStyle>;
}) {
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 });

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBodySize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
  }, []);

  const svgWidth = bodySize.width;
  const svgHeight = bodySize.height + BUBBLE_TAIL;
  const path =
    svgWidth > 0 && svgHeight > 0 ? speechBubblePath(svgWidth, bodySize.height) : "";

  return (
    <View style={styles.bubbleShell}>
      {measureText && measureStyle ? (
        <View pointerEvents="none" style={styles.bubbleMeasureWrap}>
          <View style={styles.bubbleContent} onLayout={onContentLayout}>
            <Text style={measureStyle}>{measureText}</Text>
          </View>
        </View>
      ) : null}
      {path ? (
        <Svg
          width={svgWidth}
          height={svgHeight}
          style={styles.bubbleSvg}
          pointerEvents="none"
        >
          <Path d={path} fill={fill} stroke={stroke} strokeWidth={1} />
        </Svg>
      ) : null}
      <View
        style={[
          styles.bubbleContent,
          bodySize.height > 0 ? { minHeight: bodySize.height } : null,
        ]}
        onLayout={measureText ? undefined : onContentLayout}
      >
        {children}
      </View>
    </View>
  );
}

/** Android mascot at the bottom; thought bubble grows upward above the head. */
export default function TutorialAndroidGuide({
  walk,
  stepKey,
  colors,
  isDark = true,
  active = true,
  emergeFromBottom = false,
  staticHead = false,
}: WalkProps) {
  const styles = useMemo(() => createWalkStyles(colors), [colors]);
  const bubbleFill = isDark ? colors.surface : colors.bgElevated;
  const spriteStepKey = staticHead ? 0 : active ? stepKey : -1;
  const typingDelay = emergeFromBottom && active ? 380 : 70;
  const bubbleLift = useSharedValue(emergeFromBottom && active ? 14 : 8);
  const bubbleOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      bubbleOpacity.value = 0;
      bubbleLift.value = 8;
      return;
    }
    bubbleLift.value = emergeFromBottom ? 14 : 8;
    bubbleOpacity.value = 0;
    bubbleOpacity.value = withDelay(
      typingDelay * 0.35,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) })
    );
    bubbleLift.value = withDelay(
      typingDelay * 0.35,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
    );
  }, [active, emergeFromBottom, typingDelay, bubbleLift, bubbleOpacity]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [{ translateY: bubbleLift.value }],
  }));

  return (
    <View style={styles.compose}>
      <Animated.View style={[styles.bubbleRow, bubbleStyle]}>
        <View style={styles.headSpacer} />
        <TutorialSpeechBubble
          fill={bubbleFill}
          stroke={colors.border}
          measureText={walk}
          measureStyle={styles.walk}
        >
          <TutorialTypingText
            text={walk}
            style={styles.walk}
            replayKey={stepKey}
            active={active}
            delay={typingDelay}
            charMs={13}
          />
        </TutorialSpeechBubble>
      </Animated.View>
      <View style={[styles.headRow, emergeFromBottom && styles.headRowEmergeClip]}>
        <AndroidGuideSprite
          size={TUTORIAL_SPRITE_SIZE}
          slotWidth={TUTORIAL_SPRITE_SLOT}
          slotHeight={TUTORIAL_SPRITE_SIZE}
          anchorBottom
          stepKey={spriteStepKey}
          emergeFromBottom={emergeFromBottom}
          staticPose={staticHead}
        />
      </View>
    </View>
  );
}

/** Pinned tip at the bottom of each tutorial slide. */
export function TutorialSlideNote({
  help,
  colors,
  active = true,
}: NoteProps & { active?: boolean }) {
  const styles = useMemo(() => createNoteStyles(colors), [colors]);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);

  useEffect(() => {
    if (!active) {
      opacity.value = 0;
      translateY.value = 6;
      return;
    }
    opacity.value = 0;
    translateY.value = 8;
    opacity.value = withDelay(
      120,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      120,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  }, [active, help, opacity, translateY]);

  const noteStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.noteText, noteStyle]}>{help}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  bubbleShell: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    overflow: "visible",
    marginBottom: BUBBLE_TAIL,
  },
  bubbleSvg: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  bubbleContent: {
    paddingHorizontal: BUBBLE_PAD_H,
    paddingVertical: BUBBLE_PAD_V,
    alignSelf: "stretch",
  },
  bubbleMeasureWrap: {
    position: "absolute",
    opacity: 0,
    left: 0,
    right: 0,
    top: 0,
  },
});

function createWalkStyles(colors: ThemeColors) {
  return StyleSheet.create({
    compose: {
      flexDirection: "column",
      justifyContent: "flex-end",
      overflow: "visible",
    },
    bubbleRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingBottom: BUBBLE_HEAD_GAP,
      overflow: "visible",
    },
    headSpacer: {
      width: TUTORIAL_SPRITE_SLOT,
      flexShrink: 0,
    },
    headRow: {
      width: TUTORIAL_SPRITE_SLOT,
      height: TUTORIAL_SPRITE_SIZE,
      justifyContent: "flex-end",
      alignItems: "center",
      overflow: "visible",
    },
    headRowEmergeClip: {
      overflow: "hidden",
    },
    walk: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "400",
    },
  });
}

function createNoteStyles(colors: ThemeColors) {
  return StyleSheet.create({
    noteText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
  });
}
