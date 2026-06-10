import { searchLmStudioModels } from "./api";
import { isPlausibleCatalogModelId } from "./catalog-model-id";

export { isPlausibleCatalogModelId } from "./catalog-model-id";
import { isModelInstalled, RemoteLibraryEntry } from "./remote-model-library";
import { matchesModelSearchQuery, parseModelName } from "./model-name";
import { matchesLibrarySearch, parseLibrarySearchQuery } from "./library-search";
import { isLmStudioMacDownloadModel } from "./lmstudio-downloadable";
import {
  isCapabilityCatalogSearchQuery,
  modelMatchesModalityFilter,
  ModelModalityFilter,
} from "./vision-models";

import { LIBRARY_PAGE_SIZE } from "./library-pagination";

export const LM_STUDIO_CATALOG_PAGE_SIZE = LIBRARY_PAGE_SIZE;

const HUB_SITEMAP_URL = "https://lmstudio.ai/hub-sitemap.xml";
const HUB_MODELS_BASE = "https://lmstudio.ai/models";

type CatalogFamily = {
  slug: string;
  name: string;
  lastModified?: string;
};

type CatalogPageOptions = {
  managementUrl?: string | null;
  apiKey?: string;
  search: string;
  modalityFilter: ModelModalityFilter;
  page: number;
  pageSize?: number;
  installedIds: string[];
};

let hubIndexPromise: Promise<CatalogFamily[]> | null = null;
const familyDownloadIdsCache = new Map<string, string[]>();

