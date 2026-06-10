/**
 * Builds launcher icons — LM Studio logo + Android robot badge (bottom-right, flush).
 * App-icon mask: three squircle corners + one sharp corner at bottom-right.
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../assets");
const BASE = path.join(OUT, "lm-studio-logo.png");
const ANDROID_BADGE_PNG = path.join(OUT, "android-badge.png");

/** Keep in sync with lib/brand-mark.ts */
const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
/** Keep in sync with lib/link-badge-art.ts */
const BRAND_BADGE_SIZE_RATIO = 0.35;
/** Flush to bottom-right — keep in sync with lib/brand-mark.ts */
const BRAND_BADGE_INSET_RATIO = 0;
const LOGO_EDGE_PADDING_RATIO = 0.09;
/**
 * Android adaptive icon — keep the sharp bottom-right (badge corner) inside the
 * ~66% launcher safe circle: max side ≈ safeRadius × √2.
 */
const ADAPTIVE_SAFE_ZONE_RADIUS_RATIO = 0.33;

const PNG_OPTS = { compressionLevel: 9, palette: true, effort: 10 };

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

async function applyBrandMask(buf, size) {
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="${brandMarkMaskSvgPath(size)}" fill="white"/></svg>`
  );
  return sharp(buf)
    .resize(size, size, { fit: "fill" })
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png(PNG_OPTS)
    .toBuffer();
}

/** Square android-badge.png — head bottom-right in slot (source asset, not generated). */
async function renderAndroidBadge(badgeSize) {
  return sharp(ANDROID_BADGE_PNG)
    .resize(badgeSize, badgeSize, { fit: "fill" })
    .png(PNG_OPTS)
    .toBuffer();
}

async function renderLogoCanvas(targetSize) {
  const { width: srcW } = await sharp(BASE).metadata();
  const pad = Math.round(srcW * LOGO_EDGE_PADDING_RATIO);

  const padded = await sharp(BASE)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: "copy" })
    .png()
    .toBuffer();

  return sharp(padded)
    .resize(targetSize, targetSize, { fit: "cover" })
    .png()
    .toBuffer();
}

/** LM Studio logo with Android badge on the sharp bottom-right corner. */
async function buildBrandLogo(targetSize) {
  const baseBuf = await renderLogoCanvas(targetSize);

  const badgeSize = Math.round(targetSize * BRAND_BADGE_SIZE_RATIO);
  const inset = Math.round(targetSize * BRAND_BADGE_INSET_RATIO);
  const badgeBuf = await renderAndroidBadge(badgeSize);

  const badgeLeft = targetSize - badgeSize - inset;
  const badgeTop = targetSize - badgeSize - inset;

  const composited = await sharp(baseBuf)
    .composite([{ input: badgeBuf, left: badgeLeft, top: badgeTop }])
    .png(PNG_OPTS)
    .toBuffer();

  return applyBrandMask(composited, targetSize);
}

async function writeSquarePng(buf, outName, size = 1024) {
  const out = await sharp(buf).resize(size, size, { fit: "fill" }).png(PNG_OPTS).toBuffer();
  await sharp(out).toFile(path.join(OUT, outName));
  console.log(`${outName}: ${size}x${size}`);
}

const masterSize = 1024;
const masterBuf = await buildBrandLogo(masterSize);

for (const name of [
  "lm-link-icon.png",
  "brand-logo.png",
  "icon.png",
  "splash-icon.png",
  "play-store-icon.png",
]) {
  await writeSquarePng(masterBuf, name);
}

const adaptiveSize = 1024;
const adaptiveSafeRadius = adaptiveSize * ADAPTIVE_SAFE_ZONE_RADIUS_RATIO;
const contentSize = Math.round(adaptiveSafeRadius * Math.SQRT2);
const adaptiveContent = await buildBrandLogo(contentSize);
const offset = Math.round((adaptiveSize - contentSize) / 2);

await sharp({
  create: {
    width: adaptiveSize,
    height: adaptiveSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: adaptiveContent, left: offset, top: offset }])
  .png(PNG_OPTS)
  .toFile(path.join(OUT, "adaptive-icon.png"));

console.log(
  `adaptive-icon.png: ${adaptiveSize}px, content ${contentSize}px @ (${offset}, ${offset})`
);

const faviconSize = 48;
const faviconBuf = await buildBrandLogo(faviconSize);
await sharp(faviconBuf).png(PNG_OPTS).toFile(path.join(OUT, "favicon.png"));
console.log(`favicon.png: ${faviconSize}px`);
console.log("Done — Android head bottom-right, flush to edges.");
