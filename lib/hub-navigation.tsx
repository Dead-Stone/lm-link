import React, { createContext, useContext, useMemo } from "react";
import { SharedValue } from "react-native-reanimated";

/** 0 = chats, 1 = chat, 2 = settings */
export type HubPage = 0 | 1 | 2;

export const HUB_SPRING = {
  damping: 30,
  stiffness: 240,
  mass: 0.86,
  overshootClamping: false,
} as const;

type HubNavigationContextValue = {
  page: HubPage;
  offsetX: SharedValue<number>;
  screenWidth: number;
  openConversations: () => void;
  openChat: () => void;
  openSettings: () => void;
  goToPage: (page: HubPage, animated?: boolean) => void;
  setGestureEnabled: (enabled: boolean) => void;
};

const HubNavigationContext = createContext<HubNavigationContextValue | null>(null);

export function useHubNavigation(): HubNavigationContextValue {
  const ctx = useContext(HubNavigationContext);
  if (!ctx) {
    throw new Error("useHubNavigation must be used within HubNavigationProvider");
  }
  return ctx;
}

export function HubNavigationProvider({
  children,
  screenWidth,
  offsetX,
  goToPage,
  page,
  setGestureEnabled,
}: {
  children: React.ReactNode;
  screenWidth: number;
  offsetX: SharedValue<number>;
  goToPage: (page: HubPage, animated?: boolean) => void;
  page: HubPage;
  setGestureEnabled: (enabled: boolean) => void;
}) {
  const value = useMemo(
    () => ({
      page,
      offsetX,
      screenWidth,
      openConversations: () => goToPage(0),
      openChat: () => goToPage(1),
      openSettings: () => goToPage(2),
      goToPage,
      setGestureEnabled,
    }),
    [goToPage, offsetX, page, screenWidth, setGestureEnabled]
  );

  return (
    <HubNavigationContext.Provider value={value}>{children}</HubNavigationContext.Provider>
  );
}

export function hubPageOffset(page: HubPage, screenWidth: number): number {
  "worklet";
  return -page * screenWidth;
}

export function snapHubPage(offset: number, screenWidth: number, velocityX: number): HubPage {
  "worklet";
  const raw = -offset / screenWidth;
  let target = Math.round(raw);
  if (velocityX > 520) {
    target = Math.floor(raw + 0.1);
  } else if (velocityX < -520) {
    target = Math.ceil(raw - 0.12);
  }
  return Math.max(0, Math.min(2, target)) as HubPage;
}
