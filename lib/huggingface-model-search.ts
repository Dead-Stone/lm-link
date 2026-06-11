import { isPlausibleCatalogModelId } from "./catalog-model-id";
import {
  HuggingFaceApiError,
  huggingFaceApiFetch,
  huggingFaceApiFetchUrl,
  parseHuggingFaceLinkNextUrl,
  type HuggingFaceAuthOptions,
} from "./huggingface-api";
import { LIBRARY_PAGE_SIZE } from "./library-pagination";
import {
  buildHfDescription,
  fetchHuggingFaceModelEntry,
  getCachedHfLibraryDownloadCount,
  getCachedHfLibrarySizeLabel,
  huggingFaceRepoIdFromString,
  type HuggingFaceModel,
} from "./huggingface-model-card";
import {
  formatLmStudioRuntimeDownloadError,
  isLmStudioMacDownloadModel,
  lmStudioMacDownloadBlockedMessage,
} from "./lmstudio-downloadable";
import { sortRemoteLibraryEntriesByPopularity } from "./library-entry-downloads";
import { libraryRemoteEntryDetailScore } from "./library-entry-rank";
import { librarySearchApiTerm, matchesLibrarySearch, parseLibrarySearchQuery } from "./library-search";
import { normalizeModelKey } from "./model-id";
import { extractModelParamLabel, parseModelName } from "./model-name";
import { resolveRemoteDownloadModelString } from "./model-download-string";
import { estimateDownloadSizeFromParams, resolveFileSizeLabel } from "./model-size";
import {
  findCuratedRemoteLibraryEntry,
  isModelInstalled,
  RemoteLibraryEntry,
} from "./remote-model-library";
import {
  capabilityCatalogSearchTerms,
  isCapabilityCatalogSearchQuery,
  ModelCapabilityFilter,
  modelHaystackLooksVisionCapable,
  modelIdLooksVisionCapable,
  modelMatchesCapabilityFilter,
  modelMatchesModalityFilter,
  ModelModalityFilter,
  remoteLibraryEntryHaystack,
} from "./vision-models";

export {
  fetchHuggingFaceModelEntry,
  getCachedHfLibraryDownloadCount,
  getCachedHfLibrarySizeLabel,
  huggingFaceRepoIdFromString,
} from "./huggingface-model-card";

const HF_SEARCH_LIMIT = LIBRARY_PAGE_SIZE;

export type HuggingFaceModelListPage = {
  models: HuggingFaceModel[];
  nextUrl: string | null;
};

export type HuggingFaceModelSearchPage = {
  entries: RemoteLibraryEntry[];
  nextUrl: string | null;
};
const HF_BADGE_COLOR = "#FFD21E";

function publisherFromModelId(modelId: string): string {
  const org = modelId.split("/")[0] ?? "";
  if (!org) return "Hugging Face";
  return org.charAt(0).toUpperCase() + org.slice(1);
}

function mergeRemoteLibraryDownloads(
  base: RemoteLibraryEntry,
  details: RemoteLibraryEntry
): Pick<RemoteLibraryEntry, "downloads" | "downloadSource"> {
  if (base.downloadSource === "lmstudio" && typeof base.downloads === "number" && base.downloads > 0) {
    return { downloads: base.downloads, downloadSource: "lmstudio" };
  }
  if (details.downloadSource === "lmstudio" && typeof details.downloads === "number" && details.downloads > 0) {
    return { downloads: details.downloads, downloadSource: "lmstudio" };
  }
  if (typeof base.downloads === "number" && base.downloads > 0) {
    return { downloads: base.downloads, downloadSource: base.downloadSource ?? details.downloadSource };
  }
  if (typeof details.downloads === "number" && details.downloads > 0) {
    return { downloads: details.downloads, downloadSource: details.downloadSource ?? base.downloadSource };
  }
  return {};
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
    ...mergeRemoteLibraryDownloads(base, details),
  };
}

function hasExplicitRemoteLibrarySize(
  entry: Pick<RemoteLibraryEntry, "id" | "name" | "sizeLabel" | "description">
): boolean {
  const curated = findCuratedRemoteLibraryEntry(entry.id);
  return !!resolveFileSizeLabel(
    entry.sizeLabel && entry.sizeLabel !== "—" ? entry.sizeLabel : undefined,
    curated?.sizeLabel,
    entry.id,
    entry.name,
    entry.description
  );
}

