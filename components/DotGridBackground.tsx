import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../lib/theme";

const SPACING = 14;
const DOT_RADIUS = 1.25;
/** Fully clear core — dark void at center (≈3×3 cells across). */
const VOID_CLEAR_CELLS = 1.75;
/** Wide fade ring (~7×7) — dots dissolve inward toward the void. */
const VOID_FADE_CELLS = 4.35;
const ORBIT_MS = 84000;
/** Min focal drift (px) before recomputing ~1.5k SVG dots on the JS thread. */
const FOCAL_PUBLISH_MIN_DELTA = 8;

type Focal = { cx: number; cy: number; voidR: number };

type Props = {
  /**
   * 0 = calm / user-side energy, 0.5 = idle, 1 = assistant streaming.
   * Drives where the clear center drifts on screen.
   */
  mood?: number;
  /** Pixels from top where dots fade into the chat background. */
  fadeTop?: number;
  /** Pixels from bottom where dots fade into the chat background. */
  fadeBottom?: number;
  /** When false, orbit pauses and dot focal stops updating (saves CPU when blurred). */
  active?: boolean;
};

function buildGrid(width: number, height: number) {
  const cols = Math.ceil(width / SPACING) + 1;
  const rows = Math.ceil(height / SPACING) + 1;
  const points: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({ x: col * SPACING, y: row * SPACING });
    }
  }
  return points;
}

function maxDistToCorner(cx: number, cy: number, width: number, height: number) {
  return Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy)
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function verticalEdgeFade(
  y: number,
  height: number,
  fadeTop: number,
  fadeBottom: number
): number {
  let m = 1;
  if (fadeTop > 0 && y < fadeTop) {
    m = Math.min(m, smoothstep(0, fadeTop, y));
  }
  if (fadeBottom > 0 && y > height - fadeBottom) {
    m = Math.min(m, smoothstep(0, fadeBottom, height - y));
  }
  return m;
}

/** Grid-aware fade — wide neighborhood dissolves into the clear center void. */
function voidEmergence(
  x: number,
  y: number,
  cx: number,
  cy: number,
  spacing: number
): number {
  const cellDist = Math.hypot(x - cx, y - cy) / spacing;
  if (cellDist <= VOID_CLEAR_CELLS) return 0;
  if (cellDist >= VOID_FADE_CELLS) return 1;
  return smoothstep(VOID_CLEAR_CELLS, VOID_FADE_CELLS, cellDist);
}

/** Tunnel falloff: tiny bright dots near void, larger dimmer dots toward edges. */
function tunnelDot(
  x: number,
  y: number,
  cx: number,
  cy: number,
  maxDist: number,
  maxOpacity: number,
  baseRadius: number = DOT_RADIUS
): { r: number; opacity: number } {
  const dist = Math.hypot(x - cx, y - cy);
  const emerge = voidEmergence(x, y, cx, cy, SPACING);
  if (emerge < 0.02) return { r: 0, opacity: 0 };

  const fadeEnd = SPACING * VOID_FADE_CELLS;
  const span = Math.max(1, maxDist - fadeEnd);
  const t = Math.min(1, Math.max(0, (dist - fadeEnd) / span));

  const sizeMul = (0.28 + 0.92 * Math.pow(t, 0.68)) * emerge;
  const centerBand = SPACING * (VOID_FADE_CELLS - VOID_CLEAR_CELLS);
  const centerT = Math.min(
    1,
    Math.max(0, (dist - SPACING * VOID_CLEAR_CELLS) / centerBand)
  );
  const centerScale = 0.3 + 0.7 * Math.pow(centerT, 0.5);
  const r = baseRadius * sizeMul * centerScale;

  const innerGlow = Math.exp(-Math.pow(t / 0.26, 2));
  const edgeDim = 0.018 + 0.04 * Math.pow(t, 0.85);
  const body = Math.min(maxOpacity, innerGlow * 0.16 + edgeDim);
  const opacity = body * emerge * emerge * (3 - 2 * emerge);

  return { r, opacity };
}

