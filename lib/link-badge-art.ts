/** Badge overlay — size/position relative to LM Studio logo canvas. Raster: Android robot head PNG */
export const LINK_BADGE_SIZE_RATIO = 0.35;
/** Android face on the opening splash (bottom-right corner). */
export const ANDROID_OPENING_BADGE_RATIO = 0.36;
/** Inset from the bottom-right corner — keeps the full link inside the logo bounds. */
export const LINK_BADGE_INSET_RATIO = 0.025;
/** Flush to the mark edge on the opening splash. */
export const ANDROID_OPENING_BADGE_INSET_RATIO = 0;

/** @deprecated Legacy link overlay */
export const LINK_LOTTIE_CANVAS = 300;
export const LINK_LOTTIE_WIDTH_RATIO = 140 / LINK_LOTTIE_CANVAS;

export function linkBadgePx(
  logoBox: number,
  ratio: number = LINK_BADGE_SIZE_RATIO
): number {
  return Math.round(logoBox * ratio);
}

export function linkBadgeInsetPx(
  logoBox: number,
  ratio: number = LINK_BADGE_INSET_RATIO
): number {
  return Math.round(logoBox * ratio);
}

/** Lottie view size so on-screen art matches the Android badge at the same logo scale. */
export function linkLottieOverlayPx(
  logoBox: number,
  ratio: number = LINK_BADGE_SIZE_RATIO
): number {
  return Math.round(linkBadgePx(logoBox, ratio) / LINK_LOTTIE_WIDTH_RATIO);
}

/** Approx. bottom-right of link art in the Lottie canvas (end pose). */
const LINK_LOTTIE_ART_BR_X = 212 / LINK_LOTTIE_CANVAS;
const LINK_LOTTIE_ART_BR_Y = 222 / LINK_LOTTIE_CANVAS;
/** Fine-tune toward the corner after center-pull (opening animation). */
export const LINK_LOTTIE_CORNER_NUDGE_RATIO = 0.028;
/** Pull Lottie art toward logo center so the chain nearly meets the white bars. */
export const LINK_LOTTIE_CENTER_PULL_RATIO = 0.027;

export type LinkLottieOverlayLayout = {
  linkSize: number;
  right: number;
  bottom: number;
  translateX: number;
  translateY: number;
  /** Entrance slide — starts this many px toward logo center. */
  entranceShift: number;
};

/** Lottie canvas — assets/android-face-overlay.json (face anchored bottom-right). */
export const ANDROID_LOTTIE_CANVAS = 1080;
/** Drawn face width ÷ canvas width (opening splash, bottom-right badge). */
export const ANDROID_LOTTIE_WIDTH_RATIO = 152 / ANDROID_LOTTIE_CANVAS;
const ANDROID_LOTTIE_ART_BR_X = 941 / ANDROID_LOTTIE_CANVAS;
const ANDROID_LOTTIE_ART_BR_Y = 941 / ANDROID_LOTTIE_CANVAS;

export function androidLottieOverlayPx(
  logoBox: number,
  ratio: number = LINK_BADGE_SIZE_RATIO
): number {
  return Math.round(linkBadgePx(logoBox, ratio) / ANDROID_LOTTIE_WIDTH_RATIO);
}

/** Position Android face Lottie on the LM Studio logo bottom-right (matches link overlay math). */
export function androidLottieOverlayLayout(
  logoBox: number,
  ratio: number = LINK_BADGE_SIZE_RATIO,
  insetRatio: number = LINK_BADGE_INSET_RATIO
): LinkLottieOverlayLayout {
  const linkSize = androidLottieOverlayPx(logoBox, ratio);
  const inset = linkBadgeInsetPx(logoBox, insetRatio);
  const nudge = Math.round(logoBox * LINK_LOTTIE_CORNER_NUDGE_RATIO);
  const pull = Math.round(logoBox * LINK_LOTTIE_CENTER_PULL_RATIO);
  const translateX =
    Math.round(linkSize * (1 - ANDROID_LOTTIE_ART_BR_X)) + nudge - pull;
  const translateY =
    Math.round(linkSize * (1 - ANDROID_LOTTIE_ART_BR_Y)) + nudge - pull;
  return {
    linkSize,
    right: inset - nudge + pull,
    bottom: inset - nudge + pull,
    translateX,
    translateY,
    entranceShift: Math.round(logoBox * 0.045),
  };
}

