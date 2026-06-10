/**
 * README hero — LM Studio mark + Android head rising (opening-splash style).
 * Output: assets/readme-hero.gif
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../assets");
const BASE = path.join(OUT, "lm-studio-logo.png");
const ANDROID_BADGE_PNG = path.join(OUT, "android-badge.png");

const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
const BRAND_BADGE_SIZE_RATIO = 0.35;
const LOGO_EDGE_PADDING_RATIO = 0.09;

const HERO_SIZE = 200;
const CANVAS = 220;
const FRAME_COUNT = 20;
const FRAME_DELAY = 55;
const RISE_PX = 52;

function brandMarkMaskSvgPath(size) {
  const r = size * BRAND_MARK_SQUIRCLE_RATIO;
  return [
    `M ${r} 0`,
    `L ${size - r} 0`,
    `A ${r} ${r} 0 0 1 ${size} ${r}`,
    `L ${size} ${size}`,
    `L ${r} ${size}`,
    `A ${r} ${r} 0 0 1 0 ${size - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

async function applyBrandMask(buf, size) {
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="${brandMarkMaskSvgPath(size)}" fill="white"/></svg>`
  );
  return sharp(buf)
    .resize(size, size, { fit: "fill" })
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function renderLogoCanvas(targetSize) {
  const { width: srcW } = await sharp(BASE).metadata();
  const pad = Math.round(srcW * LOGO_EDGE_PADDING_RATIO);
  const padded = await sharp(BASE)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: "copy" })
    .png()
    .toBuffer();
  return sharp(padded).resize(targetSize, targetSize, { fit: "cover" }).png().toBuffer();
}

async function renderAndroidBadge(badgeSize) {
  return sharp(ANDROID_BADGE_PNG).resize(badgeSize, badgeSize, { fit: "fill" }).png().toBuffer();
}

async function buildLogoOnly() {
  const baseBuf = await renderLogoCanvas(HERO_SIZE);
  return applyBrandMask(baseBuf, HERO_SIZE);
}

async function buildFrame(logoBuf, badgeBuf, progress) {
  const eased = easeOutCubic(progress);
  const offset = Math.round((CANVAS - HERO_SIZE) / 2);
  const badgeSize = badgeBuf.length ? Math.round(HERO_SIZE * BRAND_BADGE_SIZE_RATIO) : 0;
  const badgeLeft = offset + HERO_SIZE - badgeSize;
  const badgeTopFinal = offset + HERO_SIZE - badgeSize;
  const badgeTop = Math.round(badgeTopFinal + (1 - eased) * RISE_PX);

  const composites = [{ input: logoBuf, left: offset, top: offset }];
  if (progress > 0.02) {
    composites.push({ input: badgeBuf, left: badgeLeft, top: badgeTop });
  }

  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

const logoBuf = await buildLogoOnly();
const badgeBuf = await renderAndroidBadge(Math.round(HERO_SIZE * BRAND_BADGE_SIZE_RATIO));

const frames = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  const progress = i / (FRAME_COUNT - 1);
  frames.push(await buildFrame(logoBuf, badgeBuf, progress));
}
// Hold on final frame
frames.push(await buildFrame(logoBuf, badgeBuf, 1));
frames.push(await buildFrame(logoBuf, badgeBuf, 1));

await sharp(frames, { animated: true })
  .gif({ loop: 0, delay: FRAME_DELAY })
  .toFile(path.join(OUT, "readme-hero.gif"));

console.log(`readme-hero.gif: ${CANVAS}px, ${frames.length} frames`);
