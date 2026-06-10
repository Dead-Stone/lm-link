import { resolveLibraryEntryDownloadSource } from "./library-entry-downloads";
import { LibraryBrowseItem } from "./library-browse-list";
import { findCuratedRemoteLibraryEntry, LibraryDownloadSource } from "./remote-model-library";
import { ModelBrandKey, resolveModelBrandKey } from "./model-provider-logos";
import { localModelIdHaystack } from "./local-models";
import {
  ModelCapabilityFilter,
  modelMatchesCapabilityFilter,
  remoteLibraryEntryHaystack,
} from "./vision-models";

export type LibraryPlatformFilter = "all" | "system" | "phone";
export type LibrarySourceFilter = "all" | LibraryDownloadSource;

export type LibraryBrowseFilters = {
  platform: LibraryPlatformFilter;
  source: LibrarySourceFilter;
  provider: ModelBrandKey | "all";
  capability: ModelCapabilityFilter;
};

export const DEFAULT_LIBRARY_BROWSE_FILTERS: LibraryBrowseFilters = {
  platform: "all",
  source: "all",
  provider: "all",
  capability: "all",
};

export type LibraryBrowseSourceGroup = LibraryDownloadSource | "phone";

export type LibraryBrowseGroup = {
  source: LibraryBrowseSourceGroup;
  label: string;
  items: LibraryBrowseItem[];
};

const SOURCE_GROUP_LABELS: Record<LibraryBrowseSourceGroup, string> = {
  lmstudio: "LM Studio",
  huggingface: "Hugging Face",
  phone: "On this phone",
};

const SOURCE_GROUP_ORDER: LibraryBrowseSourceGroup[] = [
  "lmstudio",
  "huggingface",
  "phone",
];

export const LIBRARY_PROVIDER_FILTER_OPTIONS: Array<{
  id: ModelBrandKey | "all";
  label: string;
}> = [
  { id: "all", label: "All providers" },
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "mistral", label: "Mistral" },
  { id: "qwen", label: "Qwen" },
  { id: "microsoft", label: "Microsoft" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openai", label: "OpenAI" },
  { id: "nvidia", label: "NVIDIA" },
  { id: "anthropic", label: "Anthropic" },
  { id: "ibm", label: "IBM" },
];

export function libraryBrowseFiltersActive(filters: LibraryBrowseFilters): boolean {
  return (
    filters.platform !== "all" ||
    filters.source !== "all" ||
    filters.provider !== "all" ||
    filters.capability !== "all"
  );
}

export function resolveEntryCatalogSource(
  entry: Parameters<typeof inferRemoteEntryDownloadSource>[0]
): LibraryDownloadSource {
  return entry.downloadSource ?? inferRemoteEntryDownloadSource(entry);
}

export function inferRemoteEntryDownloadSource(
  entry: Pick<
    import("./remote-model-library").RemoteLibraryEntry,
    "id" | "publisher" | "badge" | "description" | "downloads" | "downloadSource"
  >
): LibraryDownloadSource {
  const resolved = resolveLibraryEntryDownloadSource(entry);
  if (resolved) return resolved;
  if (entry.downloadSource) return entry.downloadSource;
  if (entry.badge === "HF" || entry.description?.toLowerCase().includes("hugging face")) {
    return "huggingface";
  }
  if (
    entry.description?.toLowerCase().includes("lm studio") ||
    entry.badge === "Recomm" ||
    findCuratedRemoteLibraryEntry(entry.id)
  ) {
    return "lmstudio";
  }
  return "lmstudio";
}

export function resolveBrowseItemSource(item: LibraryBrowseItem): LibraryBrowseSourceGroup {
  if (item.kind === "local") return "phone";
  return inferRemoteEntryDownloadSource(item.entry);
}

function browseItemProviderKey(item: LibraryBrowseItem): ModelBrandKey | null {
  if (item.kind === "local") {
    return resolveModelBrandKey(item.model.key, item.model.provider, item.model.name);
  }
  return resolveModelBrandKey(item.entry.id, item.entry.publisher, item.entry.name);
}

export function matchesLibraryBrowseFilters(
  item: LibraryBrowseItem,
  filters: LibraryBrowseFilters
): boolean {
  if (filters.platform === "system" && item.kind === "local") return false;
  if (filters.platform === "phone" && item.kind === "remote") return false;

  const source = resolveBrowseItemSource(item);
  if (filters.source !== "all" && source !== filters.source) return false;

  if (filters.provider !== "all") {
    const brand = browseItemProviderKey(item);
    if (brand !== filters.provider) return false;
  }

  if (filters.capability !== "all") {
    if (item.kind === "local") {
      const haystack = localModelIdHaystack(item.model);
      if (
        !modelMatchesCapabilityFilter(
          haystack,
          filters.capability,
          [],
          undefined,
          item.model.badge
        )
      ) {
        return false;
      }
    } else if (
      !modelMatchesCapabilityFilter(
        item.entry.id,
        filters.capability,
        [],
        undefined,
        item.entry.badge,
        remoteLibraryEntryHaystack(item.entry)
      )
    ) {
      return false;
    }
  }

  return true;
}

export function filterLibraryBrowseItems(
  items: LibraryBrowseItem[],
  filters: LibraryBrowseFilters
): LibraryBrowseItem[] {
  if (!libraryBrowseFiltersActive(filters)) return items;
  return items.filter((item) => matchesLibraryBrowseFilters(item, filters));
}

export function groupLibraryBrowseItems(
  items: LibraryBrowseItem[],
  score: (item: LibraryBrowseItem) => number
): LibraryBrowseGroup[] {
  const buckets = new Map<LibraryBrowseSourceGroup, LibraryBrowseItem[]>();
  for (const source of SOURCE_GROUP_ORDER) {
    buckets.set(source, []);
  }

  for (const item of items) {
    const source = resolveBrowseItemSource(item);
    buckets.get(source)?.push(item);
  }

  return SOURCE_GROUP_ORDER.map((source) => ({
    source,
    label: SOURCE_GROUP_LABELS[source],
    items: [...(buckets.get(source) ?? [])].sort((a, b) => score(b) - score(a)),
  })).filter((group) => group.items.length > 0);
}

/** Slice grouped browse rows in LM Studio → HF → phone order. */
export function sliceGroupedBrowseItems(
  groups: LibraryBrowseGroup[],
  limit: number
): { groups: LibraryBrowseGroup[]; totalCount: number } {
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (limit <= 0 || totalCount === 0) {
    return { groups: [], totalCount };
  }

  let remaining = limit;
  const sliced: LibraryBrowseGroup[] = [];

  for (const group of groups) {
    if (remaining <= 0) break;
    if (group.items.length === 0) continue;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    sliced.push({ ...group, items });
  }

  return { groups: sliced, totalCount };
}
