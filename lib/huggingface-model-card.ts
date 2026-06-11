import { catalogIdToHuggingFaceRepoId } from "./catalog-hf-repo";
import { isPlausibleCatalogModelId } from "./catalog-model-id";
import { formatLibraryDownloadCount } from "./library-download-count";
import { normalizeModelKey } from "./model-id";
import { extractModelParamLabel, parseModelName } from "./model-name";
import { resolveRemoteDownloadModelString } from "./model-download-string";
import { resolveFileSizeLabel } from "./model-size";
import { huggingFaceApiFetch, type HuggingFaceAuthOptions } from "./huggingface-api";
import { RemoteLibraryEntry } from "./remote-model-library";
const HF_BADGE_COLOR = "#FFD21E";

export type HuggingFaceModel = {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  tags?: string[];
  library?: string[];
  cardData?: {
    base_model?: string;
    license?: string;
    language?: string[];
  };
  gguf?: {
    total?: number;
    architecture?: string;
    context_length?: number;
  };
};

const hfEntryCache = new Map<string, RemoteLibraryEntry>();

/** Drop cached model cards so the next fetch uses the current HF token. */
export function clearHfEntryCache(): void {
  hfEntryCache.clear();
}

function publisherFromModelId(modelId: string): string {
  const org = modelId.split("/")[0] ?? "";
  if (!org) return "Hugging Face";
  return org.charAt(0).toUpperCase() + org.slice(1);
}

/** Extract `org/model` repo id from a download string, URL, or model id. */
export function huggingFaceRepoIdFromString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isPlausibleCatalogModelId(trimmed)) {
    return catalogIdToHuggingFaceRepoId(trimmed) ?? trimmed;
  }

  try {
    const resolved = resolveRemoteDownloadModelString(trimmed);
    if (isPlausibleCatalogModelId(resolved)) return resolved;

    if (/^https?:\/\//i.test(resolved)) {
      const path = resolved
        .replace(/^https?:\/\/[^/]+\//i, "")
        .replace(/\/+$/, "")
        .split("/")
        .filter(Boolean);
      if (path.length >= 2) {
        const repoId = `${path[0]}/${path[1]}`;
        if (isPlausibleCatalogModelId(repoId)) return repoId;
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

export function buildHfDescription(model: HuggingFaceModel): string {
  const parts: string[] = [];
  if (model.cardData?.base_model) {
    parts.push(`Quantized from ${model.cardData.base_model}`);
  }
  if (model.pipeline_tag) {
    parts.push(model.pipeline_tag.replace(/-/g, " "));
  }
  if (model.gguf?.architecture) {
    parts.push(`${model.gguf.architecture} architecture`);
  }
  if (model.gguf?.context_length) {
    const ctx = model.gguf.context_length;
    parts.push(ctx >= 1024 ? `${Math.round(ctx / 1024)}k context` : `${ctx} token context`);
  }
  if (model.tags?.length) {
    const tags = model.tags
      .filter((tag) => !tag.startsWith("arxiv:") && !tag.startsWith("license:"))
      .slice(0, 3)
      .join(", ");
    if (tags) parts.push(tags);
  }
  if (typeof model.downloads === "number" && model.downloads > 0) {
    parts.push(`${formatLibraryDownloadCount(model.downloads)} downloads on Hugging Face`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Model on Hugging Face";
}

function huggingFaceDetailsToEntry(model: HuggingFaceModel, repoId: string): RemoteLibraryEntry {
  const slash = repoId.indexOf("/");
  const slug = repoId.slice(slash + 1);
  const params = extractModelParamLabel(repoId, slug);
  const { displayName } = parseModelName(repoId);
  const ggufBytes = model.gguf?.total;
  const sizeLabel =
    ggufBytes && ggufBytes > 0
      ? resolveFileSizeLabel(ggufBytes) ?? undefined
      : undefined;

  const downloads = typeof model.downloads === "number" && model.downloads > 0 ? model.downloads : undefined;

  return {
    id: repoId,
    name: displayName || slug,
    publisher: publisherFromModelId(repoId),
    params: params ?? undefined,
    sizeLabel,
    badge: "HF",
    badgeColor: HF_BADGE_COLOR,
    description: buildHfDescription(model),
    ...(downloads != null ? { downloads, downloadSource: "huggingface" as const } : {}),
  };
}

/** Fetch Hugging Face model card details for a repo id or download string. */
export async function fetchHuggingFaceModelEntry(
  modelString: string,
  auth?: HuggingFaceAuthOptions
): Promise<RemoteLibraryEntry | null> {
  const repoId = huggingFaceRepoIdFromString(modelString);
  if (!repoId) return null;

  const cacheKey = normalizeModelKey(repoId);
  const cached = hfEntryCache.get(cacheKey);
  if (cached) return cached;

  const slash = repoId.indexOf("/");
  const org = repoId.slice(0, slash);
  const model = repoId.slice(slash + 1);
  const path = `/${encodeURIComponent(org)}/${encodeURIComponent(model)}`;
  const response = await huggingFaceApiFetch(path, undefined, auth);
  if (!response.ok) return null;

  const data = (await response.json()) as HuggingFaceModel;
  const entry = huggingFaceDetailsToEntry(data, repoId);
  hfEntryCache.set(cacheKey, entry);
  return entry;
}

/** Downloads from a prior Hugging Face model-card fetch (detail sheet or list prefetch). */
export function getCachedHfLibraryDownloadCount(id: string): number | null {
  const repoId = huggingFaceRepoIdFromString(id);
  if (!repoId) return null;
  const key = normalizeModelKey(repoId);
  const cached = hfEntryCache.get(key);
  if (typeof cached?.downloads === "number" && cached.downloads > 0) return cached.downloads;
  return null;
}

/** Size from a prior Hugging Face model-card fetch (detail sheet or list prefetch). */
export function getCachedHfLibrarySizeLabel(id: string): string | null {
  const repoId = huggingFaceRepoIdFromString(id);
  if (!repoId) return null;
  const key = normalizeModelKey(repoId);
  const cached = hfEntryCache.get(key);
  if (!cached?.sizeLabel) return null;
  return resolveFileSizeLabel(cached.sizeLabel) ?? cached.sizeLabel;
}
