import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GESTURE_TIMING_ENTER } from "../lib/gesture-motion";
import { FIRST_LAUNCH_SLIDES, TutorialSlide } from "../lib/setup-guide";
import { screenHeaderTopPadding } from "../lib/safe-area-layout";
import { markOnboardingDone } from "../lib/storage";
import { getSettingsPalette, ThemeColors, useTheme } from "../lib/theme";
import DotGridBackground from "./DotGridBackground";
import SetupGuideIllustration from "./SetupGuideIllustrations";
import TransparentSheet from "./TransparentSheet";
import TutorialAndroidGuide, { TutorialSlideNote } from "./TutorialAndroidGuide";
import TutorialProgressDots from "./TutorialProgressDots";
import TutorialSlideFrame from "./TutorialSlideFrame";

const SLIDES = FIRST_LAUNCH_SLIDES;
const PAGE_WIDTH = Dimensions.get("window").width;
const SCROLL_DECELERATION = 0.988;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<TutorialSlide>);

type Props = {
  onComplete: () => void;
  mode?: "onboarding" | "replay";
  presentation?: "glass" | "fullscreen";
};

export default function FirstLaunchTutorial({
  onComplete,
  mode = "onboarding",
  presentation = "fullscreen",
}: Props) {
  const isReplay = mode === "replay";
  const isGlass = presentation === "glass";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const palette = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(
    () => createStyles(colors, palette, isGlass, isDark),
    [colors, palette, isGlass, isDark]
  );

  const listRef = useRef<FlatList<TutorialSlide>>(null);
  const [page, setPage] = useState(0);
  const scrollX = useSharedValue(0);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const shellEnter = useSharedValue(isGlass ? 0 : 1);

  const isLast = page === SLIDES.length - 1;
  const currentSlide = SLIDES[page];

  useEffect(() => {
    if (!isGlass) return;
    shellEnter.value = withTiming(1, GESTURE_TIMING_ENTER);
  }, [isGlass, shellEnter]);

  useEffect(() => {
    headerOpacity.value = 0;
    headerTranslateY.value = 8;
    headerOpacity.value = withTiming(1, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    headerTranslateY.value = withTiming(0, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [page, headerOpacity, headerTranslateY]);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const glassShellStyle = useAnimatedStyle(() => ({
    opacity: shellEnter.value,
    transform: [{ translateY: (1 - shellEnter.value) * 18 }],
  }));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const finish = useCallback(async () => {
    if (isReplay) {
      onComplete();
      return;
    }
    await markOnboardingDone();
    onComplete();
    if (!isGlass) {
      router.replace("/chat");
    }
  }, [isGlass, isReplay, onComplete, router]);

  const scrollToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, SLIDES.length - 1));
    listRef.current?.scrollToOffset({ offset: clamped * PAGE_WIDTH, animated: true });
    setPage(clamped);
  }, []);

  const goNext = () => {
    if (isLast) {
      void finish();
      return;
    }
    scrollToPage(page + 1);
  };

  const goBack = () => {
    if (page === 0) return;
    scrollToPage(page - 1);
  };

  const skipTutorial = () => {
    void finish();
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (next !== page) setPage(next);
  };

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.index * info.averageItemLength,
        animated: true,
      });
      setPage(info.index);
    },
    []
  );

  const renderSlide = ({ item, index }: { item: TutorialSlide; index: number }) => {
    const isActive = page === index;

    return (
      <View style={styles.slidePage}>
        <TutorialSlideFrame index={index} scrollX={scrollX} pageWidth={PAGE_WIDTH}>
          <ScrollView
            style={styles.slideScrollFlex}
            contentContainerStyle={[styles.slideScroll, styles.slideScrollContent]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {item.illustration ? (
              <View style={styles.illustrationWrap}>
                <SetupGuideIllustration id={item.illustration} colors={palette} />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.guideDock, index === 0 && styles.guideDockEmergeClip]}>
            <TutorialAndroidGuide
              walk={item.androidWalk}
              stepKey={index}
              colors={colors}
              isDark={isDark}
              active={isActive}
              emergeFromBottom={index === 0}
            />
          </View>

          <View
            style={[
              styles.slideNoteWrap,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            <TutorialSlideNote help={item.help} colors={colors} active={isActive} />
          </View>
        </TutorialSlideFrame>
      </View>
    );
  };

  const dotFadeTop = insets.top + 80;
  const dotFadeBottom = insets.bottom + 200;

  const body = (
    <>
      {!isGlass ? (
        <View style={styles.dotBgLayer} pointerEvents="none">
          <DotGridBackground mood={0.5} fadeTop={dotFadeTop} fadeBottom={dotFadeBottom} active />
          <View
            style={[styles.dotTopCap, { height: dotFadeTop, backgroundColor: colors.bg }]}
          />
        </View>
      ) : null}

      <View style={[styles.topNav, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
        <Animated.View style={[styles.topNavHeader, headerAnimatedStyle]}>
          <View style={styles.topNavHeaderSide} />
          <View style={styles.topNavHeaderCenter}>
            {currentSlide.section ? (
              <Text style={styles.topNavSection}>{currentSlide.section}</Text>
            ) : null}
            <Text style={styles.topNavTitle} numberOfLines={2}>
              {currentSlide.title}
            </Text>
          </View>
          <View style={styles.topNavHeaderSide}>
            {!isLast ? (
              <Pressable
                onPress={skipTutorial}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Skip tutorial"
                style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        <View style={styles.topNavControls}>
          {page > 0 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              style={({ pressed }) => [styles.navArrow, pressed && styles.navArrowPressed]}
            >
              <Ionicons name="chevron-back" size={24} color={palette.primaryLight} />
            </Pressable>
          ) : (
            <View style={styles.navArrow} />
          )}

          <TutorialProgressDots
            count={SLIDES.length}
            scrollX={scrollX}
            pageWidth={PAGE_WIDTH}
            activeColor={palette.primaryLight}
          />

          <Pressable
            onPress={goNext}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Finish tutorial" : "Next slide"}
            style={({ pressed }) => [styles.navArrow, pressed && styles.navArrowPressed]}
          >
            <Ionicons
              name={isLast ? "checkmark" : "chevron-forward"}
              size={isLast ? 26 : 24}
              color={palette.primaryLight}
            />
          </Pressable>
        </View>
      </View>

      <AnimatedFlatList
        ref={listRef}
        style={styles.slideList}
        data={SLIDES}
        extraData={page}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        decelerationRate={SCROLL_DECELERATION}
        getItemLayout={(_, index) => ({
          length: PAGE_WIDTH,
          offset: PAGE_WIDTH * index,
          index,
        })}
        keyboardShouldPersistTaps="handled"
      />
    </>
  );

  if (isGlass) {
    return (
      <Animated.View style={[styles.glassRoot, glassShellStyle]}>
        <TransparentSheet style={styles.glassSheet}>{body}</TransparentSheet>
      </Animated.View>
    );
  }

  return <View style={styles.root}>{body}</View>;
}

function createStyles(
  colors: ThemeColors,
  palette: ThemeColors,
  isGlass: boolean,
  isDark: boolean
) {
  const panelBg = isGlass ? "transparent" : colors.bg;
  const noteBg = isGlass
    ? isDark
      ? "rgba(0, 0, 0, 0.14)"
      : "rgba(255, 255, 255, 0.22)"
    : colors.bg;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    glassRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 150,
    },
    glassSheet: {
      flex: 1,
    },
    dotBgLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    dotTopCap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    topNav: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      zIndex: 2,
      gap: 8,
      backgroundColor: panelBg,
    },
    topNavHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    topNavHeaderSide: {
      width: 56,
      minHeight: 28,
      justifyContent: "center",
    },
    topNavHeaderCenter: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    skipBtn: {
      alignSelf: "flex-end",
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    skipBtnPressed: {
      opacity: 0.55,
    },
    skipText: {
      color: colors.textDim,
      fontSize: 15,
      fontWeight: "600",
    },
    topNavSection: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "center",
    },
    topNavTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      letterSpacing: -0.3,
      textAlign: "center",
      lineHeight: 22,
    },
    topNavControls: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navArrow: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    navArrowPressed: {
      opacity: 0.55,
    },
    slideList: { flex: 1, zIndex: 1 },
    slidePage: {
      width: PAGE_WIDTH,
      flex: 1,
    },
    slideScrollFlex: { flex: 1 },
    slideScroll: {
      paddingHorizontal: 16,
      paddingTop: 2,
    },
    slideScrollContent: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    guideDock: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 0,
      backgroundColor: panelBg,
      overflow: "visible",
    },
    guideDockEmergeClip: {
      overflow: "hidden",
    },
    slideNoteWrap: {
      paddingHorizontal: 20,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: noteBg,
    },
    illustrationWrap: {
      marginTop: 4,
    },
  });
}
