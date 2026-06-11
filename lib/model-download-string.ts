import {
  catalogIdToCommunityGgufDownloadUrl,
  catalogIdToHuggingFaceDownloadUrl,
} from "./catalog-hf-repo";
import { isPlausibleCatalogModelId } from "./catalog-model-id";
import { LibraryDownloadSource, REMOTE_MODEL_LIBRARY } from "./remote-model-library";

function trimInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Normalize a pasted model string for LM Studio `POST /api/v1/models/download`. */
export function resolveRemoteDownloadModelString(
  raw: string,
  options?: { downloadSource?: LibraryDownloadSource }
): string {
  const trimmed = trimInput(raw);
  if (!trimmed) {
    throw new Error("Enter a model ID or Hugging Face link.");
  }

  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  if (/^hf\.co\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  if (/huggingface\.co/i.test(trimmed)) {
    const path = trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^(www\.)?huggingface\.co\/?/i, "")
      .replace(/\/+$/, "");
    return `https://huggingface.co/${path}`;
  }

  const catalogMatch = REMOTE_MODEL_LIBRARY.find((entry) => entry.id === trimmed);
  if (catalogMatch) {
    if (catalogMatch.downloadModel?.trim()) {
      return catalogMatch.downloadModel.trim();
    }
    const communityGguf = catalogIdToCommunityGgufDownloadUrl(catalogMatch.id);
    if (communityGguf) return communityGguf;
    if (catalogMatch.downloadSource === "huggingface") {
      const hfUrl = catalogIdToHuggingFaceDownloadUrl(catalogMatch.id);
      if (hfUrl) return hfUrl;
    }
    return catalogMatch.id;
  }

  // LM Studio catalog ids (org/model). Hugging Face repos use provider/Model-Name casing.
  if (isPlausibleCatalogModelId(trimmed)) {
    const communityGguf = catalogIdToCommunityGgufDownloadUrl(trimmed);
    if (communityGguf) return communityGguf;
    if (options?.downloadSource === "huggingface") {
      const hfUrl = catalogIdToHuggingFaceDownloadUrl(trimmed);
      if (hfUrl) return hfUrl;
      return `https://huggingface.co/${trimmed.replace(/^\/+/, "")}`;
    }
    return trimmed;
  }

  return trimmed;
}

/** True when the query looks like a direct on-device GGUF download link. */
export function looksLikeLocalGgufDownloadQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/\.gguf(?:\?|$)/i.test(trimmed)) return true;
  if (
    (/^https?:\/\//i.test(trimmed) || /huggingface\.co/i.test(trimmed) || /^hf\.co\//i.test(trimmed)) &&
    /\/resolve\//i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/** Resolve a GGUF URL when valid; returns null instead of throwing. */
export function tryResolveLocalGgufDownloadUrl(raw: string): string | null {
  if (!looksLikeLocalGgufDownloadQuery(raw)) return null;
  try {
    return resolveLocalGgufDownloadUrl(raw);
  } catch {
    return null;
  }
}

/** Normalize a pasted link for on-device GGUF download. */
export function resolveLocalGgufDownloadUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a Hugging Face GGUF download link.");
  }

  const compact = trimmed.replace(/\s+/g, "");

  if (isHttpUrl(compact)) {
    return compact;
  }

  if (/^hf\.co\//i.test(compact)) {
    return `https://${compact}`;
  }

  if (/huggingface\.co/i.test(compact)) {
    const path = compact
      .replace(/^https?:\/\//i, "")
      .replace(/^(www\.)?huggingface\.co\/?/i, "");
    return `https://huggingface.co/${path.replace(/^\/+/, "")}`;
  }

  if (compact.includes("/")) {
    if (!compact.toLowerCase().includes(".gguf") && !compact.includes("/resolve/")) {
      throw new Error(
        "Paste a direct GGUF file URL (…/resolve/main/model.gguf), not just the repo name."
      );
    }
    return `https://huggingface.co/${compact.replace(/^\/+/, "")}`;
  }

  throw new Error("Paste a Hugging Face GGUF URL or org/repo/…/file.gguf path.");
}

export function ggufFilenameFromUrl(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  const segment = withoutQuery.split("/").filter(Boolean).pop() ?? "model.gguf";
  const safe = segment.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.toLowerCase().endsWith(".gguf") ? safe : `${safe}.gguf`;
}

export function displayNameFromGgufFilename(filename: string): string {
  return filename
    .replace(/\.gguf$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}
