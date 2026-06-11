import { ViewStyle } from "react-native";

/** Canonical brand master — edit assets/lm-studio-android-final.png; derive launcher icons: npm run compose-brand-icons */
export const BRAND_MARK_SOURCE = "lm-studio-android-final.png";
export const BRAND_MARK_MASTER_SIZE = 512;

/** Android body slab — rendered in static logos and hero GIF (rest pose). */
export const ANDROID_BODY_RECT = {
  x: 315 / 512,
  y: 370 / 512,
  w: 146 / 512,
  h: 91 / 512,
} as const;

/** Head fill. Keep in sync with scripts/brand-compose-shared.mjs */
export const ANDROID_HEAD_GREEN = "#208346";

/** @deprecated Use ANDROID_HEAD_GREEN */
export const ANDROID_BODY_GREEN = ANDROID_HEAD_GREEN;

/** Gap between head and body inner edge (px at 512 master). */
/** Gap at neck cut — match reference art (px at 512 master). */
export const ANDROID_BODY_GAP_PX = 9;
export const ANDROID_BODY_WIDTH_EXTRA_PX = 0;
/** Body height at 512 master — mostly off-screen along peek diagonal. */
export const ANDROID_BODY_HEIGHT_PX = 200;

/**
 * Android head on master canvas — bottom-right corner flush, -45° peek.
 * Keep in sync with scripts/brand-compose-shared.mjs
 */
export const ANDROID_HEAD_DRAW_RATIO = 0.41;
export const ANDROID_HEAD_ROTATION_DEG = -45;
/** >1 nudges head+body peek toward corner, away from logo center. */
export const ANDROID_HEAD_BR_ANCHOR = { x: 1.018, y: 1.018 } as const;
export const ANDROID_HEAD_LOTTIE_REST_FRAME = 108;
/** Full tutorial — side glances (60–165) + look down (225–270). */
export const ANDROID_HEAD_LOTTIE_END_FRAME = 270;

/** Hero GIF timing — keep in sync with compose-readme-hero.mjs + AppOpeningAnimation.tsx */
export const HERO_GIF_FRAME_STEP = 3;
export const HERO_GIF_HOLD_FRAMES = 4;
export const HERO_GIF_LOTTIE_END_FRAME = ANDROID_HEAD_LOTTIE_REST_FRAME;
export const HERO_GIF_FRAME_DELAY_MS = Math.round((1000 / 60) * HERO_GIF_FRAME_STEP);
export const HERO_GIF_ANIMATED_FRAMES =
  Math.floor(HERO_GIF_LOTTIE_END_FRAME / HERO_GIF_FRAME_STEP) + 1;
export const HERO_GIF_PLAY_MS =
  (HERO_GIF_ANIMATED_FRAMES + HERO_GIF_HOLD_FRAMES) * HERO_GIF_FRAME_DELAY_MS;

/** Hero GIF — full logo size (512×512). Keep in sync with compose-readme-hero.mjs */
export const HERO_SIZE = BRAND_MARK_MASTER_SIZE;
export const HERO_HEAD_DRAW_RATIO = ANDROID_HEAD_DRAW_RATIO;
export const HERO_HEAD_ROTATION_DEG = ANDROID_HEAD_ROTATION_DEG;
export const HERO_HEAD_BR_ANCHOR = ANDROID_HEAD_BR_ANCHOR;
/** Hero duck — head+body move together during look-down (gap stays fixed). */
export const HERO_DUCK_START_FRAME = 225;
export const HERO_DUCK_PEAK_FRAME = 253;
export const HERO_DUCK_END_FRAME = 270;
export const HERO_DUCK_DISTANCE_RATIO = 0.075;
export const HERO_SLIDE_DISTANCE_RATIO = 0.42;

/** iOS-style squircle on all four corners. */
export const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
/** Nudge badge off the bottom-right edge so the full head survives launcher masks. */
export const BRAND_MARK_BADGE_INSET_RATIO = 0.028;
/** Breathing room inside the square badge slot (wide head asset is flush to its edges). */
export const ANDROID_BADGE_SLOT_PAD_RATIO = 0.05;
/** android-badge.png — height ÷ width (wide asset; bottom-align in square slot). */
export const ANDROID_HEAD_HEIGHT_RATIO = 718 / 1280;

export type BrandMarkCornerMask = Pick<
  ViewStyle,
  | "borderTopLeftRadius"
  | "borderTopRightRadius"
  | "borderBottomLeftRadius"
  | "borderBottomRightRadius"
>;

/** App icon mask — four curved corners (full squircle). */
export function brandMarkCornerMask(box: number): BrandMarkCornerMask {
  const r = box * BRAND_MARK_SQUIRCLE_RATIO;
  return {
    borderTopLeftRadius: r,
    borderTopRightRadius: r,
    borderBottomLeftRadius: r,
    borderBottomRightRadius: r,
  };
}

/** SVG clip path (white fill) for raster icon compose — same geometry as {@link brandMarkCornerMask}. */
export function brandMarkMaskSvgPath(size: number): string {
  const r = size * BRAND_MARK_SQUIRCLE_RATIO;
  const w = size;
  const h = size;
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

/** Scale head bottom-right anchor from master (512) to any canvas size. */
export function androidHeadBottomRightAnchor(canvasSize: number): { x: number; y: number } {
  return {
    x: Math.round(canvasSize * ANDROID_HEAD_BR_ANCHOR.x),
    y: Math.round(canvasSize * ANDROID_HEAD_BR_ANCHOR.y),
  };
}
