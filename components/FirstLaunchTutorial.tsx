import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FIRST_LAUNCH_SLIDES, TutorialSlide } from "../lib/setup-guide";
import { markOnboardingDone } from "../lib/storage";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import DotGridBackground from "./DotGridBackground";
import SetupGuideIllustration from "./SetupGuideIllustrations";
import TransparentSheet from "./TransparentSheet";
import TutorialAndroidGuide, { TutorialSlideNote } from "./TutorialAndroidGuide";

const SLIDES = FIRST_LAUNCH_SLIDES;
const PAGE_WIDTH = Dimensions.get("window").width;

type Props = {
  onComplete: () => void;
  mode?: "onboarding" | "replay";
  /** Frosted overlay on the app vs standalone full-screen (replay from settings). */
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

  const isLast = page === SLIDES.length - 1;
  const currentSlide = SLIDES[page];

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
    return (
      <View style={styles.slidePage}>
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
            active={page === index}
            emergeFromBottom={index === 0}
          />
        </View>

        <View
          style={[
            styles.slideNoteWrap,
            { paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          <TutorialSlideNote help={item.help} colors={colors} />
        </View>
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

      <View style={[styles.topNav, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topNavHeader}>
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
        </View>
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

          <View style={styles.dotsTrack}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === page ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

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

      <FlatList
        ref={listRef}
        style={styles.slideList}
        data={SLIDES}
        extraData={page}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialNumToRender={SLIDES.length}
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
      <View style={styles.glassRoot}>
        <TransparentSheet style={styles.glassSheet}>{body}</TransparentSheet>
      </View>
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
    dotsTrack: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 8,
    },
    dot: {
      borderRadius: radii.pill,
    },
    dotInactive: {
      width: 5,
      height: 5,
      backgroundColor: palette.primaryLight,
      opacity: 0.28,
    },
    dotActive: {
      width: 16,
      height: 5,
      backgroundColor: palette.primaryLight,
      opacity: 1,
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