function resolveRemoteLibraryParamLabel(
  entry: Pick<RemoteLibraryEntry, "id" | "params"> & { name?: string }
): string | null {
  const curated = findCuratedRemoteLibraryEntry(entry.id);
  return (
    entry.params ??
    curated?.params ??
    extractModelParamLabel(entry.id, entry.name, entry.params) ??
    parseModelName(entry.id).sizeTag ??
    null
  );
}

/** Sync size: known labels, HF cache, then param estimate. */
export function resolveRemoteLibrarySizeLabelWithHfCache(
  entry: Pick<RemoteLibraryEntry, "id" | "sizeLabel" | "params" | "description"> & {
    name?: string;
  }
): string | null {
  const curated = findCuratedRemoteLibraryEntry(entry.id);
  const resolved = resolveFileSizeLabel(
    entry.sizeLabel && entry.sizeLabel !== "—" ? entry.sizeLabel : undefined,
    curated?.sizeLabel,
    entry.id,
    entry.name,
    entry.description
  );
  if (resolved) return resolved;

  const cachedHf = getCachedHfLibrarySizeLabel(entry.id);
  if (cachedHf) return cachedHf;

  const param = resolveRemoteLibraryParamLabel(entry);
  if (!param) return null;

  const estimate = estimateDownloadSizeFromParams(param);
  return estimate ? estimate.replace(/^~\s*/, "") : null;
}

function needsHfSizePrefetch(
  entry: Pick<RemoteLibraryEntry, "id" | "name" | "sizeLabel" | "params" | "description">
): boolean {
  if (!huggingFaceRepoIdFromString(entry.id)) return false;
  if (hasExplicitRemoteLibrarySize(entry)) return false;
  return !getCachedHfLibrarySizeLabel(entry.id);
}

/** Background-fetch HF sizes for rows that don't have one yet. */
export async function prefetchRemoteLibrarySizes(
  entries: Array<Pick<RemoteLibraryEntry, "id" | "name" | "sizeLabel" | "params" | "description">>,
  options?: { concurrency?: number } & HuggingFaceAuthOptions
): Promise<void> {
  const concurrency = Math.max(1, options?.concurrency ?? 1);
  const pending = entries
    .filter((entry) => needsHfSizePrefetch(entry))
    .sort(
      (a, b) => libraryRemoteEntryDetailScore(b) - libraryRemoteEntryDetailScore(a)
    );
  if (pending.length === 0) return;

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const entry = pending[cursor++];
      try {
        await fetchHuggingFaceModelEntry(entry.id, options);
      } catch {
        /* skip failed lookups */
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () => worker())
  );
}

/** Fill in HF metadata when the model is not in the LM Studio curated catalog. */
export async function enrichRemoteLibraryEntryFromHf(
  entry: RemoteLibraryEntry,
  auth?: HuggingFaceAuthOptions
): Promise<RemoteLibraryEntry> {
  if (findCuratedRemoteLibraryEntry(entry.id)) return entry;

  const repoId = huggingFaceRepoIdFromString(entry.id);
  if (!repoId) return entry;

  const hfEntry = await fetchHuggingFaceModelEntry(repoId, auth);
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

function hfListModelLooksDownloadable(model: HuggingFaceModel, id: string): boolean {
  if (model.gguf?.total && model.gguf.total > 0) return true;
  const tags = (model.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("gguf"))) return true;
  if ((model.library ?? []).some((lib) => /gguf/i.test(lib))) return true;
  const haystack = `${id} ${buildHfDescription(model)}`;
  return modelIdLooksVisionCapable(id) || modelHaystackLooksVisionCapable(haystack);
}

function huggingFaceModelToEntry(model: HuggingFaceModel): RemoteLibraryEntry | null {
  const id = (model.modelId ?? model.id ?? "").trim();
  if (!isPlausibleCatalogModelId(id)) return null;
  if (!hfListModelLooksDownloadable(model, id)) return null;
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
  const ggufBytes = model.gguf?.total;
  const sizeLabel =
    ggufBytes && ggufBytes > 0
      ? resolveFileSizeLabel(ggufBytes) ?? undefined
      : undefined;

  return {
    id,
    name: displayName || slug,
    publisher: publisherFromModelId(id),
    params: params ?? undefined,
    sizeLabel,
    badge: "HF",
    badgeColor: HF_BADGE_COLOR,
    description: buildHfDescription(model),
    downloadSource: "huggingface",
    ...(downloads != null && downloads > 0 ? { downloads } : {}),
  };
}

