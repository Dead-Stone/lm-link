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
import { AppProvider } from "../lib/context";
import { ErrorProvider } from "../lib/error-context";
import { isOnboardingDone } from "../lib/storage";
import { useTheme } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

// Inner component so it can access context
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
  const [openingDone, setOpeningDone] = useState(false);
  const [openingGateReady, setOpeningGateReady] = useState(false);
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
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;
    void isOnboardingDone().then((done) => {
      setNeedsOnboarding(!done);
      setOpeningGateReady(true);
    });
  }, [fontsLoaded]);

  const showTutorial = needsOnboarding && openingDone && !tutorialDismissed;

  if (!fontsLoaded || !openingGateReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemedStatusBar />
      <RootNavigator />
      {!openingDone ? (
        <AppOpeningAnimation onFinish={() => setOpeningDone(true)} />
      ) : null}
      {showTutorial ? (
        <FirstLaunchTutorial
          mode="onboarding"
          presentation="glass"
          onComplete={() => setTutorialDismissed(true)}
        />
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
