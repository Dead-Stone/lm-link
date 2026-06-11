import { Stack } from "expo-router";
import { Caveat_700Bold } from "@expo-google-fonts/caveat";
import { Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Roboto_500Medium } from "@expo-google-fonts/roboto";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import AppOpeningAnimation from "../components/AppOpeningAnimation";
import FirstLaunchTutorial from "../components/FirstLaunchTutorial";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useSettings } from "../lib/context";
import { ErrorProvider } from "../lib/error-context";
import { isOnboardingDone } from "../lib/storage";
import { useTheme } from "../lib/theme";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: false, duration: 0 });

function RootNavigator() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "none",
        freezeOnBlur: false,
      }}
    >
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen
        name="chat"
        options={{
          animation: "none",
          freezeOnBlur: false,
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          presentation: "transparentModal",
          animation: "slide_from_right",
          gestureDirection: "horizontal",
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: "transparent" },
          freezeOnBlur: true,
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ animation: "fade", gestureEnabled: false, headerShown: false }}
      />
      <Stack.Screen
        name="tutorial"
        options={{
          animation: "slide_from_bottom",
          gestureEnabled: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { statusBarStyle } = useTheme();
  return <StatusBar style={statusBarStyle} />;
}

function AppShell() {
  const { colors } = useTheme();
  const { isLoading, bootstrapSubtitle, bootstrapProgress } = useSettings();
  const [openingDone, setOpeningDone] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_500Medium,
    Inter_700Bold,
    Roboto_500Medium,
    Caveat_700Bold,
  });

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    void isOnboardingDone().then((done) => {
      setNeedsOnboarding(!done);
      setOnboardingChecked(true);
    });
  }, []);

  const bootstrapReady = fontsLoaded && onboardingChecked && !isLoading;
  const showTutorial = needsOnboarding && openingDone && !tutorialDismissed;
  const appReady = openingDone && bootstrapReady;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {!openingDone ? (
        <AppOpeningAnimation
          fontsReady={fontsLoaded}
          readyToExit={bootstrapReady}
          statusLabel={bootstrapSubtitle}
          loadProgress={bootstrapProgress}
          onFinish={() => setOpeningDone(true)}
        />
      ) : null}
      {appReady ? (
        <>
          <ThemedStatusBar />
          <RootNavigator />
          {showTutorial ? (
            <FirstLaunchTutorial
              mode="onboarding"
              presentation="glass"
              onComplete={() => setTutorialDismissed(true)}
            />
          ) : null}
        </>
      ) : null}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ErrorProvider>
          <AppShell />
        </ErrorProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
