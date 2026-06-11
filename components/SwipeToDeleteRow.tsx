import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  GESTURE_SPRING_ROW,
  projectTranslation,
  rubberBandClamp,
  shouldOpenSwipe,
} from "../lib/gesture-motion";
import { useTheme } from "../lib/theme";

const SWIPE_ICON_SIZE = 26;

const LOAD_ACTION_WIDTH = 92;
const EJECT_ACTION_WIDTH = 88;
const DELETE_ACTION_WIDTH = 84;
const LOAD_SWIPE_GREEN = "#22c55e";
const DELETE_SWIPE_RED = "#ef4444";
const LOAD_ACTION_INK = "#ffffff";
const OPEN_VELOCITY = 420;

type Props = {
  children: React.ReactNode;
  /** Swipe right to reveal — load model into memory. */
  onLoad?: () => void;
  /** Swipe left to reveal — eject / clear selection. */
  onEject?: () => void;
  onDelete?: () => void;
  /** Which edge reveals delete — default right (swipe left). Use left for chat list rows. */
  deleteReveal?: "left" | "right";
  disabled?: boolean;
  loadDisabled?: boolean;
  ejectDisabled?: boolean;
  backgroundColor: string;
};

export default function SwipeToDeleteRow({
  children,
  onLoad,
  onEject,
  onDelete,
  deleteReveal = "right",
  disabled = false,
  loadDisabled = false,
  ejectDisabled = false,
  backgroundColor,
}: Props) {
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const ejectInk = isDark ? "#8e8e93" : "#aeaeb2";

  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);

  const deleteOnLeft = deleteReveal === "left" && !!onDelete;
  const leftRevealWidth = onLoad
    ? LOAD_ACTION_WIDTH
    : deleteOnLeft
      ? DELETE_ACTION_WIDTH
      : 0;
  const rightRevealWidth =
    (onEject ? EJECT_ACTION_WIDTH : 0) +
    (onDelete && !deleteOnLeft ? DELETE_ACTION_WIDTH : 0);

  if (disabled || (leftRevealWidth === 0 && rightRevealWidth === 0)) {
    return <>{children}</>;
  }

  const closeRow = useCallback(() => {
    translateX.value = withSpring(0, GESTURE_SPRING_ROW);
  }, [translateX]);

  const runLoad = useCallback(() => {
    if (!onLoad || loadDisabled) return;
    closeRow();
    onLoad();
  }, [closeRow, loadDisabled, onLoad]);

  const runEject = useCallback(() => {
    if (!onEject || ejectDisabled) return;
    closeRow();
    onEject();
  }, [closeRow, ejectDisabled, onEject]);

  const runDelete = useCallback(() => {
    if (!onDelete) return;
    closeRow();
    onDelete();
  }, [closeRow, onDelete]);

  const canAutoLoad = !!(onLoad && !loadDisabled);
  const canAutoEject = !!(onEject && !ejectDisabled);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          "worklet";
          dragStartX.value = translateX.value;
        })
        .onUpdate((event) => {
          "worklet";
          const raw = dragStartX.value + event.translationX;
          translateX.value = rubberBandClamp(raw, -rightRevealWidth, leftRevealWidth);
        })
        .onEnd((event) => {
          "worklet";
          const projected = projectTranslation(translateX.value, event.velocityX);
          const leftThreshold = leftRevealWidth * 0.42;
          const rightThreshold = rightRevealWidth * 0.42;

          if (
            leftRevealWidth > 0 &&
            shouldOpenSwipe(projected, event.velocityX, leftThreshold, OPEN_VELOCITY, 1)
          ) {
            if (canAutoLoad) {
              translateX.value = withSpring(leftRevealWidth, GESTURE_SPRING_ROW);
              runOnJS(runLoad)();
              return;
            }
            if (deleteOnLeft) {
              translateX.value = withSpring(leftRevealWidth, GESTURE_SPRING_ROW);
              return;
            }
          }

          if (
            rightRevealWidth > 0 &&
            shouldOpenSwipe(projected, event.velocityX, rightThreshold, OPEN_VELOCITY, -1)
          ) {
            if (canAutoEject) {
              translateX.value = withSpring(-rightRevealWidth, GESTURE_SPRING_ROW);
              runOnJS(runEject)();
              return;
            }
            translateX.value = withSpring(-rightRevealWidth, GESTURE_SPRING_ROW);
            return;
          }

          translateX.value = withSpring(0, GESTURE_SPRING_ROW);
        }),
    [
      canAutoEject,
      canAutoLoad,
      deleteOnLeft,
      dragStartX,
      leftRevealWidth,
      rightRevealWidth,
      runEject,
      runLoad,
      translateX,
    ]
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsLayerStyle = useAnimatedStyle(() => ({
    opacity: Math.abs(translateX.value) > 0.5 ? 1 : 0,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.actionsLayer, actionsLayerStyle]} pointerEvents="box-none">
        {onLoad ? (
          <View style={styles.loadAction}>
            <Pressable
              style={[styles.loadActionPressable, loadDisabled && styles.actionPressableDisabled]}
              onPress={runLoad}
              disabled={loadDisabled}
              accessibilityLabel="Load model"
            >
              <Ionicons name="play-circle" size={SWIPE_ICON_SIZE} color={LOAD_ACTION_INK} />
              <Text
                style={[
                  styles.actionLabel,
                  styles.loadActionLabel,
                  loadDisabled && styles.actionLabelDisabled,
                ]}
              >
                Load
              </Text>
            </Pressable>
          </View>
        ) : null}

        {deleteOnLeft ? (
          <View style={styles.deleteActionLeft}>
            <Pressable
              style={styles.deleteActionPressable}
              onPress={runDelete}
              accessibilityLabel="Delete"
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {rightRevealWidth > 0 ? (
          <View style={styles.rightActionsRow}>
            {onEject ? (
              <View style={styles.ejectAction}>
                <Pressable
                  style={styles.ejectActionPressable}
                  onPress={runEject}
                  disabled={ejectDisabled}
                  accessibilityLabel="Eject and clear selection"
                >
                  <MaterialCommunityIcons
                    name="eject-outline"
                    size={SWIPE_ICON_SIZE}
                    color={ejectInk}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: ejectInk },
                      ejectDisabled && styles.actionLabelDisabled,
                    ]}
                  >
                    Eject
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {onDelete && !deleteOnLeft ? (
              <View style={styles.deleteAction}>
                <Pressable
                  style={styles.deleteActionPressable}
                  onPress={runDelete}
                  accessibilityLabel="Delete"
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor }, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    root: {
      overflow: "hidden",
    },
    actionsLayer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "stretch",
    },
    rightActionsRow: {
      flexDirection: "row",
      alignItems: "stretch",
      marginLeft: "auto",
    },
    loadAction: {
      width: LOAD_ACTION_WIDTH,
      backgroundColor: LOAD_SWIPE_GREEN,
      justifyContent: "center",
    },
    loadActionPressable: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 4,
    },
    loadActionLabel: {
      color: LOAD_ACTION_INK,
    },
    actionPressableDisabled: {
      opacity: 0.45,
    },
    actionLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    ejectAction: {
      width: EJECT_ACTION_WIDTH,
      justifyContent: "center",
    },
    ejectActionPressable: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 4,
    },
    actionLabelDisabled: {
      opacity: 0.45,
    },
    deleteAction: {
      width: DELETE_ACTION_WIDTH,
      backgroundColor: DELETE_SWIPE_RED,
      justifyContent: "center",
    },
    deleteActionLeft: {
      width: DELETE_ACTION_WIDTH,
      backgroundColor: DELETE_SWIPE_RED,
      justifyContent: "center",
    },
    deleteActionPressable: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}
