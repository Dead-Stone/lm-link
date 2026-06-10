/**
 * README hero — LM Studio mark (in place) + android-face-overlay.json Lottie.
 * Matches AppOpeningAnimation: masked logo with animated Android head on top.
 * Output: assets/readme-hero.gif
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { createCanvas } from "canvas";
import { JSDOM } from "jsdom";
import sharp from "sharp";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../assets");
const BASE = path.join(OUT, "lm-studio-logo.png");
const LOTTIE_JSON = path.join(OUT, "android-face-overlay.json");

/** Keep in sync with lib/brand-mark.ts */
const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
const LOGO_EDGE_PADDING_RATIO = 0.09;

/** Keep in sync with components/AppOpeningAnimation.tsx */
const LOTTIE_END_FRAME = 108;
const LOTTIE_FPS = 60;

/** Keep in sync with lib/android-head-lottie.ts */
const ANDROID_HEAD_GREEN = "#00813e";
const ANDROID_HEAD_GREEN_PATHS = ["head", "lid-r", "lid-l", "antena-right", "antena-left"];

const HERO_SIZE = 200;
const CANVAS = 220;
const FRAME_STEP = 3;
const FRAME_DELAY = Math.round((1000 / LOTTIE_FPS) * FRAME_STEP);
const HOLD_FRAMES = 8;

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

function hexToLottieColor(hex) {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
    1,
  ];
}

function patchShapeFills(shapes, color) {
  if (!Array.isArray(shapes)) return;
  for (const shape of shapes) {
    if (shape.ty === "fl" && shape.c?.a === 0) {
      shape.c.k = color;
    }
    if (shape.ty === "gr" && shape.it) {
      patchShapeFills(shape.it, color);
    }
  }
}

function patchLottieHeadColors(animationData, layerNames, hex) {
  const data = structuredClone(animationData);
  const color = hexToLottieColor(hex);
  for (const layer of data.layers ?? []) {
    if (!layerNames.includes(layer.nm)) continue;
    patchShapeFills(layer.shapes, color);
  }
  return data;
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

async function buildLogoLayer() {
  const baseBuf = await renderLogoCanvas(HERO_SIZE);
  return applyBrandMask(baseBuf, HERO_SIZE);
}

let lottieDom;
let lottieAnim;
let lottieContainer;
let lottieSerializer;

function setupLottiePlayer(animationData) {
  if (lottieAnim) return;

  lottieDom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="lottie" style="width:${HERO_SIZE}px;height:${HERO_SIZE}px"></div></body></html>`
  );
  global.window = lottieDom.window;
  global.document = lottieDom.window.document;

  // lottie-web probes canvas support at load time (jsdom has no native 2d context).
  lottieDom.window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (!this._nodeCanvas) {
      this._nodeCanvas = createCanvas(this.width || HERO_SIZE, this.height || HERO_SIZE);
    }
    return this._nodeCanvas.getContext(type);
  };

  const lottie = require("lottie-web");

  lottieContainer = lottieDom.window.document.getElementById("lottie");
  lottieSerializer = new lottieDom.window.XMLSerializer();

  lottieAnim = lottie.loadAnimation({
    container: lottieContainer,
    renderer: "svg",
    loop: false,
    autoplay: false,
    animationData,
  });
}

async function renderLottieFrame(animationData, frame) {
  setupLottiePlayer(animationData);

  if (!lottieAnim.isLoaded) {
    await new Promise((resolve) => {
      lottieAnim.addEventListener("DOMLoaded", resolve, { once: true });
    });
  }

  lottieAnim.goToAndStop(frame, true);

  const svgEl = lottieContainer.querySelector("svg");
  if (!svgEl) {
    throw new Error(`Lottie SVG missing at frame ${frame}`);
  }

  svgEl.setAttribute("width", String(HERO_SIZE));
  svgEl.setAttribute("height", String(HERO_SIZE));

  let svgString = lottieSerializer.serializeToString(svgEl);
  svgString = svgString.replace(/\sxmlns="[^"]*"/g, "");
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return sharp(Buffer.from(svgString)).resize(HERO_SIZE, HERO_SIZE).png().toBuffer();
}

async function buildHeroFrame(logoBuf, lottieBuf) {
  const offset = Math.round((CANVAS - HERO_SIZE) / 2);
  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: logoBuf, left: offset, top: offset },
      { input: lottieBuf, left: offset, top: offset },
    ])
    .png()
    .toBuffer();
}

const logoBuf = await buildLogoLayer();
const animationData = patchLottieHeadColors(
  JSON.parse(fs.readFileSync(LOTTIE_JSON, "utf8")),
  ANDROID_HEAD_GREEN_PATHS,
  ANDROID_HEAD_GREEN
);

const frames = [];
for (let frame = 0; frame <= LOTTIE_END_FRAME; frame += FRAME_STEP) {
  const lottieBuf = await renderLottieFrame(animationData, frame);
  frames.push(await buildHeroFrame(logoBuf, lottieBuf));
}

const finalFrame = frames[frames.length - 1];
for (let i = 0; i < HOLD_FRAMES; i++) {
  frames.push(finalFrame);
}

/** Build a GitHub-safe animated GIF (220×220 logical screen, frames at 0,0). */
async function writeAnimatedGifWithGifsicle(pngPaths, outPath, tmpDir) {
  const delayCentisecs = Math.max(1, Math.round(FRAME_DELAY / 10));
  const gifPaths = [];

  for (let i = 0; i < pngPaths.length; i++) {
    const gifPath = path.join(tmpDir, `frame-${String(i).padStart(3, "0")}.gif`);
    await sharp(pngPaths[i]).gif().toFile(gifPath);
    gifPaths.push(gifPath);
  }

  try {
    execFileSync(
      "gifsicle",
      [
        "--delay",
        String(delayCentisecs),
        "--loopcount",
        "--disposal",
        "2",
        ...gifPaths,
        "-o",
        outPath,
      ],
      { stdio: "pipe" }
    );
  } catch (err) {
    const detail = err?.stderr?.toString?.().trim();
    throw new Error(
      `gifsicle failed while building readme-hero.gif${detail ? `: ${detail}` : ""}. Install with: brew install gifsicle`
    );
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "readme-hero-"));
const framePaths = [];
for (let i = 0; i < frames.length; i++) {
  const framePath = path.join(tmpDir, `frame-${String(i).padStart(3, "0")}.png`);
  fs.writeFileSync(framePath, frames[i]);
  framePaths.push(framePath);
}

const outPath = path.join(OUT, "readme-hero.gif");
await writeAnimatedGifWithGifsicle(framePaths, outPath, tmpDir);
fs.rmSync(tmpDir, { recursive: true, force: true });

const meta = await sharp(outPath, { animated: true }).metadata();
const pages = meta.pages ?? 1;
console.log(
  `readme-hero.gif: ${meta.width}x${meta.pageHeight ?? meta.height}, ${pages} frames (Lottie 0–${LOTTIE_END_FRAME}, step ${FRAME_STEP})`
);
