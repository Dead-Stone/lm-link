/**
 * Opening hero GIF — full-size logo (512×512) + android body + head (-45°).
 * Output: assets/hero-animation.gif
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import {
  ANDROID_HEAD_LOTTIE_REST_FRAME,
  BRAND_MARK_MASTER_SIZE,
  HERO_DUCK_DISTANCE_RATIO,
  HERO_DUCK_END_FRAME,
  HERO_DUCK_PEAK_FRAME,
  HERO_DUCK_START_FRAME,
  composeBrandMarkWithHead,
  headBottomRightAnchor,
  patchTutorialHeadColors,
} from "./brand-compose-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../assets");
const LM_STUDIO_LOGO = path.join(OUT, "lm-studio-logo.png");
const LOTTIE_JSON = path.join(OUT, "android-head-tutorial.json");

/** Same size as lm-studio-android-final.png — keep in sync with lib/brand-mark.ts */
const HERO_SIZE = BRAND_MARK_MASTER_SIZE;
const HERO_SLIDE_DISTANCE_RATIO = 0.42;
const SLIDE_END_FRAME = 42;

/** Opening clip ends at inside rest peek — not the full tutorial look-around (270). */
const LOTTIE_END_FRAME = ANDROID_HEAD_LOTTIE_REST_FRAME;
const LOTTIE_FPS = 60;

const SLIDE_DISTANCE = Math.round(HERO_SIZE * HERO_SLIDE_DISTANCE_RATIO);
const DUCK_DISTANCE = Math.round(HERO_SIZE * HERO_DUCK_DISTANCE_RATIO);
const FRAME_STEP = 3;
const FRAME_DELAY = Math.round((1000 / LOTTIE_FPS) * FRAME_STEP);
const HOLD_FRAMES = 4;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Slide-in offset — both head and body share this (parallel entry along peek diagonal). */
function slideOffset(lottieFrame) {
  const slideT = easeOutCubic(Math.min(lottieFrame / SLIDE_END_FRAME, 1));
  return Math.round((1 - slideT) * SLIDE_DISTANCE);
}

/** Duck into corner during look-down — positive offset tucks outward; return to 0 = inside peek. */
function duckOffset(lottieFrame) {
  if (lottieFrame <= HERO_DUCK_START_FRAME) return 0;

  if (lottieFrame <= HERO_DUCK_PEAK_FRAME) {
    const t = easeInOutCubic((lottieFrame - HERO_DUCK_START_FRAME) / (HERO_DUCK_PEAK_FRAME - HERO_DUCK_START_FRAME));
    return Math.round(t * DUCK_DISTANCE);
  }

  if (lottieFrame < HERO_DUCK_END_FRAME) {
    const t = easeInOutCubic(
      1 - (lottieFrame - HERO_DUCK_PEAK_FRAME) / (HERO_DUCK_END_FRAME - HERO_DUCK_PEAK_FRAME)
    );
    return Math.round(t * DUCK_DISTANCE);
  }

  return 0;
}

function peekOffset(lottieFrame) {
  return slideOffset(lottieFrame) + duckOffset(lottieFrame);
}

function headAnchorForFrame(lottieFrame) {
  const rest = headBottomRightAnchor(HERO_SIZE);
  const off = peekOffset(lottieFrame);
  return { x: rest.x + off, y: rest.y + off };
}

async function buildHeroFrame(lottieFrame, animationData) {
  return composeBrandMarkWithHead({
    targetSize: HERO_SIZE,
    lmStudioLogoPath: LM_STUDIO_LOGO,
    animationData,
    lottieFrame,
    headBrOverride: headAnchorForFrame(lottieFrame),
    includeBody: true,
    applyPlayStoreMask: true,
  });
}

const animationData = patchTutorialHeadColors(JSON.parse(fs.readFileSync(LOTTIE_JSON, "utf8")));

const frames = [];
for (let frame = 0; frame <= LOTTIE_END_FRAME; frame += FRAME_STEP) {
  frames.push(await buildHeroFrame(frame, animationData));
}

/** Brief hold on rest peek — last animated frame is already frame 108. */
const restInsideFrame = frames[frames.length - 1];
for (let i = 0; i < HOLD_FRAMES; i++) {
  frames.push(restInsideFrame);
}

async function writeAnimatedGif(frames, outPath) {
  const delayMs = new Array(frames.length).fill(FRAME_DELAY);
  await sharp(frames, { join: { animated: true } })
    .gif({
      delay: delayMs,
      loop: 1,
      reuse: false,
      effort: 7,
    })
    .toFile(outPath);
}

const outPath = path.join(OUT, "hero-animation.gif");
await writeAnimatedGif(frames, outPath);

const meta = await sharp(outPath, { animated: true }).metadata();
const pages = meta.pages ?? 1;
console.log(
  `hero-animation.gif: ${meta.width}x${meta.pageHeight ?? meta.height}, ${pages} frames ` +
    `(512px, slide 0–${SLIDE_END_FRAME}, end rest ${ANDROID_HEAD_LOTTIE_REST_FRAME}, hold ${HOLD_FRAMES})`
);
