/**
 * Shared brand-mark composition — LM Studio background + android head (tutorial Lottie).
 * Dimensions calibrated from assets/lm-studio-android-final.png (512×512 master).
 * Keep in sync with lib/brand-mark.ts
 */
import { createRequire } from "module";
import { createCanvas } from "canvas";
import { JSDOM } from "jsdom";
import sharp from "sharp";

const require = createRequire(import.meta.url);

export const BRAND_MARK_MASTER_SIZE = 512;
export const BRAND_MARK_SQUIRCLE_RATIO = 0.2237;
export const LOGO_EDGE_PADDING_RATIO = 0.09;

/** Head placement on 512×512 master (from lm-studio-android-final.png, body ignored). */
export const ANDROID_HEAD_DRAW_RATIO = 0.41;
export const ANDROID_HEAD_ROTATION_DEG = -45;
/** Head art anchor — 1.0 = flush; >1 nudges peek further into corner (away from logo center). */
export const ANDROID_HEAD_BR_ANCHOR = { x: 1.018, y: 1.018 };
export const ANDROID_HEAD_GREEN = "#208346";
export const ANDROID_HEAD_LOTTIE_REST_FRAME = 108;
/** Full tutorial timeline — side glances + look down (eyes @ 225–270). */
export const ANDROID_HEAD_LOTTIE_END_FRAME = 270;

/** Body slab — -45°, width matches head neck, extends off-screen along peek diagonal. */
/** Body height at 512 master — extends off-screen; only a sliver stays visible. */
export const ANDROID_BODY_HEIGHT_PX = 200;
export const ANDROID_BODY_ROTATION_DEG = -45;
/** Gap between head neck cut and body — match reference (~8–11px at 512 along peek). */
export const ANDROID_BODY_GAP_PX = 9;
/** Body width = measured neck cut (no extra — aligned with head at gap). */
export const ANDROID_BODY_WIDTH_EXTRA_PX = 0;

/** Hero duck — body leads head along peek diagonal during look-down (Lottie frames). */
export const HERO_DUCK_START_FRAME = 225;
export const HERO_DUCK_PEAK_FRAME = 253;
export const HERO_DUCK_END_FRAME = 270;
export const HERO_DUCK_DISTANCE_RATIO = 0.075;

export const ANDROID_HEAD_LOTTIE_PATHS = [
  "head",
  "lid-r",
  "lid-l",
  "antena-right",
  "antena-left",
];

