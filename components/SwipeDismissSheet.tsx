import { useRouter } from "expo-router";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Dimensions, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { radii } from "../lib/theme";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  GESTURE_SPRING_SNAP,
  GESTURE_TIMING_ENTER,
  GESTURE_TIMING_EXIT,
  projectTranslation,
  rubberBandClamp,
  shouldDismissSwipe,
} from "../lib/gesture-motion";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
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
  /** Scale pop on enter and a quick pop before slide-out dismiss. */
  popTransition?: boolean;
  /** Slide up from the bottom edge (rounded top corners, anchored to screen bottom). */
  bottomSheet?: boolean;
  /** When set, enter animation runs each time this becomes true (e.g. modal `visible`). */
  presented?: boolean;
  /** Fired when the exit pop / slide-out animation begins. */
  onExitAnimateStart?: () => void;
  /** When set with `bottomSheet`, pull-down dismiss also works at scroll offset 0. */
  scrollOffsetY?: SharedValue<number>;
  /** Native scroll gesture for simultaneous pull-to-dismiss at scroll top. */
  nestedScrollGesture?: ReturnType<typeof Gesture.Native>;
};

/** Imperative handle: animate the sheet out (e.g. after a selection) then dismiss. */
export type SwipeDismissSheetHandle = { dismiss: () => void };

const DISMISS_DISTANCE = 64;
const DISMISS_VELOCITY = 380;
const DEFAULT_DOWN_START_ZONE = 168;
const ACTIVATION_DISTANCE = 10;
const DISMISS_ANIMATION_MS = GESTURE_TIMING_EXIT.duration ?? 280;
const ENTER_ANIMATION_MS = 300;
const DISMISS_EASING = GESTURE_TIMING_EXIT.easing ?? Easing.out(Easing.cubic);
const ENTER_OFFSET = 36;
const BOTTOM_SHEET_ENTER_MS = GESTURE_TIMING_ENTER.duration ?? 320;
const BOTTOM_SHEET_DISMISS_MS = GESTURE_TIMING_EXIT.duration ?? 280;
const BOTTOM_SHEET_ENTER_EASING = GESTURE_TIMING_ENTER.easing ?? Easing.bezier(0.33, 1, 0.68, 1);
const BOTTOM_SHEET_EXIT_EASING = GESTURE_TIMING_EXIT.easing ?? Easing.bezier(0.32, 0, 0.67, 0);
const BOTTOM_SHEET_MAX_HEIGHT_RATIO = 0.94;
const WINDOW = Dimensions.get("window");
const WINDOW_HEIGHT = WINDOW.height;
const WINDOW_WIDTH = WINDOW.width;
const BOTTOM_SHEET_HEIGHT = WINDOW_HEIGHT * BOTTOM_SHEET_MAX_HEIGHT_RATIO;
const BOTTOM_SHEET_OFFSCREEN_Y = BOTTOM_SHEET_HEIGHT + 24;
const EXIT_POP_SCALE = 1.055;
const EXIT_POP_SPRING_MS = 140;
const EXIT_POP_SETTLE_MS = 90;
const ENTER_POP_SCALE = 0.9;

