import React, { useCallback } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
};

const OPEN_DISTANCE = 72;
const OPEN_VELOCITY = 480;
const MAX_DRAG = 48;
const ACTIVATION_DISTANCE = 14;

export default function ChatSwipeNavigator({
  children,
  onSwipeLeft,
  onSwipeRight,
  style,
  enabled = true,
}: Props) {
  const translateX = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const gestureActivated = useSharedValue(false);

  const triggerLeft = useCallback(() => {
    onSwipeLeft?.();
  }, [onSwipeLeft]);

  const triggerRight = useCallback(() => {
    onSwipeRight?.();
  }, [onSwipeRight]);

  const canSwipeLeft = enabled && !!onSwipeLeft;
  const canSwipeRight = enabled && !!onSwipeRight;

  const pan = Gesture.Pan()
    .enabled(canSwipeLeft || canSwipeRight)
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

      const dx = touch.x - touchStartX.value;
      const dy = touch.y - touchStartY.value;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDy > ACTIVATION_DISTANCE && absDy > absDx) {
        state.fail();
        return;
      }

      if (absDx > ACTIVATION_DISTANCE && absDx > absDy) {
        if (dx < 0 && canSwipeLeft) {
          gestureActivated.value = true;
          state.activate();
        } else if (dx > 0 && canSwipeRight) {
          gestureActivated.value = true;
          state.activate();
        } else {
          state.fail();
        }
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
      if (event.translationX < 0 && canSwipeLeft) {
        translateX.value = Math.max(event.translationX, -MAX_DRAG);
      } else if (event.translationX > 0 && canSwipeRight) {
        translateX.value = Math.min(event.translationX, MAX_DRAG);
      }
    })
    .onEnd((event) => {
      const openLeft =
        canSwipeLeft &&
        (event.translationX < -OPEN_DISTANCE || event.velocityX < -OPEN_VELOCITY);
      const openRight =
        canSwipeRight &&
        (event.translationX > OPEN_DISTANCE || event.velocityX > OPEN_VELOCITY);

      if (openLeft) {
        runOnJS(triggerLeft)();
      } else if (openRight) {
        runOnJS(triggerRight)();
      }

      translateX.value = withTiming(0, { duration: 140 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!canSwipeLeft && !canSwipeRight) {
    return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