export function brandMarkMaskSvgPath(size) {
  const r = size * BRAND_MARK_SQUIRCLE_RATIO;
  return [
    `M ${r} 0`,
    `L ${size - r} 0`,
    `A ${r} ${r} 0 0 1 ${size} ${r}`,
    `L ${size} ${size - r}`,
    `A ${r} ${r} 0 0 1 ${size - r} ${size}`,
    `L ${r} ${size}`,
    `A ${r} ${r} 0 0 1 0 ${size - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

export function headDrawPx(canvasSize) {
  return Math.round(canvasSize * ANDROID_HEAD_DRAW_RATIO);
}

export function headBottomRightAnchor(canvasSize) {
  return {
    x: Math.round(canvasSize * ANDROID_HEAD_BR_ANCHOR.x),
    y: Math.round(canvasSize * ANDROID_HEAD_BR_ANCHOR.y),
  };
}

export function bodyGapPx(canvasSize) {
  return Math.round((ANDROID_BODY_GAP_PX * canvasSize) / BRAND_MARK_MASTER_SIZE);
}

export function bodyWidthExtraPx(canvasSize) {
  return Math.round((ANDROID_BODY_WIDTH_EXTRA_PX * canvasSize) / BRAND_MARK_MASTER_SIZE);
}

export function bodyHeightPx(canvasSize) {
  return Math.max(Math.round((ANDROID_BODY_HEIGHT_PX * canvasSize) / BRAND_MARK_MASTER_SIZE), 4);
}

export function headCompositeBox(headBr, headWidth, headHeight) {
  return {
    left: Math.round(headBr.x - headWidth),
    top: Math.round(headBr.y - headHeight),
  };
}

/** Place head so visible art bottom-right sits on headBr (flush to canvas corner). */
export function headCompositeFromArtAnchor(headBr, headArt) {
  return {
    left: Math.round(headBr.x - headArt.artMaxX),
    top: Math.round(headBr.y - headArt.artMaxY),
  };
}

/** Visible green head art bounds inside the rotated head PNG (excludes antenna padding). */
function isHeadGreen(data, w, c, x, y) {
  if (x < 0 || y < 0) return false;
  const i = (y * w + x) * c;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  return a > 40 && g > 80 && g > r && g > b;
}

function measureNeckAttach(data, w, h, c, minX, maxX, minY, maxY, artWidth, artHeight) {
  const cutPoints = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (
        isHeadGreen(data, w, c, x, y) &&
        !isHeadGreen(data, w, c, x + 1, y + 1) &&
        isHeadGreen(data, w, c, x - 1, y - 1)
      ) {
        cutPoints.push({ x, y, p: x + y, q: x - y });
      }
    }
  }

  if (cutPoints.length === 0) {
    return {
      baseX: (minX + maxX) / 2,
      baseY: maxY,
      neckWidth: maxX - minX + 1,
    };
  }

  /** Flat neck segment on the peek corner side of the rotated head. */
  const cornerCuts = cutPoints.filter(
    (pt) =>
      pt.x >= minX + artWidth * 0.35 &&
      pt.y >= minY + artHeight * 0.35 &&
      pt.x <= maxX &&
      pt.y <= maxY
  );
  const pool = cornerCuts.length > 0 ? cornerCuts : cutPoints;
  const minP = Math.min(...pool.map((pt) => pt.p));
  const neckLine = pool.filter((pt) => pt.p <= minP + 2);
  const line = neckLine.length > 0 ? neckLine : pool;

  let minQ = w;
  let maxQ = 0;
  let sumX = 0;
  let sumY = 0;
  for (const pt of line) {
    if (pt.q < minQ) minQ = pt.q;
    if (pt.q > maxQ) maxQ = pt.q;
    sumX += pt.x;
    sumY += pt.y;
  }

  const neckWidth =
    maxQ >= minQ ? Math.max(Math.round((maxQ - minQ) / Math.SQRT2), 4) : maxX - minX + 1;

  return {
    baseX: sumX / line.length,
    baseY: sumY / line.length,
    neckWidth,
  };
}

export async function measureHeadArtBounds(headPngBuffer) {
  const { data, info } = await sharp(headPngBuffer).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const c = info.channels;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 40 && g > 80 && g > r && g > b) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) {
    return {
      artWidth: w,
      artHeight: h,
      neckWidth: w,
      artMinX: 0,
      artMinY: 0,
      artMaxX: w,
      artMaxY: h,
      baseX: w / 2,
      baseY: h,
    };
  }

  const artWidth = maxX - minX + 1;
  const artHeight = maxY - minY + 1;
  const neck = measureNeckAttach(data, w, h, c, minX, maxX, minY, maxY, artWidth, artHeight);

  return {
    artWidth,
    artHeight,
    neckWidth: neck.neckWidth,
    artMinX: minX,
    artMinY: minY,
    artMaxX: maxX,
    artMaxY: maxY,
    /** Flat neck cut center in head-local px — body attaches here toward peek corner. */
    baseX: neck.baseX,
    baseY: neck.baseY,
  };
}

export function bodyLayoutForHead(canvasSize, headBr, headArt, extraAlongPeek = 0) {
  const bodyW = (headArt.neckWidth ?? headArt.artWidth) + bodyWidthExtraPx(canvasSize);
  const bodyH = bodyHeightPx(canvasSize);
  const gap = bodyGapPx(canvasSize);

  const headLeft = headBr.x - headArt.artMaxX;
  const headTop = headBr.y - headArt.artMaxY;
  const attachX = headLeft + headArt.baseX;
  const attachY = headTop + headArt.baseY;

  /** Peek diagonal (+x, +y) — gap is constant px from attach to body inner edge. */
  const peekUx = Math.SQRT1_2;
  const peekUy = Math.SQRT1_2;
  const along = gap + bodyH / 2 + extraAlongPeek;

  return {
    cx: attachX + peekUx * along,
    cy: attachY + peekUy * along,
    width: bodyW,
    height: bodyH,
  };
}

export async function renderBodyRectPng(canvasSize, headBr, headArt, extraAlongPeek = 0) {
  const { cx, cy, width, height } = bodyLayoutForHead(
    canvasSize,
    headBr,
    headArt,
    extraAlongPeek
  );
  const svg = Buffer.from(
    `<svg width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">` +
      `<g transform="rotate(${ANDROID_BODY_ROTATION_DEG} ${cx} ${cy})">` +
      `<rect x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" ` +
      `fill="${ANDROID_HEAD_GREEN}" rx="1"/></g></svg>`
  );
  return sharp(svg).png().toBuffer();
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

export function patchTutorialHeadColors(animationData, hex = ANDROID_HEAD_GREEN) {
  const data = structuredClone(animationData);
  const color = hexToLottieColor(hex);
  for (const layer of data.layers ?? []) {
    if (!ANDROID_HEAD_LOTTIE_PATHS.includes(layer.nm)) continue;
    patchShapeFills(layer.shapes, color);
  }
  return data;
}

export async function applyBrandMask(buf, size, pngOpts = {}) {
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="${brandMarkMaskSvgPath(size)}" fill="white"/></svg>`
  );
  return sharp(buf)
    .resize(size, size, { fit: "fill" })
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png(pngOpts)
    .toBuffer();
}

/** LM Studio PNG background — resize only, no SVG mask or padding. */
export async function buildLmStudioBackground(size, lmStudioLogoPath) {
  return sharp(lmStudioLogoPath).resize(size, size, { fit: "fill" }).png().toBuffer();
}

let cachedRestHeadMeta = null;

/** Stable head bbox at rest pose — body uses this so Lottie blink/antenna don't jitter the slab. */
export async function getRestHeadMeta(animationData, canvasSize) {
  if (
    cachedRestHeadMeta &&
    cachedRestHeadMeta.canvasSize === canvasSize &&
    cachedRestHeadMeta.frame === ANDROID_HEAD_LOTTIE_REST_FRAME
  ) {
    return cachedRestHeadMeta;
  }
  const headRotated = await renderTutorialHeadPng(
    animationData,
    ANDROID_HEAD_LOTTIE_REST_FRAME,
    canvasSize
  );
  const meta = await sharp(headRotated).metadata();
  const art = await measureHeadArtBounds(headRotated);
  cachedRestHeadMeta = {
    canvasSize,
    frame: ANDROID_HEAD_LOTTIE_REST_FRAME,
    width: meta.width,
    height: meta.height,
    art,
  };
  return cachedRestHeadMeta;
}

let lottieDom;
let lottieAnim;
let lottieContainer;
let lottieSerializer;
let lottieDrawSize;
let lottieModule;

const LOTTIE_WEB_PATH = require.resolve("lottie-web");

function installBrowserGlobals(dom, drawSize) {
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  if (typeof global.navigator === "undefined") {
    Object.defineProperty(global, "navigator", {
      value: window.navigator,
      configurable: true,
      writable: true,
    });
  }

  window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (!this._nodeCanvas) {
      this._nodeCanvas = createCanvas(this.width || drawSize, this.height || drawSize);
    }
    return this._nodeCanvas.getContext(type);
  };
}

function loadLottieWeb() {
  if (lottieModule && typeof lottieModule.loadAnimation === "function") {
    return lottieModule;
  }

  // lottie-web only assigns exports when document + navigator exist at first load.
  delete require.cache[LOTTIE_WEB_PATH];
  lottieModule = require("lottie-web");

  if (typeof lottieModule.loadAnimation !== "function") {
    throw new Error(
      "lottie-web did not initialize — ensure document and navigator exist before require"
    );
  }

  return lottieModule;
}

function setupLottiePlayer(animationData, drawSize) {
  if (lottieAnim && lottieDrawSize === drawSize) return;

  lottieAnim = null;
  lottieDrawSize = drawSize;

  lottieDom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="lottie" style="width:${drawSize}px;height:${drawSize}px"></div></body></html>`
  );
  installBrowserGlobals(lottieDom, drawSize);

  const lottie = loadLottieWeb();
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

export async function renderTutorialHeadPng(animationData, frame, canvasSize) {
  const drawSize = headDrawPx(canvasSize);
  setupLottiePlayer(animationData, drawSize);

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

  svgEl.setAttribute("width", String(drawSize));
  svgEl.setAttribute("height", String(drawSize));

  let svgString = lottieSerializer.serializeToString(svgEl);
  svgString = svgString.replace(/\sxmlns="[^"]*"/g, "");
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const flat = await sharp(Buffer.from(svgString))
    .resize(drawSize, drawSize)
    .png()
    .toBuffer();

  return sharp(flat)
    .rotate(ANDROID_HEAD_ROTATION_DEG, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Compose LM Studio background + android head at bottom-right (-45°).
 * @param {object} opts
 * @param {number} opts.targetSize
 * @param {string} opts.lmStudioLogoPath
 * @param {object} opts.animationData patched Lottie JSON
 * @param {number} opts.lottieFrame
 * @param {{ x: number, y: number }} [opts.headBrOverride] slide-in anchor override
 * @param {number} [opts.bodyExtraAlongPeek=0] extra body shift along peek diagonal (body leads head)
 * @param {boolean} [opts.includeBody=false] -45° rect below head (head-matched width)
 * @param {boolean} [opts.applyPlayStoreMask=false] squircle clip (Play Store icon corners)
 */
export async function composeBrandMarkWithHead({
  targetSize,
  lmStudioLogoPath,
  animationData,
  lottieFrame,
  headBrOverride,
  bodyExtraAlongPeek = 0,
  includeBody = false,
  applyPlayStoreMask = false,
}) {
  const logoBuf = await buildLmStudioBackground(targetSize, lmStudioLogoPath);
  const headBr = headBrOverride ?? headBottomRightAnchor(targetSize);
  const headRotated = await renderTutorialHeadPng(animationData, lottieFrame, targetSize);
  const headArt = await measureHeadArtBounds(headRotated);
  const { left, top } = headCompositeFromArtAnchor(headBr, headArt);

  const layers = [];
  if (includeBody) {
    const restHead = await getRestHeadMeta(animationData, targetSize);
    layers.push({
      input: await renderBodyRectPng(targetSize, headBr, restHead.art, bodyExtraAlongPeek),
      left: 0,
      top: 0,
    });
  }
  layers.push({ input: headRotated, left, top });

  let buf = await sharp(logoBuf).composite(layers).png().toBuffer();
  if (applyPlayStoreMask) {
    buf = await applyBrandMask(buf, targetSize);
  }
  return buf;
}