/** Position + in-view offset so Lottie chain sits on the raster badge corner. */
export function linkLottieOverlayLayout(
  logoBox: number,
  ratio: number = LINK_BADGE_SIZE_RATIO
): LinkLottieOverlayLayout {
  const linkSize = linkLottieOverlayPx(logoBox, ratio);
  const inset = linkBadgeInsetPx(logoBox);
  const nudge = Math.round(logoBox * LINK_LOTTIE_CORNER_NUDGE_RATIO);
  const pull = Math.round(logoBox * LINK_LOTTIE_CENTER_PULL_RATIO);
  const translateX = Math.round(linkSize * (1 - LINK_LOTTIE_ART_BR_X)) + nudge - pull;
  const translateY = Math.round(linkSize * (1 - LINK_LOTTIE_ART_BR_Y)) + nudge - pull;
  return {
    linkSize,
    right: inset - nudge + pull,
    bottom: inset - nudge + pull,
    translateX,
    translateY,
    entranceShift: Math.round(logoBox * 0.045),
  };
}

/** Standalone link badge SVG (bordered plate + 3D chain links). Used by icon compose script. */
export const LINK_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <defs>
    <linearGradient id="badgeFill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="55%" stop-color="#F8F5FF"/>
      <stop offset="100%" stop-color="#E9E3FF"/>
    </linearGradient>
    <linearGradient id="badgeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#DDD6FE"/>
      <stop offset="45%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#6D5BB8"/>
    </linearGradient>
    <linearGradient id="ringFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="45%" stop-color="#F2EEFF"/>
      <stop offset="100%" stop-color="#D4CBFF"/>
    </linearGradient>
    <linearGradient id="ringEdge" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B8A8F0"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="ringInner" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#9B8AD8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#6E5BB8" stop-opacity="0.25"/>
    </linearGradient>
    <filter id="linkGroundShadow" x="-50%" y="-30%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur"/>
      <feOffset in="blur" dx="0" dy="5" result="offsetBlur"/>
      <feFlood flood-color="#12081F" flood-opacity="0.42" result="shadowColor"/>
      <feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow"/>
    </filter>
    <filter id="linkShadow" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#12081F" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="4" stdDeviation="3.8" flood-color="#2A1A5C" flood-opacity="0.52"/>
      <feDropShadow dx="0" dy="7" stdDeviation="2.2" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <circle cx="48" cy="48" r="45" fill="url(#badgeFill)"/>
  <circle cx="48" cy="48" r="45" fill="none" stroke="url(#badgeBorder)" stroke-width="3.4"/>
  <ellipse cx="50" cy="58" rx="26" ry="9.5" fill="#12081F" opacity="0.24" filter="url(#linkGroundShadow)"/>
  <g filter="url(#linkShadow)" transform="translate(48 48) scale(0.76) translate(-48 -48) rotate(-38 48 48)">
    <ellipse cx="34" cy="52" rx="17" ry="11" fill="url(#ringFace)" stroke="url(#ringEdge)" stroke-width="3.2"/>
    <ellipse cx="34" cy="52" rx="9.5" ry="5.5" fill="url(#ringInner)"/>
    <ellipse cx="58" cy="40" rx="17" ry="11" fill="url(#ringFace)" stroke="url(#ringEdge)" stroke-width="3.2"/>
    <ellipse cx="58" cy="40" rx="9.5" ry="5.5" fill="url(#ringInner)"/>
    <path d="M44 47 C48 44 52 42 56 40" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
    <path d="M30 50 C28 48 28 45 30 43" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
  </g>
</svg>`;
