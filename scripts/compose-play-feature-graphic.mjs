/**
 * Play Store feature graphic — 1024×500, 24-bit PNG (no alpha).
 *
 * Follows Google Play guidance:
 * - One clear value headline (5–7 words), minimal text
 * - Focal content in safe zone; decorations at edges
 * - Brand mark as extension of icon (not a duplicate launcher tile)
 * - Vibrant gradient; shows app experience without device frames
 *
 * Output: assets/play-feature-graphic.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets");
const BRAND_LOGO = path.join(OUT, "brand-logo.png");
const FONTS = path.join(ROOT, "node_modules/@expo-google-fonts");

const WIDTH = 1024;
const HEIGHT = 500;

/** Safe-zone padding (Google: keep key art away from edges / crop zones). */
const MARGIN_X = 80;
const MARGIN_Y = 56;

const LOGO_SIZE = 212;
const LOGO_LEFT = MARGIN_X;
const LOGO_TOP = Math.round((HEIGHT - LOGO_SIZE) / 2);

const ANDROID_GREEN = "#3ddc84";
const BG_CORNER = { r: 37, g: 99, b: 235 };

const PNG_OPTS = { compressionLevel: 9, effort: 10, force: true };

function fontDataUrl(relativePath) {
  const abs = path.join(FONTS, relativePath);
  const b64 = fs.readFileSync(abs).toString("base64");
  return `data:font/truetype;charset=utf-8;base64,${b64}`;
}

const FONTS_EMBED = {
  plusJakartaBold: fontDataUrl("plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf"),
  robotoMedium: fontDataUrl("roboto/500Medium/Roboto_500Medium.ttf"),
  interMedium: fontDataUrl("inter/500Medium/Inter_500Medium.ttf"),
};

/** Edge-only motion bars — background decoration per Play guidelines. */
function edgeBarsSvg() {
  const bars = [
    { x: 18, y: 28, w: 96, h: 10, o: 0.09 },
    { x: 42, y: 48, w: 72, h: 8, o: 0.07 },
    { x: 920, y: 36, w: 88, h: 10, o: 0.1 },
    { x: 948, y: 58, w: 58, h: 8, o: 0.08 },
    { x: 8, y: 448, w: 108, h: 10, o: 0.08 },
    { x: 934, y: 432, w: 82, h: 10, o: 0.09 },
    { x: 902, y: 454, w: 114, h: 8, o: 0.07 },
  ];
  return bars
    .map(
      (b) =>
        `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="#ffffff" fill-opacity="${b.o}"/>`
    )
    .join("\n");
}

/** Abstract chat preview — conveys experience without a device frame. */
function chatPreviewSvg() {
  const x = 762;
  return `
  <g opacity="0.95">
    <rect x="${x}" y="108" width="222" height="284" rx="20" fill="#0c0c12" fill-opacity="0.58" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1.5"/>
    <rect x="${x + 20}" y="142" width="148" height="36" rx="14" fill="#5b4fcf" fill-opacity="0.85"/>
    <rect x="${x + 20}" y="156" width="90" height="10" rx="5" fill="#ffffff" fill-opacity="0.35"/>
    <rect x="${x + 80}" y="196" width="168" height="52" rx="14" fill="#16161f" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="${x + 96}" y="212" width="128" height="8" rx="4" fill="#ffffff" fill-opacity="0.22"/>
    <rect x="${x + 96}" y="228" width="96" height="8" rx="4" fill="#ffffff" fill-opacity="0.14"/>
    <rect x="${x + 20}" y="268" width="132" height="36" rx="14" fill="#6366f1" fill-opacity="0.9"/>
    <rect x="${x + 36}" y="282" width="72" height="8" rx="4" fill="#ffffff" fill-opacity="0.4"/>
    <circle cx="${x + 36}" cy="334" r="14" fill="#3ddc84" fill-opacity="0.9"/>
    <rect x="${x + 58}" y="326" width="100" height="8" rx="4" fill="#ffffff" fill-opacity="0.18"/>
    <rect x="${x + 58}" y="340" width="72" height="8" rx="4" fill="#ffffff" fill-opacity="0.12"/>
  </g>
  <g stroke="#ffffff" stroke-opacity="0.28" stroke-width="2" fill="none" stroke-dasharray="6 8">
    <path d="M ${LOGO_LEFT + LOGO_SIZE + 12} ${LOGO_TOP + LOGO_SIZE * 0.55} Q 540 210 700 220"/>
  </g>
  <g transform="translate(658, 308)">
    <rect x="0" y="0" width="52" height="38" rx="6" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1.5"/>
    <rect x="8" y="8" width="36" height="22" rx="3" fill="#ffffff" fill-opacity="0.08"/>
    <rect x="18" y="38" width="16" height="8" rx="2" fill="#ffffff" fill-opacity="0.15"/>
  </g>`;
}