export function dedupeCatalogEntries(entries: RemoteLibraryEntry[]): RemoteLibraryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const id = entry.id.trim();
    if (!isPlausibleCatalogModelId(id)) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function slugToDisplayName(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d+(\.\d+)?$/.test(part)) return part;
      if (/^v\d/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function publisherFromModelId(modelId: string): string {
  const org = modelId.split("/")[0] ?? "";
  if (!org) return "LM Studio";
  return org.charAt(0).toUpperCase() + org.slice(1);
}

function badgeColorForPublisher(publisher: string): string {
  const key = publisher.toLowerCase();
  if (key.includes("google")) return "#4285f4";
  if (key.includes("qwen")) return "#06b6d4";
  if (key.includes("meta") || key.includes("llama")) return "#0866ff";
  if (key.includes("mistral")) return "#f59e0b";
  if (key.includes("openai")) return "#22c55e";
  if (key.includes("deepseek")) return "#10b981";
  if (key.includes("microsoft") || key.includes("phi")) return "#2563eb";
  if (key.includes("ibm") || key.includes("granite")) return "#6366f1";
  return "#8b5cf6";
}

function entrySearchHaystack(id: string, family?: CatalogFamily): string {
  const { displayName, family: parsedFamily } = parseModelName(id);
  const publisher = publisherFromModelId(id);
  return [id, family?.slug, family?.name, displayName, parsedFamily, publisher]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function passesCatalogSearch(id: string, family: CatalogFamily | undefined, search: string): boolean {
  if (!search.trim()) return true;
  if (isCapabilityCatalogSearchQuery(search)) return true;
  const publisher = publisherFromModelId(id);
  return matchesLibrarySearch([entrySearchHaystack(id, family), publisher], search, {
    id,
    publisher,
  });
}

async function fetchHubCatalogIndex(): Promise<CatalogFamily[]> {
  const res = await fetch(HUB_SITEMAP_URL);
  if (!res.ok) {
    throw new Error(`Could not load LM Studio catalog (${res.status})`);
  }
  const xml = await res.text();
  const families: CatalogFamily[] = [];
  const pattern =
    /<url>\s*<loc>https:\/\/lmstudio\.ai\/models\/([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const slug = decodeURIComponent(match[1]).replace(/\/+$/, "");
    if (!slug || slug.includes("/")) continue;
    families.push({
      slug,
      name: slugToDisplayName(slug),
      lastModified: match[2] || undefined,
    });
  }
  return families.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
}

function getHubCatalogIndex(): Promise<CatalogFamily[]> {
  if (!hubIndexPromise) {
    hubIndexPromise = fetchHubCatalogIndex();
  }
  return hubIndexPromise;
}

export function clearLmStudioCatalogCache(): void {
  hubIndexPromise = null;
  familyDownloadIdsCache.clear();
}

async function resolveFamilyDownloadIds(slug: string): Promise<string[]> {
  const cached = familyDownloadIdsCache.get(slug);
  if (cached) return cached.filter(isPlausibleCatalogModelId);

  const res = await fetch(`${HUB_MODELS_BASE}/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    familyDownloadIdsCache.set(slug, []);
    return [];
  }
  const html = await res.text();

  const ids: string[] = [];
  const seen = new Set<string>();

  const variantPattern = /href="\/models\/([^/]+)\/([^"]+)"/g;
  let variant: RegExpExecArray | null;
  while ((variant = variantPattern.exec(html)) !== null) {
    const org = variant[1]?.trim();
    const model = variant[2]?.trim();
    if (!org || !model) continue;
    const id = `${org}/${model}`;
    if (!isPlausibleCatalogModelId(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0 && slug.includes("/") && isPlausibleCatalogModelId(slug)) {
    ids.push(slug);
  }

  familyDownloadIdsCache.set(slug, ids);
  return ids;
}

function searchResultToEntry(
  result: Awaited<ReturnType<typeof searchLmStudioModels>>["results"][number]
): RemoteLibraryEntry | null {
  const id = result.id?.trim();
  if (!id || !isPlausibleCatalogModelId(id)) return null;
  const { displayName, family } = parseModelName(id);
  const publisher = publisherFromModelId(id);
  const hasDownloads = typeof result.downloads === "number" && result.downloads > 0;
  return {
    id,
    name: result.name?.trim() || displayName || family,
    publisher,
    badge: result.staffPick ? "Recomm" : undefined,
    badgeColor: badgeColorForPublisher(publisher),
    description: result.staffPick ? "LM Studio staff pick" : undefined,
    ...(hasDownloads
      ? { downloads: result.downloads, downloadSource: "lmstudio" as const }
      : {}),
  };
}

function idToEntry(id: string, _family?: CatalogFamily): RemoteLibraryEntry {
  const { displayName, family: parsedFamily } = parseModelName(id);
  const publisher = publisherFromModelId(id);
  return {
    id,
    name: displayName || parsedFamily,
    publisher,
    badgeColor: badgeColorForPublisher(publisher),
    downloadSource: "lmstudio",
  };
}

function passesCatalogFilters(
  id: string,
  family: CatalogFamily,
  options: CatalogPageOptions
): boolean {
  if (!isLmStudioMacDownloadModel(id)) return false;
  if (isModelInstalled(options.installedIds, id)) return false;
  if (!modelMatchesModalityFilter(id, options.modalityFilter)) return false;
  if (!passesCatalogSearch(id, family, options.search)) return false;
  return true;
}

function familyMatchesCatalogSearch(family: CatalogFamily, search: string): boolean {
  if (!search.trim()) return true;
  if (isCapabilityCatalogSearchQuery(search)) return true;
  const publisher = family.slug.includes("/")
    ? publisherFromModelId(family.slug)
    : publisherFromModelId(`placeholder/${family.slug}`);
  return matchesLibrarySearch(
    [entrySearchHaystack(family.slug, family), family.slug, family.name, publisher],
    search,
    {
      id: family.slug.includes("/") ? family.slug : undefined,
      publisher,
    }
  );
}

async function fetchHubCatalogPage(
  options: CatalogPageOptions
): Promise<{ entries: RemoteLibraryEntry[]; hasMore: boolean }> {
  const pageSize = options.pageSize ?? LM_STUDIO_CATALOG_PAGE_SIZE;
  const allFamilies = await getHubCatalogIndex();
  const families = options.search.trim()
    ? allFamilies.filter((family) => familyMatchesCatalogSearch(family, options.search))
    : allFamilies;
  const targetStart = options.page * pageSize;
  const entries: RemoteLibraryEntry[] = [];
  let matchIndex = 0;
  let hasMore = false;

  for (const family of families) {
    const ids = await resolveFamilyDownloadIds(family.slug);
    for (const id of ids) {
      if (!passesCatalogFilters(id, family, options)) continue;

      if (matchIndex >= targetStart && entries.length < pageSize) {
        entries.push(idToEntry(id, family));
      } else if (entries.length >= pageSize) {
        hasMore = true;
        break;
      }
      matchIndex++;
    }
    if (hasMore) break;
  }

  if (!hasMore && matchIndex > targetStart + entries.length) {
    hasMore = true;
  }

  return { entries: dedupeCatalogEntries(entries), hasMore };
}

async function fetchMacCatalogPage(
  options: CatalogPageOptions
): Promise<{ entries: RemoteLibraryEntry[]; hasMore: boolean } | null> {
  if (!options.managementUrl) return null;

  const pageSize = options.pageSize ?? LM_STUDIO_CATALOG_PAGE_SIZE;
  const parsed = parseLibrarySearchQuery(options.search);
  const searchTerm =
    parsed.searchText.trim() ||
    parsed.providerPrefix ||
    options.search.trim() ||
    undefined;

  try {
    const { results, hasMore } = await searchLmStudioModels(
      options.managementUrl,
      {
        searchTerm,
        limit: pageSize,
        offset: options.page * pageSize,
      },
      options.apiKey
    );

    const entries = results
      .map(searchResultToEntry)
      .filter((entry): entry is RemoteLibraryEntry => {
        if (!entry) return false;
        if (!isLmStudioMacDownloadModel(entry.id)) return false;
        if (isModelInstalled(options.installedIds, entry.id)) return false;
        if (!modelMatchesModalityFilter(entry.id, options.modalityFilter)) return false;
        return matchesLibrarySearch(
          [entry.id, entry.name, entry.publisher, entry.description],
          options.search,
          { id: entry.id, publisher: entry.publisher }
        );
      });

    return { entries: dedupeCatalogEntries(entries), hasMore };
  } catch {
    return null;
  }
}

/** One page of downloadable LM Studio hub models (Mac search when available, else public catalog). */
export async function fetchLmStudioCatalogPage(
  options: CatalogPageOptions
): Promise<{ entries: RemoteLibraryEntry[]; hasMore: boolean }> {
  const searchActive = options.search.trim().length > 0;

  if (searchActive) {
    const [macPage, hubPage] = await Promise.all([
      fetchMacCatalogPage(options),
      fetchHubCatalogPage(options),
    ]);
    const entries = dedupeCatalogEntries([
      ...(macPage?.entries ?? []),
      ...hubPage.entries,
    ]);
    return {
      entries,
      hasMore: (macPage?.hasMore ?? false) || hubPage.hasMore,
    };
  }

  const macPage = await fetchMacCatalogPage(options);
  if (macPage) return macPage;
  return fetchHubCatalogPage(options);
}
