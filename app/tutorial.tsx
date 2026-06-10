import { useRouter } from "expo-router";
import React from "react";
import FirstLaunchTutorial from "../components/FirstLaunchTutorial";

export default function TutorialScreen() {
  const router = useRouter();
  return (
    <FirstLaunchTutorial
      mode="replay"
      onComplete={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/chat");
      }}
    />
  );
}
