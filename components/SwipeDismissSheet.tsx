import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type SwipeDismissDirection = "left" | "right" | "down";

type Props = {
  children: React.ReactNode;
  direction: SwipeDismissDirection;
  style?: StyleProp<ViewStyle>;
  onDismiss?: () => void;
  /** Down-dismiss only: drag must begin in this top band (avoids list scroll conflicts). */
  downStartZoneHeight?: number;
  /**
   * Down-dismiss only: translate the sheet to reveal content behind a transparent modal.
   * Fades the backdrop as the sheet moves.
   */
  overlayPeel?: boolean;
  /** Backdrop color when `overlayPeel` is enabled (include alpha). */
  backdropColor?: string;
};

const DISMISS_DISTANCE = 72;
const DISMISS_VELOCITY = 480;
const DEFAULT_DOWN_START_ZONE = 168;
const ACTIVATION_DISTANCE = 12;
const DISMISS_ANIMATION_MS = 220;
const SNAP_BACK_MS = 160;

export default function SwipeDismissSheet({
  children,
  direction,
  style,
  onDismiss,
  downStartZoneHeight = DEFAULT_DOWN_START_ZONE,
  overlayPeel = false,
  backdropColor = "rgba(0,0,0,0.35)",
}: Props) {
  const router = useRouter();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const gestureActivated = useSharedValue(false);

  const dismiss = useCallback(() => {
    if (onDismiss) {
      onDismiss();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  }, [onDismiss, router]);

  const finishDismiss = useCallback(() => {
    translateY.value = 0;
    dismiss();
  }, [dismiss]);

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (touch) {
        touchStartX.value = touch.x;
        touchStartY.value = touch.y;
      }
    })
    .onTouchesMove((event, state) => {
      const touch = event.allTouches[0];
      if (!touch) return;

      if (direction === "down") {
        if (touch.y <= downStartZoneHeight) {
          gestureActivated.value = true;
          state.activate();
        } else {
          state.fail();
        }
        return;
      }

      const dx = touch.x - touchStartX.value;
      const dy = touch.y - touchStartY.value;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDy > ACTIVATION_DISTANCE && absDy > absDx) {
        state.fail();
        return;
      }

      if (direction === "right" && dx > ACTIVATION_DISTANCE && absDx > absDy) {
        gestureActivated.value = true;
        state.activate();
      } else if (direction === "left" && dx < -ACTIVATION_DISTANCE && absDx > absDy) {
        gestureActivated.value = true;
        state.activate();
      }
    })
    .onTouchesUp((_event, state) => {
      if (!gestureActivated.value) {
        state.fail();
      }
    })
    .onFinalize(() => {
      gestureActivated.value = false;
    })
    .onUpdate((event) => {
      if (direction === "right") {
        translateX.value = Math.max(0, event.translationX);
      } else if (direction === "left") {
        translateX.value = Math.min(0, event.translationX);
      } else {
        translateY.value = Math.max(0, event.translationY);
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        direction === "right"
          ? event.translationX > DISMISS_DISTANCE || event.velocityX > DISMISS_VELOCITY
          : direction === "left"
            ? event.translationX < -DISMISS_DISTANCE || event.velocityX < -DISMISS_VELOCITY
            : event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        if (direction === "down" && overlayPeel) {
          const target = sheetHeight.value > 0 ? sheetHeight.value : event.translationY + 120;
          translateY.value = withTiming(target, { duration: DISMISS_ANIMATION_MS }, (finished) => {
            if (finished) {
              runOnJS(finishDismiss)();
            }
          });
          return;
        }
        runOnJS(dismiss)();
      } else if (direction === "down") {
        translateY.value = withTiming(0, { duration: SNAP_BACK_MS });
      } else {
        translateX.value = withTiming(0, { duration: SNAP_BACK_MS });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform:
      direction === "down"
        ? [{ translateY: translateY.value }]
        : [{ translateX: translateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    if (!overlayPeel || direction !== "down") {
      return { opacity: 0 };
    }
    const height = sheetHeight.value > 0 ? sheetHeight.value : 1;
    return {
      opacity: interpolate(translateY.value, [0, height], [1, 0], "clamp"),
    };
  });

  const sheet = (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(event) => {
          sheetHeight.value = event.nativeEvent.layout.height;
        }}
        style={[{ flex: 1 }, style, sheetAnimatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );

  if (!overlayPeel || direction !== "down") {
    return sheet;
  }

  return (
    <View style={styles.overlayRoot}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: backdropColor },
          backdropAnimatedStyle,
        ]}
      />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
