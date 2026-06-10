import { RemoteLibraryEntry } from "./remote-model-library";

export function formatLibraryDownloadCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

export function parseHfDownloadsFromDescription(description?: string): number {
  if (!description) return 0;
  const match = description.match(/([\d.]+)([kKmM])?\s+downloads on Hugging Face/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "m") return Math.round(value * 1_000_000);
  if (suffix === "k") return Math.round(value * 1_000);
  return Math.round(value);
}

export function compareRemoteLibraryEntriesByDownloads(
  a: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">,
  b: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">,
  resolveCount: (
    entry: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">
  ) => number
): number {
  return resolveCount(b) - resolveCount(a);
}

export function sortRemoteLibraryEntriesByDownloads(
  entries: RemoteLibraryEntry[],
  resolveCount: (
    entry: Pick<RemoteLibraryEntry, "id" | "description" | "downloads" | "downloadSource">
  ) => number
): RemoteLibraryEntry[] {
  return [...entries].sort((a, b) => compareRemoteLibraryEntriesByDownloads(a, b, resolveCount));
}
