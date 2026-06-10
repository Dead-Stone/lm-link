import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
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
};

const DISMISS_DISTANCE = 72;
const DISMISS_VELOCITY = 480;
const DEFAULT_DOWN_START_ZONE = 168;
const ACTIVATION_DISTANCE = 12;

export default function SwipeDismissSheet({
  children,
  direction,
  style,
  onDismiss,
  downStartZoneHeight = DEFAULT_DOWN_START_ZONE,
}: Props) {
  const router = useRouter();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
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
        runOnJS(dismiss)();
      } else if (direction === "down") {
        translateY.value = withTiming(0, { duration: 160 });
      } else {
        translateX.value = withTiming(0, { duration: 160 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform:
      direction === "down"
        ? [{ translateY: translateY.value }]
        : [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
