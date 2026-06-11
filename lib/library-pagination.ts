/** Models shown per page in the model library browse/discover lists. */
export const LIBRARY_PAGE_SIZE = 10;

/** True when another page of rows should be offered (10 at a time; hidden when total ≤ page size). */
export function libraryHasMorePages(
  visibleCount: number,
  loadedCount: number,
  remoteHasMore = false,
  pageSize: number = LIBRARY_PAGE_SIZE
): boolean {
  if (loadedCount === 0) return false;
  if (visibleCount < loadedCount) return true;
  if (!remoteHasMore) return false;
  return loadedCount >= pageSize;
}