const SwipeDismissSheet = forwardRef<SwipeDismissSheetHandle, Props>(function SwipeDismissSheet(
  {
    children,
    direction,
    style,
    onDismiss,
    downStartZoneHeight = DEFAULT_DOWN_START_ZONE,
    overlayPeel = false,
    backdropColor = "rgba(0,0,0,0.35)",
    popTransition = false,
    bottomSheet = false,
    presented,
    onExitAnimateStart,
    scrollOffsetY,
    nestedScrollGesture,
  },
  ref
) {
  const router = useRouter();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(
    direction === "down" && bottomSheet ? BOTTOM_SHEET_OFFSCREEN_Y : 0
  );
  const scale = useSharedValue(1);
  const sheetHeight = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const gestureActivated = useSharedValue(false);
  const isDismissing = useSharedValue(false);
  const dismissCalledRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    if (onDismiss) {
      onDismiss();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  }, [onDismiss, router]);

  const completeDismiss = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const notifyExitAnimateStart = useCallback(() => {
    onExitAnimateStart?.();
  }, [onExitAnimateStart]);

  const runDownDismissSlide = useCallback(
    (target: number, duration = DISMISS_ANIMATION_MS, easing = DISMISS_EASING) => {
      translateY.value = withTiming(
        target,
        { duration, easing },
        (finished) => {
          if (finished) runOnJS(completeDismiss)();
        }
      );
    },
    [completeDismiss, translateY]
  );

  const runExitPopThenDismiss = useCallback(
    (slideTarget: number) => {
      if (popTransition && !bottomSheet) {
        scale.value = withSequence(
          withSpring(EXIT_POP_SCALE, { damping: 11, stiffness: 420 }),
          withTiming(1, { duration: EXIT_POP_SETTLE_MS, easing: Easing.out(Easing.quad) })
        );
        translateY.value = withDelay(
          EXIT_POP_SPRING_MS + EXIT_POP_SETTLE_MS,
          withTiming(slideTarget, {
            duration: DISMISS_ANIMATION_MS,
            easing: DISMISS_EASING,
          }, (finished) => {
            if (finished) runOnJS(completeDismiss)();
          })
        );
        return;
      }
      if (bottomSheet) {
        translateY.value = withTiming(
          slideTarget,
          { duration: BOTTOM_SHEET_DISMISS_MS, easing: BOTTOM_SHEET_EXIT_EASING },
          (finished) => {
            if (finished) runOnJS(completeDismiss)();
          }
        );
        return;
      }
      runDownDismissSlide(slideTarget);
    },
    [bottomSheet, completeDismiss, popTransition, runDownDismissSlide, scale, translateY]
  );

  // Programmatic dismiss (e.g. after selecting a model): run the same slide-out
  // animation as a swipe so the sheet glides away instead of vanishing.
  const animateOutAndDismiss = useCallback(() => {
    if (isDismissing.value) return;
    isDismissing.value = true;
    runOnJS(notifyExitAnimateStart)();
    if (direction === "down") {
      const target =
        sheetHeight.value > 0 ? sheetHeight.value + 24 : BOTTOM_SHEET_OFFSCREEN_Y;
      runExitPopThenDismiss(target);
    } else {
      const target = direction === "left" ? -640 : 640;
      translateX.value = withTiming(
        target,
        { duration: DISMISS_ANIMATION_MS, easing: DISMISS_EASING },
        (finished) => {
          if (finished) runOnJS(completeDismiss)();
        }
      );
    }
  }, [
    direction,
    completeDismiss,
    isDismissing,
    notifyExitAnimateStart,
    runExitPopThenDismiss,
    sheetHeight,
    translateX,
  ]);

  useImperativeHandle(ref, () => ({ dismiss: animateOutAndDismiss }), [animateOutAndDismiss]);

  const runBottomSheetEnter = useCallback(() => {
    translateY.value = BOTTOM_SHEET_OFFSCREEN_Y;
    translateY.value = withTiming(0, {
      duration: BOTTOM_SHEET_ENTER_MS,
      easing: BOTTOM_SHEET_ENTER_EASING,
    });
    scale.value = 1;
  }, [scale, translateY]);

  useLayoutEffect(() => {
    if (presented === false) {
      if (bottomSheet && direction === "down" && !isDismissing.value) {
        translateY.value = BOTTOM_SHEET_OFFSCREEN_Y;
      }
      return;
    }
    dismissCalledRef.current = false;
    isDismissing.value = false;
    if (direction === "down") {
      if (bottomSheet) {
        runBottomSheetEnter();
      } else {
        translateY.value = ENTER_OFFSET;
        translateY.value = withTiming(0, {
          duration: ENTER_ANIMATION_MS,
          easing: DISMISS_EASING,
        });
        if (popTransition) {
          scale.value = ENTER_POP_SCALE;
          scale.value = withSpring(1, { damping: 14, stiffness: 320 });
        } else {
          scale.value = 1;
        }
      }
    } else {
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
    }
  }, [
    bottomSheet,
    direction,
    popTransition,
    presented,
    isDismissing,
    runBottomSheetEnter,
    scale,
    translateX,
    translateY,
  ]);

  const isDownDismiss = direction === "down";
  const isRightDismiss = direction === "right";
  const isLeftDismiss = direction === "left";

  const pan = useMemo(() => {
    const panGesture = Gesture.Pan().manualActivation(true);
    const base = nestedScrollGesture
      ? panGesture.simultaneousWithExternalGesture(nestedScrollGesture)
      : panGesture;

    return base
      .onTouchesDown((event) => {
        "worklet";
        const touch = event.allTouches[0];
        if (touch) {
          touchStartX.value = touch.x;
          touchStartY.value = touch.y;
        }
      })
      .onTouchesMove((event, state) => {
        "worklet";
        const touch = event.allTouches[0];
        if (!touch) return;

        if (isDownDismiss) {
          const dy = touch.y - touchStartY.value;
          const dx = touch.x - touchStartX.value;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const startedInHeaderZone = touchStartY.value <= downStartZoneHeight;
          const scrollAtTop = scrollOffsetY ? scrollOffsetY.value <= 0.5 : false;
          const canPullDismiss =
            startedInHeaderZone ||
            (bottomSheet && scrollOffsetY !== undefined && scrollAtTop && absDy > absDx);

          if (dy > ACTIVATION_DISTANCE && absDy > absDx) {
            if (canPullDismiss) {
              gestureActivated.value = true;
              state.activate();
            } else {
              state.fail();
            }
          } else if (
            dy < -ACTIVATION_DISTANCE ||
            (absDx > absDy && absDx > ACTIVATION_DISTANCE)
          ) {
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

        if (isRightDismiss && dx > ACTIVATION_DISTANCE && absDx > absDy) {
          gestureActivated.value = true;
          state.activate();
        } else if (isLeftDismiss && dx < -ACTIVATION_DISTANCE && absDx > absDy) {
          gestureActivated.value = true;
          state.activate();
        }
      })
      .onTouchesUp((_event, state) => {
        "worklet";
        if (!gestureActivated.value) {
          state.fail();
        }
      })
      .onFinalize(() => {
        "worklet";
        gestureActivated.value = false;
      })
      .onUpdate((event) => {
        "worklet";
        if (isDismissing.value) return;
        if (isRightDismiss) {
          translateX.value = rubberBandClamp(event.translationX, 0, WINDOW_WIDTH * 0.55);
        } else if (isLeftDismiss) {
          translateX.value = rubberBandClamp(event.translationX, -WINDOW_WIDTH * 0.55, 0);
        } else {
          const maxDown =
            sheetHeight.value > 0 ? sheetHeight.value + 48 : BOTTOM_SHEET_OFFSCREEN_Y;
          translateY.value = rubberBandClamp(event.translationY, 0, maxDown);
        }
      })
      .onEnd((event) => {
        "worklet";
        const projectedY = projectTranslation(event.translationY, event.velocityY, 0.18);
        const projectedX = projectTranslation(event.translationX, event.velocityX, 0.2);

        const shouldDismiss = isRightDismiss
          ? shouldDismissSwipe(
              projectedX,
              event.velocityX,
              DISMISS_DISTANCE,
              DISMISS_VELOCITY,
              1
            )
          : isLeftDismiss
            ? shouldDismissSwipe(
                projectedX,
                event.velocityX,
                DISMISS_DISTANCE,
                DISMISS_VELOCITY,
                -1
              )
            : shouldDismissSwipe(
                projectedY,
                event.velocityY,
                DISMISS_DISTANCE,
                DISMISS_VELOCITY,
                1
              );

        if (shouldDismiss) {
          if (isDismissing.value) return;
          isDismissing.value = true;
          runOnJS(notifyExitAnimateStart)();

          if (isDownDismiss) {
            const target =
              sheetHeight.value > 0
                ? sheetHeight.value + 24
                : Math.max(event.translationY + 160, 320);
            if (popTransition && !bottomSheet) {
              scale.value = withSequence(
                withSpring(EXIT_POP_SCALE, { damping: 11, stiffness: 420 }),
                withTiming(1, { duration: EXIT_POP_SETTLE_MS, easing: Easing.out(Easing.quad) })
              );
              translateY.value = withDelay(
                EXIT_POP_SPRING_MS + EXIT_POP_SETTLE_MS,
                withTiming(
                  target,
                  {
                    duration: DISMISS_ANIMATION_MS,
                    easing: DISMISS_EASING,
                  },
                  (finished) => {
                    if (finished) runOnJS(completeDismiss)();
                  }
                )
              );
            } else {
              const duration = bottomSheet ? BOTTOM_SHEET_DISMISS_MS : DISMISS_ANIMATION_MS;
              const easing = bottomSheet ? BOTTOM_SHEET_EXIT_EASING : DISMISS_EASING;
              translateY.value = withTiming(
                target,
                { duration, easing },
                (finished) => {
                  if (finished) runOnJS(completeDismiss)();
                }
              );
            }
            return;
          }

          const horizontalTarget = isLeftDismiss ? -WINDOW_WIDTH : WINDOW_WIDTH;
          translateX.value = withTiming(
            horizontalTarget,
            { duration: DISMISS_ANIMATION_MS, easing: DISMISS_EASING },
            (finished) => {
              if (finished) runOnJS(completeDismiss)();
            }
          );
          return;
        }

        if (isDownDismiss) {
          translateY.value = withSpring(0, GESTURE_SPRING_SNAP);
        } else {
          translateX.value = withSpring(0, GESTURE_SPRING_SNAP);
        }
      });
  }, [
    bottomSheet,
    completeDismiss,
    downStartZoneHeight,
    gestureActivated,
    isDismissing,
    isDownDismiss,
    isLeftDismiss,
    isRightDismiss,
    nestedScrollGesture,
    notifyExitAnimateStart,
    popTransition,
    scale,
    scrollOffsetY,
    sheetHeight,
    touchStartX,
    touchStartY,
    translateX,
    translateY,
  ]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform:
      direction === "down"
        ? bottomSheet
          ? [{ translateY: translateY.value }]
          : [{ translateY: translateY.value }, { scale: scale.value }]
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

  const sheetPanelStyle: StyleProp<ViewStyle> = bottomSheet
    ? [styles.bottomSheetPanel, style]
    : [{ flex: 1 }, style];

  const sheet = (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(event) => {
          sheetHeight.value = event.nativeEvent.layout.height;
        }}
        style={[sheetPanelStyle, sheetAnimatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );

  if (!overlayPeel || direction !== "down") {
    return sheet;
  }

  return (
    <View style={[styles.overlayRoot, bottomSheet && styles.bottomSheetOverlay]}>
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
});

export default SwipeDismissSheet;

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
  bottomSheetOverlay: {
    justifyContent: "flex-end",
  },
  bottomSheetPanel: {
    width: "100%",
    height: BOTTOM_SHEET_HEIGHT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: "hidden",
  },
});