type HuggingFaceListOptions = {
  installedIds: string[];
  modalityFilter?: ModelModalityFilter;
  capabilityFilter?: ModelCapabilityFilter;
  query?: string;
  skipTextMatch?: boolean;
};

function entriesFromHuggingFaceModels(
  models: HuggingFaceModel[],
  options: HuggingFaceListOptions
): RemoteLibraryEntry[] {
  const modalityFilter = options.modalityFilter ?? "all";
  const capabilityFilter = options.capabilityFilter ?? "all";
  const query = options.query ?? "";
  const entries: RemoteLibraryEntry[] = [];

  for (const model of models) {
    const entry = huggingFaceModelToEntry(model);
    if (!entry) continue;
    if (isModelInstalled(options.installedIds, entry.id)) continue;
    if (!entryMatchesCapabilityFilter(entry, capabilityFilter)) continue;
    if (!modelMatchesModalityFilter(entry.id, modalityFilter)) continue;
    const skipTextMatch =
      options.skipTextMatch ||
      isCapabilityCatalogSearchQuery(query, capabilityFilter);
    if (
      !skipTextMatch &&
      query.trim() &&
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

async function parseHuggingFaceModelListResponse(
  response: Response
): Promise<HuggingFaceModelListPage> {
  if (response.status === 401 || response.status === 403) {
    throw new HuggingFaceApiError(
      "Hugging Face rejected the token — check Settings → Connection → Advanced keys.",
      response.status
    );
  }
  if (!response.ok) return { models: [], nextUrl: null };
  const models = (await response.json()) as HuggingFaceModel[] | { error?: string };
  return {
    models: Array.isArray(models) ? models : [],
    nextUrl: parseHuggingFaceLinkNextUrl(response.headers.get("Link")),
  };
}

async function fetchHuggingFaceModelList(
  params: URLSearchParams,
  auth?: HuggingFaceAuthOptions
): Promise<HuggingFaceModelListPage> {
  const response = await huggingFaceApiFetch(`?${params.toString()}`, undefined, auth);
  return parseHuggingFaceModelListResponse(response);
}

export async function fetchHuggingFaceModelListPage(
  nextUrl: string,
  auth?: HuggingFaceAuthOptions
): Promise<HuggingFaceModelListPage> {
  const response = await huggingFaceApiFetchUrl(nextUrl, undefined, auth);
  return parseHuggingFaceModelListResponse(response);
}

async function fetchHuggingFaceModelsByPipeline(
  pipelineTag: string,
  options: {
    installedIds: string[];
    modalityFilter?: ModelModalityFilter;
    capabilityFilter?: ModelCapabilityFilter;
    limit?: number;
  } & HuggingFaceAuthOptions
): Promise<RemoteLibraryEntry[]> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? HF_SEARCH_LIMIT),
    sort: "downloads",
    direction: "-1",
    pipeline_tag: pipelineTag,
  });
  const { models } = await fetchHuggingFaceModelList(params, options);
  return entriesFromHuggingFaceModels(models, {
    ...options,
    skipTextMatch: true,
  });
}

