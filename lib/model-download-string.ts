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
    return catalogMatch.id;
  }

  // LM Studio hub catalog ids (org/model) — not always the same as a HF repo path.
  if (isPlausibleCatalogModelId(trimmed)) {
    if (options?.downloadSource === "huggingface") {
      return `https://huggingface.co/${trimmed.replace(/^\/+/, "")}`;
    }
    return trimmed;
  }

  return trimmed;
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
