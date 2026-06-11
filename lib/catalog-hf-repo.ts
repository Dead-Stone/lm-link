import { isPlausibleCatalogModelId } from "./catalog-model-id";
import { normalizeModelKey } from "./model-id";

/**
 * LM Studio hub ids use lowercase slugs (meta-llama/llama-3.2-3b-instruct).
 * Hugging Face repos use provider + Pascal model name (meta-llama/Llama-3.2-3B-Instruct).
 */
export function metaLlamaCatalogSlugToHfRepoName(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const llamaMatch = trimmed.match(/^llama-(\d+(?:\.\d+)?)-(\d+)b(?:-(.+))?$/i);
  if (!llamaMatch) return null;

  const [, version, billions, suffix] = llamaMatch;
  const tail = suffix
    ? suffix
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join("-")
    : "";
  const base = `Llama-${version}-${billions.toUpperCase()}B`;
  return tail ? `${base}-${tail}` : base;
}

/** Map a catalog `org/model` id to the Hugging Face repo id (provider/modelName). */
export function catalogIdToHuggingFaceRepoId(catalogId: string): string | null {
  const trimmed = catalogId.trim();
  if (!isPlausibleCatalogModelId(trimmed)) return null;

  const slash = trimmed.indexOf("/");
  const org = trimmed.slice(0, slash);
  const slug = trimmed.slice(slash + 1);
  const orgLower = org.toLowerCase();

  if (orgLower === "meta-llama" || orgLower === "meta") {
    const hfName = metaLlamaCatalogSlugToHfRepoName(slug);
    if (hfName) {
      const hfOrg = orgLower === "meta" ? "meta-llama" : org;
      return `${hfOrg}/${hfName}`;
    }
  }

  return trimmed;
}

export function catalogIdToHuggingFaceDownloadUrl(catalogId: string): string | null {
  const repoId = catalogIdToHuggingFaceRepoId(catalogId);
  if (!repoId) return null;
  return `https://huggingface.co/${repoId}`;
}

/** Curated Q4_K_M GGUF links — avoids gated repos and missing LM Studio catalog entries. */
const CURATED_GGUF_DOWNLOADS: Record<string, string> = {
  "meta-llama/llama-3.2-1b-instruct":
    "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
  "meta-llama/llama-3.2-3b-instruct":
    "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  "google/gemma-3n-e4b":
    "https://huggingface.co/lmstudio-community/gemma-3n-E4B-it-GGUF/resolve/main/gemma-3n-E4B-it-Q4_K_M.gguf",
  "google/gemma-3n-e2b":
    "https://huggingface.co/lmstudio-community/gemma-3n-E2B-it-GGUF/resolve/main/gemma-3n-E2B-it-Q4_K_M.gguf",
  "qwen/qwen2.5-vl-3b-instruct":
    "https://huggingface.co/lmstudio-community/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
  "qwen/qwen2.5-vl-7b-instruct":
    "https://huggingface.co/lmstudio-community/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
  "qwen/qwen3-vl-4b":
    "https://huggingface.co/lmstudio-community/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3-VL-4B-Instruct-Q4_K_M.gguf",
};

function huggingFaceRepoIdFromUrl(value: string): string | null {
  const match = value.match(/(?:https?:\/\/)?(?:www\.)?huggingface\.co\/([^/?#\s]+)/i);
  if (!match?.[1]) return null;
  const segments = match[1].replace(/\/+$/, "").split("/");
  if (segments.length < 2) return null;
  return `${segments[0]}/${segments[1]}`;
}

/** Official HF org repos that need token + license acceptance (not GGUF mirrors). */
export function huggingFaceRepoRequiresAuth(repoId: string): boolean {
  const trimmed = repoId.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return false;
  const org = trimmed.slice(0, slash).toLowerCase();
  const name = trimmed.slice(slash + 1).toLowerCase();
  if (org === "meta-llama" || org === "meta") return true;
  if (org === "google" && !name.endsWith("-gguf") && !name.includes("_gguf")) {
    return /gemma|llama/.test(name);
  }
  return false;
}

/**
 * Mac/PC download string for gated Meta Llama catalog ids — community GGUF quant
 * instead of the official repo (LM Studio hf-proxy fails on missing USE_POLICY.md).
 */
export function catalogIdToCommunityGgufDownloadUrl(catalogId: string): string | null {
  const key = normalizeModelKey(catalogId);
  for (const [catalogKey, url] of Object.entries(CURATED_GGUF_DOWNLOADS)) {
    if (normalizeModelKey(catalogKey) === key) return url;
  }

  if (!isGatedHfCatalogId(catalogId)) return null;
  const hfRepoId = catalogIdToHuggingFaceRepoId(catalogId);
  if (!hfRepoId) return null;
  const modelName = hfRepoId.split("/")[1];
  if (!modelName) return null;
  return `https://huggingface.co/bartowski/${modelName}-GGUF/resolve/main/${modelName}-Q4_K_M.gguf`;
}

/** Gated Hugging Face orgs that must download via HF repo URL + user token. */
export function isGatedHfCatalogId(catalogId: string): boolean {
  const trimmed = catalogId.trim().toLowerCase();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return false;
  const org = trimmed.slice(0, slash);
  return org === "meta-llama" || org === "meta";
}

export function modelStringNeedsHfAuth(model: string): boolean {
  const trimmed = model.trim();
  if (!trimmed) return false;
  if (/huggingface\.co/i.test(trimmed) || /^hf\.co\//i.test(trimmed)) {
    const repoId = huggingFaceRepoIdFromUrl(trimmed);
    if (repoId && !huggingFaceRepoRequiresAuth(repoId)) return false;
    return true;
  }
  return isGatedHfCatalogId(trimmed);
}
