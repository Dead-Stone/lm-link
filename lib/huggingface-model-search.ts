import { isPlausibleCatalogModelId } from "./lmstudio-catalog";
import {
  formatLmStudioRuntimeDownloadError,
  isLmStudioMacDownloadModel,
  lmStudioMacDownloadBlockedMessage,
} from "./lmstudio-downloadable";
import { extractModelParamLabel, parseModelName } from "./model-name";
import { resolveFileSizeLabel } from "./model-size";
import { librarySearchApiTerm, matchesLibrarySearch, parseLibrarySearchQuery } from "./library-search";
import { resolveRemoteDownloadModelString } from "./model-download-string";
import {
  findCuratedRemoteLibraryEntry,
  isModelInstalled,
  normalizeModelKey,
  RemoteLibraryEntry,
} from "./remote-model-library";
import { modelMatchesModalityFilter, ModelModalityFilter } from "./vision-models";

const HF_API = "https://huggingface.co/api/models";
const HF_SEARCH_LIMIT = 24;
const HF_BADGE_COLOR = "#FFD21E";

type HuggingFaceModel = {
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

function publisherFromModelId(modelId: string): string {
  const org = modelId.split("/")[0] ?? "";
  if (!org) return "Hugging Face";
  return org.charAt(0).toUpperCase() + org.slice(1);
}

function formatDownloadCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

/** Extract `org/model` repo id from a download string, URL, or model id. */
export function huggingFaceRepoIdFromString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isPlausibleCatalogModelId(trimmed)) return trimmed;

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

function buildHfDescription(model: HuggingFaceModel): string {
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
    parts.push(`${formatDownloadCount(model.downloads)} downloads on Hugging Face`);
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

  return {
    id: repoId,
    name: displayName || slug,
    publisher: publisherFromModelId(repoId),
    params: params ?? undefined,
    sizeLabel,
    badge: "HF",
    badgeColor: HF_BADGE_COLOR,
    description: buildHfDescription(model),
  };
}

function mergeRemoteLibraryEntries(
  base: RemoteLibraryEntry,
  details: RemoteLibraryEntry
): RemoteLibraryEntry {
  return {
    ...base,
    name: base.name || details.name,
    publisher: base.publisher || details.publisher,
    params: base.params || details.params,
    sizeLabel: base.sizeLabel || details.sizeLabel,
    description: details.description || base.description,
    badge: base.badge === "Direct" || !base.badge ? details.badge : base.badge,
    badgeColor: base.badgeColor || details.badgeColor,
  };
}