async function fetchHuggingFaceModelsForCapability(
  capabilityFilter: ModelCapabilityFilter,
  options: {
    installedIds: string[];
    modalityFilter?: ModelModalityFilter;
    limit?: number;
  } & HuggingFaceAuthOptions
): Promise<RemoteLibraryEntry[]> {
  const perQueryLimit = options.limit ?? HF_SEARCH_LIMIT;
  const searchTerms = capabilityCatalogSearchTerms(capabilityFilter);
  const groups: RemoteLibraryEntry[][] = [];

  for (const term of searchTerms) {
    const page = await searchHuggingFaceModels(term, {
      installedIds: options.installedIds,
      modalityFilter: options.modalityFilter,
      capabilityFilter,
      limit: perQueryLimit,
      hfToken: options.hfToken,
    });
    groups.push(page.entries);
  }

  if (capabilityFilter === "image") {
    for (const pipelineTag of ["image-text-to-text", "visual-question-answering"] as const) {
      const entries = await fetchHuggingFaceModelsByPipeline(pipelineTag, {
        ...options,
        capabilityFilter,
        limit: perQueryLimit,
      });
      groups.push(entries);
    }
  }

  return concatDownloadableEntries(groups);
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

function ingestDownloadableEntry(
  byKey: Map<string, RemoteLibraryEntry>,
  order: string[],
  entry: RemoteLibraryEntry
): void {
  const id = entry.id.trim();
  if (!isDownloadableEntryId(id)) return;
  if (!isLmStudioMacDownloadModel(id)) return;
  const key = normalizeModelKey(id);
  if (!byKey.has(key)) order.push(key);
  const existing = byKey.get(key);
  byKey.set(key, existing ? mergeRemoteLibraryEntries(existing, entry) : entry);
}

export function mergeDownloadableEntries(
  primary: RemoteLibraryEntry[],
  secondary: RemoteLibraryEntry[]
): RemoteLibraryEntry[] {
  const byKey = new Map<string, RemoteLibraryEntry>();
  const order: string[] = [];
  for (const entry of [...primary, ...secondary]) {
    ingestDownloadableEntry(byKey, order, entry);
  }
  return sortRemoteLibraryEntriesByPopularity([...byKey.values()]);
}

/** Keep group order (e.g. LM Studio catalog before Hugging Face search hits). */
export function concatDownloadableEntries(
  groups: RemoteLibraryEntry[][]
): RemoteLibraryEntry[] {
  const byKey = new Map<string, RemoteLibraryEntry>();
  const order: string[] = [];
  for (const group of groups) {
    for (const entry of group) {
      ingestDownloadableEntry(byKey, order, entry);
    }
  }
  return order
    .map((key) => byKey.get(key))
    .filter((entry): entry is RemoteLibraryEntry => entry != null);
}

function entryMatchesCapabilityFilter(
  entry: RemoteLibraryEntry,
  capabilityFilter: ModelCapabilityFilter
): boolean {
  if (capabilityFilter === "all") return true;
  const haystack = remoteLibraryEntryHaystack(entry);
  return modelMatchesCapabilityFilter(
    entry.id,
    capabilityFilter,
    [],
    null,
    entry.badge,
    haystack
  );
}

/** Top GGUF models on Hugging Face sorted by download count (library browse default). */
export async function fetchTrendingHuggingFaceModels(
  options: {
    installedIds: string[];
    modalityFilter?: ModelModalityFilter;
    capabilityFilter?: ModelCapabilityFilter;
    limit?: number;
    nextUrl?: string;
  } & HuggingFaceAuthOptions
): Promise<HuggingFaceModelSearchPage> {
  const capabilityFilter = options.capabilityFilter ?? "all";
  if (capabilityCatalogSearchTerms(capabilityFilter).length > 0) {
    const entries = await fetchHuggingFaceModelsForCapability(capabilityFilter, {
      installedIds: options.installedIds,
      modalityFilter: options.modalityFilter,
      limit: options.limit ?? HF_SEARCH_LIMIT,
      hfToken: options.hfToken,
    });
    return { entries, nextUrl: null };
  }

  const limit = options.limit ?? HF_SEARCH_LIMIT;
  const listPage = options.nextUrl
    ? await fetchHuggingFaceModelListPage(options.nextUrl, options)
    : await fetchHuggingFaceModelList(
        new URLSearchParams({
          limit: String(limit),
          sort: "downloads",
          direction: "-1",
          filter: "gguf",
        }),
        options
      );
  const entries = entriesFromHuggingFaceModels(listPage.models, {
    installedIds: options.installedIds,
    modalityFilter: options.modalityFilter,
    capabilityFilter,
  });
  return { entries, nextUrl: listPage.nextUrl };
}

export async function searchHuggingFaceModels(
  query: string,
  options: {
    installedIds: string[];
    modalityFilter?: ModelModalityFilter;
    capabilityFilter?: ModelCapabilityFilter;
    limit?: number;
    nextUrl?: string;
  } & HuggingFaceAuthOptions
): Promise<HuggingFaceModelSearchPage> {
  const parsed = parseLibrarySearchQuery(query);
  const apiTerm = librarySearchApiTerm(query);
  if (!parsed.providerPrefix && apiTerm.length < 2) {
    return { entries: [], nextUrl: null };
  }

  const limit = options.limit ?? HF_SEARCH_LIMIT;
  const listPage = options.nextUrl
    ? await fetchHuggingFaceModelListPage(options.nextUrl, options)
    : await fetchHuggingFaceModelList(
        (() => {
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
          return params;
        })(),
        options
      );
  const entries = entriesFromHuggingFaceModels(listPage.models, {
    installedIds: options.installedIds,
    modalityFilter: options.modalityFilter,
    capabilityFilter: options.capabilityFilter,
    query,
  });
  return { entries, nextUrl: listPage.nextUrl };
}