function featureGraphicSvg() {
  const textX = 318;
  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: "Plus Jakarta Sans";
        src: url("${FONTS_EMBED.plusJakartaBold}") format("truetype");
        font-weight: 700;
      }
      @font-face {
        font-family: "Roboto";
        src: url("${FONTS_EMBED.robotoMedium}") format("truetype");
        font-weight: 500;
      }
      @font-face {
        font-family: "Inter";
        src: url("${FONTS_EMBED.interMedium}") format("truetype");
        font-weight: 500;
      }
    </style>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="45%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#5b4fcf"/>
    </linearGradient>
    <radialGradient id="spotL" cx="18%" cy="48%" r="40%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spotR" cx="82%" cy="42%" r="36%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="textFade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#spotL)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#spotR)"/>
  ${edgeBarsSvg()}
  ${chatPreviewSvg()}

  <line x1="${textX}" y1="340" x2="700" y2="340" stroke="url(#textFade)" stroke-width="2"/>

  <text x="${textX}" y="196"
    font-family="Plus Jakarta Sans" font-size="64" font-weight="700"
    fill="#ffffff" letter-spacing="1.1">LM Studio</text>
  <text x="${textX}" y="264"
    font-family="Plus Jakarta Sans" font-size="64" font-weight="700"
    fill="#ffffff" letter-spacing="1.1">on your phone</text>

  <text x="${textX}" y="322"
    font-family="Roboto" font-size="36" font-weight="500"
    fill="#ffffff" fill-opacity="0.92" letter-spacing="0.5">for </text>
  <text x="${textX + 58}" y="322"
    font-family="Roboto" font-size="36" font-weight="500"
    fill="${ANDROID_GREEN}" letter-spacing="0.35">Android</text>

  <text x="${textX}" y="388"
    font-family="Inter" font-size="46" font-weight="500"
    fill="#ffffff" fill-opacity="0.84" letter-spacing="0.15">Private local AI chat</text>
</svg>`
  );
}

if (!fs.existsSync(BRAND_LOGO)) {
  throw new Error("brand-logo.png missing — run: npm run compose-brand-icons");
}

const logoBuf = await sharp(BRAND_LOGO)
  .resize(LOGO_SIZE, LOGO_SIZE, { fit: "fill" })
  .png()
  .toBuffer();

const logoGlow = await sharp(logoBuf)
  .extend({ top: 28, bottom: 28, left: 28, right: 28, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .blur(20)
  .modulate({ brightness: 0.5 })
  .png()
  .toBuffer();

await sharp(featureGraphicSvg())
  .composite([
    { input: logoGlow, left: LOGO_LEFT - 16, top: LOGO_TOP - 6, blend: "over" },
    { input: logoBuf, left: LOGO_LEFT, top: LOGO_TOP },
  ])
  .flatten({ background: BG_CORNER })
  .png(PNG_OPTS)
  .toFile(path.join(OUT, "play-feature-graphic.png"));

console.log(`play-feature-graphic.png: ${WIDTH}x${HEIGHT} (24-bit, Play Store optimized)`);
