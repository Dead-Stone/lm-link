import {
  formatLibraryDownloadCount,
  parseHfDownloadsFromDescription,
  sortRemoteLibraryEntriesByDownloads,
} from "./library-download-count";
import { type HuggingFaceAuthOptions } from "./huggingface-api";
import {
  fetchHuggingFaceModelEntry,
  getCachedHfLibraryDownloadCount,
  huggingFaceRepoIdFromString,
} from "./huggingface-model-card";
import { fetchLmStudioArtifactDownloadCount, getCachedLmStudioDownloadCount } from "./lmstudio-hub-artifact";
import { LibraryDownloadSource, RemoteLibraryEntry } from "./remote-model-library";

export { formatLibraryDownloadCount };

/** LM Studio hub count when available, otherwise Hugging Face. */
export function resolveLibraryEntryDownloadCount(
  entry: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">
): number {
  if (entry.downloadSource === "lmstudio" && typeof entry.downloads === "number" && entry.downloads > 0) {
    return entry.downloads;
  }

  const lmCached = getCachedLmStudioDownloadCount(entry.id);
  if (lmCached != null && lmCached > 0) return lmCached;

  if (typeof entry.downloads === "number" && entry.downloads > 0) {
    return entry.downloads;
  }

  const hfCached = getCachedHfLibraryDownloadCount(entry.id);
  if (hfCached != null && hfCached > 0) return hfCached;

  return parseHfDownloadsFromDescription(entry.description);
}

export function resolveLibraryEntryDownloadSource(
  entry: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">
): LibraryDownloadSource | undefined {
  if (entry.downloadSource === "lmstudio" && typeof entry.downloads === "number" && entry.downloads > 0) {
    return "lmstudio";
  }
  if (getCachedLmStudioDownloadCount(entry.id) != null) return "lmstudio";

  if (entry.downloadSource === "huggingface" && typeof entry.downloads === "number" && entry.downloads > 0) {
    return "huggingface";
  }
  if (getCachedHfLibraryDownloadCount(entry.id) != null) return "huggingface";
  if (parseHfDownloadsFromDescription(entry.description) > 0) return "huggingface";

  return undefined;
}

export function compareRemoteLibraryEntriesByDownloads(
  a: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">,
  b: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">
): number {
  return resolveLibraryEntryDownloadCount(b) - resolveLibraryEntryDownloadCount(a);
}

export function sortRemoteLibraryEntriesByPopularity(entries: RemoteLibraryEntry[]): RemoteLibraryEntry[] {
  return sortRemoteLibraryEntriesByDownloads(entries, resolveLibraryEntryDownloadCount);
}

function needsDownloadPrefetch(entry: RemoteLibraryEntry): boolean {
  return resolveLibraryEntryDownloadCount(entry) === 0;
}

/** Background-fetch LM Studio then Hugging Face download counts for library rows. */
export async function prefetchRemoteLibraryDownloadCounts(
  entries: RemoteLibraryEntry[],
  options?: { concurrency?: number } & HuggingFaceAuthOptions
): Promise<void> {
  const concurrency = Math.max(1, options?.concurrency ?? 1);
  const pending = entries
    .filter((entry) => needsDownloadPrefetch(entry))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pending.length === 0) return;

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const entry = pending[cursor++];
      try {
        const lmCount = await fetchLmStudioArtifactDownloadCount(entry.id);
        if (lmCount != null && lmCount > 0) continue;

        if (!huggingFaceRepoIdFromString(entry.id)) continue;
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
