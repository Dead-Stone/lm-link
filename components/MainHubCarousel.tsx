import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  HUB_SPRING,
  HubNavigationProvider,
  HubPage,
  hubPageOffset,
  snapHubPage,
} from "../lib/hub-navigation";
import { useTheme } from "../lib/theme";
import ConversationsPanel from "./ConversationsPanel";
import SettingsPanel from "./SettingsPanel";

const ACTIVATION_DISTANCE = 14;

type Props = {
  children: React.ReactNode;
};

export default function MainHubCarousel({ children }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const pageRef = useRef<HubPage>(1);
  const panelsMountedRef = useRef(false);
  const [page, setPage] = useState<HubPage>(1);
  const [panelsMounted, setPanelsMounted] = useState(false);

  const screenWidth = useSharedValue(width);
  const offsetX = useSharedValue(hubPageOffset(1, Math.max(width, 1)));
  const dragStartOffset = useSharedValue(hubPageOffset(1, Math.max(width, 1)));
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const gestureActivated = useSharedValue(false);
  const gestureEnabled = useSharedValue(true);

  useEffect(() => {
    screenWidth.value = width;
    const next = hubPageOffset(pageRef.current, width);
    offsetX.value = next;
    dragStartOffset.value = next;
  }, [width, screenWidth, offsetX, dragStartOffset]);

  const mountPanels = useCallback(() => {
    if (panelsMountedRef.current) return;
    panelsMountedRef.current = true;
    setPanelsMounted(true);
  }, []);

  const syncPage = useCallback((target: HubPage) => {
    pageRef.current = target;
    setPage(target);
    if (target !== 1) {
      mountPanels();
    }
  }, [mountPanels]);

  const applyPage = useCallback(
    (target: HubPage, animated = true) => {
      if (target !== 1) {
        mountPanels();
      }
      syncPage(target);
      const w = screenWidth.value;
      const nextOffset = hubPageOffset(target, w);
      offsetX.value = animated ? withSpring(nextOffset, HUB_SPRING) : nextOffset;
    },
    [mountPanels, offsetX, screenWidth, syncPage]
  );

  const setGestureEnabled = useCallback(
    (enabled: boolean) => {
      gestureEnabled.value = enabled;
    },
    [gestureEnabled]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pageRef.current !== 1) {
        applyPage(1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [applyPage]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0];
          if (touch) {
            touchStartX.value = touch.x;
            touchStartY.value = touch.y;
          }
        })
        .onTouchesMove((event, state) => {
          if (!gestureEnabled.value) {
            state.fail();
            return;
          }

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
            gestureActivated.value = true;
            runOnJS(mountPanels)();
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
        .onBegin(() => {
          dragStartOffset.value = offsetX.value;
        })
        .onUpdate((event) => {
          const w = screenWidth.value;
          if (w <= 0) return;
          const next = dragStartOffset.value + event.translationX;
          const min = hubPageOffset(2, w);
          const max = hubPageOffset(0, w);
          offsetX.value = Math.max(min, Math.min(max, next));
        })
        .onEnd((event) => {
          const w = screenWidth.value;
          if (w <= 0) return;
          const target = snapHubPage(offsetX.value, w, event.velocityX);
          offsetX.value = withSpring(hubPageOffset(target, w), HUB_SPRING);
          runOnJS(syncPage)(target);
        }),
    [
      dragStartOffset,
      gestureActivated,
      gestureEnabled,
      mountPanels,
      offsetX,
      screenWidth,
      syncPage,
      touchStartX,
      touchStartY,
    ]
  );

  const conversationsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  const settingsStyle = useAnimatedStyle(() => {
    const w = screenWidth.value;
    return {
      transform: [{ translateX: offsetX.value + w * 2 }],
    };
  });

  if (width <= 0) {
    return <View style={[styles.root, { backgroundColor: colors.bg }]}>{children}</View>;
  }

  const showConversations = panelsMounted || page === 0;
  const showSettings = panelsMounted || page === 2;

  return (
    <HubNavigationProvider
      screenWidth={width}
      offsetX={offsetX}
      goToPage={applyPage}
      page={page}
      setGestureEnabled={setGestureEnabled}
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <GestureDetector gesture={pan}>
          <View style={styles.gestureRoot}>
            <View style={styles.chatLayer}>{children}</View>

            {showConversations ? (
              <Animated.View
                style={[styles.overlayPanel, { width }, conversationsStyle]}
                pointerEvents={page === 0 ? "auto" : "none"}
              >
                <ConversationsPanel />
              </Animated.View>
            ) : null}

            {showSettings ? (
              <Animated.View
                style={[styles.overlayPanel, { width }, settingsStyle]}
                pointerEvents={page === 2 ? "auto" : "none"}
              >
                <SettingsPanel />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
      </View>
    </HubNavigationProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  gestureRoot: {
    flex: 1,
  },
  chatLayer: {
    flex: 1,
  },
  overlayPanel: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    left: 0,
    bottom: 0,
  },
});
