import { Easing, WithSpringConfig, WithTimingConfig } from "react-native-reanimated";

/** Snap-back for sheets, rows, and hub panels — soft settle without wobble. */
export const GESTURE_SPRING_SNAP: WithSpringConfig = {
  damping: 28,
  stiffness: 300,
  mass: 0.82,
  overshootClamping: false,
};

/** Row / carousel settle — slightly heavier for list swipes. */
export const GESTURE_SPRING_ROW: WithSpringConfig = {
  damping: 26,
  stiffness: 280,
  mass: 0.9,
  overshootClamping: false,
};

export const GESTURE_TIMING_EXIT: WithTimingConfig = {
  duration: 280,
  easing: Easing.bezier(0.32, 0, 0.67, 0),
};

export const GESTURE_TIMING_ENTER: WithTimingConfig = {
  duration: 320,
  easing: Easing.bezier(0.33, 1, 0.68, 1),
};

const RUBBER_BAND = 0.42;

/** Resistance past a hard limit — iOS-style rubber banding. */
export function rubberBandClamp(value: number, min: number, max: number): number {
  "worklet";
  if (value < min) {
    return min - (min - value) * RUBBER_BAND;
  }
  if (value > max) {
    return max + (value - max) * RUBBER_BAND;
  }
  return value;
}

export function clampTranslation(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

/** Project resting offset from velocity (px/s) for flick-to-snap. */
export function projectTranslation(
  offset: number,
  velocity: number,
  decay = 0.22
): number {
  "worklet";
  return offset + velocity * decay;
}

export function shouldOpenSwipe(
  offset: number,
  velocity: number,
  openThreshold: number,
  velocityThreshold: number,
  direction: 1 | -1
): boolean {
  "worklet";
  if (direction > 0) {
    return offset > openThreshold || velocity > velocityThreshold;
  }
  return offset < -openThreshold || velocity < -velocityThreshold;
}

export function shouldDismissSwipe(
  offset: number,
  velocity: number,
  distanceThreshold: number,
  velocityThreshold: number,
  direction: 1 | -1
): boolean {
  "worklet";
  return shouldOpenSwipe(offset, velocity, distanceThreshold, velocityThreshold, direction);
}
