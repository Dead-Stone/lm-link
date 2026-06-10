import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { copyAsync, readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { MessageImage } from "./types";
import { generateId } from "./storage";

/** Strip a data-URL prefix and any whitespace/newlines from base64 payloads. */
export function normalizeImageBase64(data: string): string {
  const trimmed = data.trim();
  const match = /^data:[^;]+;base64,(.+)$/is.exec(trimmed);
  return (match ? match[1] : trimmed).replace(/\s/g, "");
}

export function normalizeImageMimeType(mimeType?: string | null): string {
  const m = (mimeType ?? "image/jpeg").toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

function detectImageMimeFromBase64(base64: string): string {
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("UklGR")) return "image/webp";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  return "image/jpeg";
}

/** LM Studio only accepts jpeg/png data-URI prefixes; webp/heic must be relabeled. */
export function lmStudioVisionMimeType(
  mimeType?: string | null,
  base64?: string
): "image/jpeg" | "image/png" {
  const detected = base64 ? detectImageMimeFromBase64(base64) : "image/jpeg";
  const m = normalizeImageMimeType(mimeType ?? detected);
  if (m === "image/png" && detected === "image/png") return "image/png";
  return "image/jpeg";
}

export function isPlausibleImageBase64(base64: string): boolean {
  if (base64.length < 64) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(base64);
}

/**
 * Build an OpenAI-style vision URL that LM Studio accepts.
 * LMS rejects webp/heic prefixes even when the bytes are valid — relabel as jpeg/png.
 */
export function buildVisionImageUrl(base64: string, mimeType?: string | null): string {
  const raw = normalizeImageBase64(base64);
  if (!isPlausibleImageBase64(raw)) {
    throw new Error("invalid image data");
  }
  const safeMime = lmStudioVisionMimeType(mimeType, raw);
  return `data:${safeMime};base64,${raw}`;
}

async function ensureReadableUri(uri: string): Promise<string> {
  if (Platform.OS === "android" && uri.startsWith("content://")) {
    const cacheFile = new File(Paths.cache, `attach_${Date.now()}.jpg`);
    await copyAsync({ from: uri, to: cacheFile.uri });
    return cacheFile.uri;
  }
  return uri;
}

async function readUriAsBase64(uri: string): Promise<string> {
  const readableUri = await ensureReadableUri(uri);

  try {
    const file = new File(readableUri);
    if (file.exists) {
      return normalizeImageBase64(await file.base64());
    }
  } catch {
    // fall through to legacy reader
  }

  return normalizeImageBase64(
    await readAsStringAsync(readableUri, { encoding: EncodingType.Base64 })
  );
}

/** Copy a picked image into app documents so the URI survives restarts. */
export async function persistChatImage(
  uri: string,
  filename: string,
  mimeType: string
): Promise<MessageImage> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const dest = new File(Paths.document, `chat-images/${generateId()}.${ext}`);
  const parent = dest.parentDirectory;
  if (parent && !parent.exists) {
    parent.create({ idempotent: true });
  }
  const readableUri = await ensureReadableUri(uri);
  await copyAsync({ from: readableUri, to: dest.uri });
  return {
    uri: dest.uri,
    mimeType: normalizeImageMimeType(mimeType),
    filename,
  };
}

/** Ensure we have raw base64 image bytes, reading from `uri` when the picker omitted them. */
export async function resolveImageBase64(
  uri: string,
  existing?: string | null
): Promise<string> {
  const normalized = existing ? normalizeImageBase64(existing) : "";
  if (isPlausibleImageBase64(normalized)) return normalized;
  const fromUri = await readUriAsBase64(uri);
  return isPlausibleImageBase64(fromUri) ? fromUri : "";
}