/** Fetch Hugging Face model card details for a repo id or download string. */
export async function fetchHuggingFaceModelEntry(
  modelString: string
): Promise<RemoteLibraryEntry | null> {
  const repoId = huggingFaceRepoIdFromString(modelString);
  if (!repoId) return null;

  const cacheKey = normalizeModelKey(repoId);
  const cached = hfEntryCache.get(cacheKey);
  if (cached) return cached;

  const slash = repoId.indexOf("/");
  const org = repoId.slice(0, slash);
  const model = repoId.slice(slash + 1);
  const url = `${HF_API}/${encodeURIComponent(org)}/${encodeURIComponent(model)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as HuggingFaceModel;
  const entry = huggingFaceDetailsToEntry(data, repoId);
  hfEntryCache.set(cacheKey, entry);
  return entry;
}

/** Fill in HF metadata when the model is not in the LM Studio curated catalog. */
export async function enrichRemoteLibraryEntryFromHf(
  entry: RemoteLibraryEntry
): Promise<RemoteLibraryEntry> {
  if (findCuratedRemoteLibraryEntry(entry.id)) return entry;

  const repoId = huggingFaceRepoIdFromString(entry.id);
  if (!repoId) return entry;

  const hfEntry = await fetchHuggingFaceModelEntry(repoId);
  if (!hfEntry) return entry;

  return mergeRemoteLibraryEntries(entry, hfEntry);
}

function isDownloadableEntryId(id: string): boolean {
  const trimmed = id.trim();
  return isPlausibleCatalogModelId(trimmed) || /^https?:\/\//i.test(trimmed);
}

export function looksLikeRemoteModelDownloadQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^hf\.co\//i.test(trimmed) ||
    /huggingface\.co/i.test(trimmed)
  ) {
    return true;
  }
  if (trimmed.includes(" ")) return false;
  if (!trimmed.includes("/")) return false;
  return isPlausibleCatalogModelId(trimmed);
}

function huggingFaceModelToEntry(model: HuggingFaceModel): RemoteLibraryEntry | null {
  const id = (model.modelId ?? model.id ?? "").trim();
  if (!isPlausibleCatalogModelId(id)) return null;
  if (
    !isLmStudioMacDownloadModel(id, {
      pipelineTag: model.pipeline_tag,
      ggufArchitecture: model.gguf?.architecture,
      tags: model.tags,
    })
  ) {
    return null;
  }

  const slash = id.indexOf("/");
  const slug = id.slice(slash + 1);
  const params = extractModelParamLabel(id, slug);
  const downloads = typeof model.downloads === "number" ? model.downloads : null;
  const { displayName } = parseModelName(id);

  return {
    id,
    name: displayName || slug,
    publisher: publisherFromModelId(id),
    params: params ?? undefined,
    badge: "HF",
    badgeColor: HF_BADGE_COLOR,
    description:
      downloads != null && downloads > 0
        ? `${formatDownloadCount(downloads)} downloads on Hugging Face`
        : "Found on Hugging Face",
  };
}

export function buildDirectDownloadEntry(query: string): RemoteLibraryEntry | null {
  if (!looksLikeRemoteModelDownloadQuery(query)) return null;

  try {
    const resolved = resolveRemoteDownloadModelString(query);
    const repoId = huggingFaceRepoIdFromString(resolved) ?? huggingFaceRepoIdFromString(query);
    const checkId = repoId ?? resolved;
    if (!isLmStudioMacDownloadModel(checkId)) return null;
    const trimmed = query.trim();
    const repoPath = trimmed.startsWith("http")
      ? resolved.replace(/^https?:\/\/[^/]+\//i, "").replace(/\/+$/, "")
      : trimmed.replace(/^\/+/, "");
    const slash = repoPath.indexOf("/");
    const slug = slash >= 0 ? repoPath.slice(slash + 1) : repoPath;
    const params = extractModelParamLabel(repoPath, slug);
    const { displayName } = parseModelName(repoId ?? resolved);

    return {
      id: resolved,
      name: displayName || (slug ? slug.replace(/[-_]+/g, " ") : "Custom model"),
      publisher: slash >= 0 ? publisherFromModelId(repoPath) : "Hugging Face",
      params: params ?? undefined,
      badge: "Direct",
      badgeColor: HF_BADGE_COLOR,
      description: repoId
        ? "Loading details from Hugging Face…"
        : "Download this model from your search query.",
    };
  } catch {
    return null;
  }
}

export function mergeDownloadableEntries(
  primary: RemoteLibraryEntry[],
  secondary: RemoteLibraryEntry[]
): RemoteLibraryEntry[] {
  const seen = new Set<string>();
  const merged: RemoteLibraryEntry[] = [];

  for (const entry of [...primary, ...secondary]) {
    const id = entry.id.trim();
    if (!isDownloadableEntryId(id)) continue;
    if (!isLmStudioMacDownloadModel(id)) continue;
    const key = normalizeModelKey(id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged;
}

export async function searchHuggingFaceModels(
  query: string,
  options: {
    installedIds: string[];
    modalityFilter?: ModelModalityFilter;
    limit?: number;
  }
): Promise<RemoteLibraryEntry[]> {
  const parsed = parseLibrarySearchQuery(query);
  const apiTerm = librarySearchApiTerm(query);
  if (!parsed.providerPrefix && apiTerm.length < 2) return [];

  const limit = options.limit ?? HF_SEARCH_LIMIT;
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "downloads",
    direction: "-1",
  });
  if (parsed.providerPrefix) {
    params.set("author", parsed.providerPrefix);
    if (parsed.searchText.trim()) {
      params.set("search", parsed.searchText.trim());
    }
  } else {
    params.set("search", apiTerm);
  }

  const url = `${HF_API}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not search Hugging Face");
  }

  const models = (await response.json()) as HuggingFaceModel[];
  if (!Array.isArray(models)) return [];

  const modalityFilter = options.modalityFilter ?? "all";
  const entries: RemoteLibraryEntry[] = [];
  for (const model of models) {
    const entry = huggingFaceModelToEntry(model);
    if (!entry) continue;
    if (isModelInstalled(options.installedIds, entry.id)) continue;
    if (!modelMatchesModalityFilter(entry.id, modalityFilter)) continue;
    if (
      !matchesLibrarySearch(
        [entry.id, entry.name, entry.publisher, entry.description],
        query,
        { id: entry.id, publisher: entry.publisher }
      )
    ) {
      continue;
    }
    entries.push(entry);
  }

  return entries;
}
