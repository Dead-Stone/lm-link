import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEventListener,
} from "react-native";

export type KeyboardVisibilityHandler = (visible: boolean, height: number) => void;

export type KeyboardInset = {
  /** Reported keyboard height (0 when hidden). */
  keyboardHeight: number;
  /**
   * How far a bottom-docked view must lift to sit above the keyboard.
   * ~0 when Android `adjustResize` already shrank the window; ~keyboardHeight otherwise.
   */
  composerLift: number;
};

function measureComposerLift(screenY: number): number {
  const windowHeight = Dimensions.get("window").height;
  return Math.max(0, Math.round(windowHeight - screenY));
}

/** Tracks keyboard height and how much to manually lift a bottom-docked composer. */
export function useKeyboardInset(
  onVisibilityChange?: KeyboardVisibilityHandler
): KeyboardInset {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerLift, setComposerLift] = useState(0);
  const keyboardScreenYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const handlerRef = useRef(onVisibilityChange);
  handlerRef.current = onVisibilityChange;

  const syncLift = useCallback((height: number, screenY: number) => {
    keyboardHeightRef.current = height;
    keyboardScreenYRef.current = screenY;
    setKeyboardHeight(height);
    setComposerLift(measureComposerLift(screenY));
  }, []);

  useEffect(() => {
    const onShow: KeyboardEventListener = (event) => {
      const { height, screenY } = event.endCoordinates;
      syncLift(height, screenY);
      handlerRef.current?.(true, height);
    };
    const onHide: KeyboardEventListener = () => {
      keyboardScreenYRef.current = 0;
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      setComposerLift(0);
      handlerRef.current?.(false, 0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    const dimSub = Dimensions.addEventListener("change", () => {
      if (keyboardScreenYRef.current > 0) {
        setComposerLift(measureComposerLift(keyboardScreenYRef.current));
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      dimSub?.remove();
    };
  }, [syncLift]);

  return { keyboardHeight, composerLift };
}

/** @deprecated Prefer `useKeyboardInset`. */
export function useKeyboardHeight(onVisibilityChange?: KeyboardVisibilityHandler): number {
  return useKeyboardInset(onVisibilityChange).keyboardHeight;
}

/**
 * Extra bottom lift when the keyboard is open (e.g. settings scroll padding).
 * Pass `composerLift` from `useKeyboardInset` to avoid double-counting on Android resize.
 */
export function keyboardLift(keyboardHeight: number, composerLift?: number): number {
  const lift = composerLift ?? keyboardHeight;
  return lift > 0 ? lift : 0;
}

const COMPOSER_DOCK_GAP = 10;

/** Bottom offset for an absolutely positioned composer dock. */
export function composerDockBottom(
  safeAreaBottom: number,
  keyboardHeight: number,
  composerLift: number,
  gap = COMPOSER_DOCK_GAP
): number {
  if (keyboardHeight <= 0) return safeAreaBottom + gap;
  return composerLift + gap;
}

/** Footer / input bar padding — avoids home-indicator inset stacking on top of the keyboard. */
export function footerBottomPadding(
  safeAreaBottom: number,
  keyboardHeight: number,
  extra = 4
): number {
  return keyboardHeight > 0 ? extra : safeAreaBottom + extra;
}
