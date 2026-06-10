import { Href, Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { isOnboardingDone } from "../lib/storage";

export default function Index() {
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    void isOnboardingDone().then((done) => {
      setHref(done ? "/chat" : "/onboarding");
    });
  }, []);

  if (!href) return null;

  return <Redirect href={href} />;
}
