/**
 * Derives launcher icons from assets/lm-studio-android-final.png (canonical brand master).
 * Edit the master PNG directly, then: npm run compose-brand-icons
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { applyBrandMask } from "./brand-compose-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../assets");
const MASTER = path.join(OUT, "lm-studio-android-final.png");
const LISTING_ICON = "play-listing-icon.png";
const LISTING_ICON_SIZE = 512;

/** Android adaptive foreground — keep focal art inside the circular mask (~84%). */
const ADAPTIVE_FOREGROUND_SCALE = 0.84;

const PNG_OPTS = { compressionLevel: 9, palette: true, effort: 10 };

async function loadMaster() {
  if (!fs.existsSync(MASTER)) {
    throw new Error(
      "Missing assets/lm-studio-android-final.png — add the brand master before running compose-brand-icons"
    );
  }
  const meta = await sharp(MASTER).metadata();
  if (!meta.width || !meta.height || meta.width !== meta.height) {
    throw new Error(`Brand master must be square (got ${meta.width}x${meta.height})`);
  }
  return sharp(MASTER).png().toBuffer();
}

async function writeSquarePng(buf, outName, size = 1024) {
  await sharp(buf).resize(size, size, { fit: "fill" }).png(PNG_OPTS).toFile(path.join(OUT, outName));
  console.log(`${outName}: ${size}x${size}`);
}

/** Transparent padded foreground for Android adaptiveIcon (backgroundColor fills the rest). */
async function buildAdaptiveForeground(markBuf, size) {
  const inner = Math.round(size * ADAPTIVE_FOREGROUND_SCALE);
  const scaled = await sharp(markBuf).resize(inner, inner, { fit: "fill" }).png().toBuffer();
  const pad = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left: pad, top: pad }])
    .png(PNG_OPTS)
    .toBuffer();
}

const masterBuf = await loadMaster();
const masterMeta = await sharp(masterBuf).metadata();
console.log(`Source: lm-studio-android-final.png (${masterMeta.width}x${masterMeta.height})`);

const iconSize = 1024;
const iconBuf = await applyBrandMask(masterBuf, iconSize, PNG_OPTS);

for (const name of ["lm-link-icon.png", "brand-logo.png", "icon.png", "splash-icon.png"]) {
  await writeSquarePng(iconBuf, name, iconSize);
}

await writeSquarePng(
  await applyBrandMask(masterBuf, LISTING_ICON_SIZE, PNG_OPTS),
  LISTING_ICON,
  LISTING_ICON_SIZE
);

const adaptiveBuf = await buildAdaptiveForeground(iconBuf, iconSize);
await sharp(adaptiveBuf).toFile(path.join(OUT, "adaptive-icon.png"));
console.log(
  `adaptive-icon.png: ${iconSize}x${iconSize} (${Math.round(ADAPTIVE_FOREGROUND_SCALE * 100)}% safe zone)`
);

const faviconSize = 48;
const faviconBuf = await applyBrandMask(masterBuf, faviconSize, PNG_OPTS);
await sharp(faviconBuf).png(PNG_OPTS).toFile(path.join(OUT, "favicon.png"));
console.log(`favicon.png: ${faviconSize}px`);
console.log("Done — launcher icons derived from lm-studio-android-final.png.");
