import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useTheme } from "../lib/theme";

const SWIPE_ICON_SIZE = 26;

/** Reversed eject-outline — load into memory (downward). */
function LoadIcon({ color }: { color: string }) {
  return (
    <View style={{ transform: [{ scaleY: -1 }] }}>
      <MaterialCommunityIcons name="eject-outline" size={SWIPE_ICON_SIZE} color={color} />
    </View>
  );
}

const LOAD_ACTION_WIDTH = 92;
const EJECT_ACTION_WIDTH = 88;

type Props = {
  children: React.ReactNode;
  /** Swipe right to reveal — load model into memory. */
  onLoad?: () => void;
  /** Swipe left to reveal — eject / clear selection. */
  onEject?: () => void;
  onDelete?: () => void;
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
  disabled = false,
  loadDisabled = false,
  ejectDisabled = false,
  backgroundColor,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const loadInk = isDark ? "#4ade80" : "#16a34a";
  const ejectInk = isDark ? "#8e8e93" : "#aeaeb2";
  const swipeableRef = useRef<Swipeable>(null);

  if (disabled || (!onLoad && !onDelete && !onEject)) {
    return <>{children}</>;
  }

  const runLoad = () => {
    if (!onLoad || loadDisabled) return;
    swipeableRef.current?.close();
    onLoad();
  };

  const runEject = () => {
    if (!onEject || ejectDisabled) return;
    swipeableRef.current?.close();
    onEject();
  };

  const runDelete = () => {
    if (!onDelete) return;
    swipeableRef.current?.close();
    onDelete();
  };

  const renderLeftActions = onLoad
    ? (
        _progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
      ) => {
        const translateX = dragX.interpolate({
          inputRange: [0, LOAD_ACTION_WIDTH],
          outputRange: [-LOAD_ACTION_WIDTH, 0],
          extrapolate: "clamp",
        });

        return (
          <Animated.View style={[styles.loadAction, { transform: [{ translateX }] }]}>
            <Pressable
              style={styles.loadActionPressable}
              onPress={runLoad}
              disabled={loadDisabled}
              accessibilityLabel="Load model"
            >
              <LoadIcon color={loadInk} />
              <Text
                style={[
                  styles.actionLabel,
                  { color: loadInk },
                  loadDisabled && styles.actionLabelDisabled,
                ]}
              >
                Load
              </Text>
            </Pressable>
          </Animated.View>
        );
      }
    : undefined;

  const renderRightActions =
    onEject || onDelete
      ? (
          _progress: Animated.AnimatedInterpolation<number>,
          dragX: Animated.AnimatedInterpolation<number>
        ) => {
          const ejectTranslateX = dragX.interpolate({
            inputRange: [-EJECT_ACTION_WIDTH, 0],
            outputRange: [0, EJECT_ACTION_WIDTH],
            extrapolate: "clamp",
          });

          return (
            <View style={styles.rightActionsRow}>
              {onEject ? (
                <Animated.View
                  style={[styles.ejectAction, { transform: [{ translateX: ejectTranslateX }] }]}
                >
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
                </Animated.View>
              ) : null}
              {onDelete ? (
                <Pressable
                  style={[styles.sideAction, styles.deleteAction]}
                  onPress={runDelete}
                  accessibilityLabel="Delete"
                >
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
          );
        }
      : undefined;

  const handleSwipeOpen = (direction: "left" | "right") => {
    if (direction === "left" && onLoad && !loadDisabled) {
      runLoad();
      return;
    }
    if (direction === "right" && onEject && !ejectDisabled) {
      runEject();
    }
  };

  const hasAutoOpen = (onLoad && !loadDisabled) || (onEject && !ejectDisabled);

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      leftThreshold={LOAD_ACTION_WIDTH * 0.45}
      rightThreshold={EJECT_ACTION_WIDTH * 0.45}
      onSwipeableOpen={hasAutoOpen ? handleSwipeOpen : undefined}
    >
      <View style={{ backgroundColor }}>{children}</View>
    </Swipeable>
  );
}

function createStyles() {
  return StyleSheet.create({
    rightActionsRow: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    sideAction: {
      justifyContent: "center",
      alignItems: "center",
      width: 84,
      gap: 4,
      paddingHorizontal: 4,
    },
    loadAction: {
      width: LOAD_ACTION_WIDTH,
      justifyContent: "center",
    },
    loadActionPressable: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 4,
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
      backgroundColor: "transparent",
    },
  });
}
