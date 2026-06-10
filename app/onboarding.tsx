import { Redirect } from "expo-router";
import React from "react";

/** Legacy route — first-launch tutorial is a glass overlay on /chat. */
export default function OnboardingScreen() {
  return <Redirect href="/chat" />;
}
