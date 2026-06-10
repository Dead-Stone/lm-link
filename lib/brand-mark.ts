import { ViewStyle } from "react-native";

/** iOS-style squircle on three corners. */
export const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
/** Sharp bottom-right corner where the Android badge sits. */
export const BRAND_MARK_SHARP_RATIO = 0.036;
/** Android badge flush to the bottom-right mark edge. */
export const BRAND_MARK_BADGE_INSET_RATIO = 0;
/** android-badge.png — height ÷ width (wide asset; bottom-align in square slot). */
export const ANDROID_HEAD_HEIGHT_RATIO = 718 / 1280;
export type BrandMarkCornerMask = Pick<
  ViewStyle,
  | "borderTopLeftRadius"
  | "borderTopRightRadius"
  | "borderBottomLeftRadius"
  | "borderBottomRightRadius"
>;

/** App icon mask — three curved corners, one sharp corner at bottom-right. */
export function brandMarkCornerMask(box: number): BrandMarkCornerMask {
  const r = box * BRAND_MARK_SQUIRCLE_RATIO;
  const sharp = Math.max(4, Math.round(box * BRAND_MARK_SHARP_RATIO));
  return {
    borderTopLeftRadius: r,
    borderTopRightRadius: r,
    borderBottomLeftRadius: r,
    borderBottomRightRadius: sharp,
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
    `L ${w} ${h}`,
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}