function focalFromOrbit(
  orbit: number,
  mood: number,
  width: number,
  height: number
): Focal {
  const t = orbit * Math.PI * 2;
  const moodBiasX = (mood - 0.5) * width * 0.14;
  const moodBiasY = (mood - 0.5) * height * 0.12;
  const driftX = width * 0.12 * Math.cos(t) + width * 0.06 * Math.sin(t * 1.35);
  const driftY = height * 0.1 * Math.sin(t * 0.9) + height * 0.05 * Math.cos(t * 1.6);
  return {
    cx: width * 0.5 + driftX + moodBiasX,
    cy: height * 0.44 + driftY + moodBiasY,
    voidR: SPACING * (VOID_CLEAR_CELLS + mood * 0.12),
  };
}

/** Dot grid with a drifting shallow void — darker at edges, clear center. */
export default function DotGridBackground({
  mood = 0.5,
  fadeTop = 0,
  fadeBottom = 0,
  active = true,
}: Props) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useTheme();
  const maxOpacity = isDark ? 0.11 : 0.09;
  const dotColor = isDark ? "#ffffff" : "#000000";

  const grid = useMemo(() => buildGrid(width, height), [width, height]);

  const moodValue = useSharedValue(mood);
  const orbit = useSharedValue(0);
  const reveal = useSharedValue(0);
  const isActive = useSharedValue(active);
  const [focal, setFocal] = useState<Focal>(() =>
    focalFromOrbit(0, mood, width, height)
  );

  useEffect(() => {
    isActive.value = active;
    if (!active) {
      cancelAnimation(orbit);
      return;
    }
    orbit.value = withRepeat(
      withTiming(1, { duration: ORBIT_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, [active, isActive, orbit]);

  useEffect(() => {
    moodValue.value = withTiming(mood, { duration: 2800, easing: Easing.inOut(Easing.cubic) });
    if (!active) {
      setFocal(focalFromOrbit(orbit.value, mood, width, height));
    }
  }, [active, mood, moodValue, orbit, width, height]);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal, width, height]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
  }));

  const publishFocal = (cx: number, cy: number, voidR: number) => {
    setFocal((prev) => {
      if (
        Math.abs(prev.cx - cx) < 0.5 &&
        Math.abs(prev.cy - cy) < 0.5 &&
        Math.abs(prev.voidR - voidR) < 0.5
      ) {
        return prev;
      }
      return { cx, cy, voidR };
    });
  };

  useAnimatedReaction(
    () => {
      if (!isActive.value) return null;
      const t = orbit.value * Math.PI * 2;
      const m = moodValue.value;
      const moodBiasX = (m - 0.5) * width * 0.14;
      const moodBiasY = (m - 0.5) * height * 0.12;
      const driftX = width * 0.12 * Math.cos(t) + width * 0.06 * Math.sin(t * 1.35);
      const driftY = height * 0.1 * Math.sin(t * 0.9) + height * 0.05 * Math.cos(t * 1.6);
      const cx = width * 0.5 + driftX + moodBiasX;
      const cy = height * 0.44 + driftY + moodBiasY;
      const voidR = SPACING * (VOID_CLEAR_CELLS + m * 0.12);
      return { cx, cy, voidR };
    },
    (next, prev) => {
      if (next === null) return;
      if (prev != null) {
        const dx = Math.abs(next.cx - prev.cx);
        const dy = Math.abs(next.cy - prev.cy);
        if (dx < FOCAL_PUBLISH_MIN_DELTA && dy < FOCAL_PUBLISH_MIN_DELTA) return;
      }
      runOnJS(publishFocal)(next.cx, next.cy, next.voidR);
    },
    [width, height]
  );

  const dots = useMemo(() => {
    const maxDist = maxDistToCorner(focal.cx, focal.cy, width, height);
    const rendered: { key: string; x: number; y: number; r: number; opacity: number }[] = [];

    for (let i = 0; i < grid.length; i += 1) {
      const { x, y } = grid[i];
      const { r, opacity: tunnelOpacity } = tunnelDot(
        x,
        y,
        focal.cx,
        focal.cy,
        maxDist,
        maxOpacity,
        DOT_RADIUS
      );
      const edgeMul = verticalEdgeFade(y, height, fadeTop, fadeBottom);
      const opacity = tunnelOpacity * edgeMul;
      if (opacity < 0.012 || r < 0.08) continue;
      rendered.push({ key: `${x}-${y}`, x, y, r, opacity });
    }

    return rendered;
  }, [grid, focal, width, height, maxOpacity, fadeTop, fadeBottom]);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.canvas, revealStyle]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {dots.map((dot) => (
          <Circle
            key={dot.key}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={dotColor}
            opacity={dot.opacity}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});
