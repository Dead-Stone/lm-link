/** Human-readable file size for model download / on-disk size. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1_073_741_824) {
    const gb = bytes / 1_073_741_824;
    return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    const mb = bytes / 1_048_576;
    return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatUnitSize(value: number, unit: string): string {
  const u = unit.toUpperCase();
  if (u === "GB") {
    return `${value >= 10 ? value.toFixed(0) : value % 1 === 0 ? String(value) : value.toFixed(1)} GB`;
  }
  if (u === "MB") return `${Math.round(value)} MB`;
  if (u === "KB") return `${Math.round(value)} KB`;
  if (u === "TB") return `${value % 1 === 0 ? String(value) : value.toFixed(1)} TB`;
  return "";
}

/** True when label looks like a file size (670 MB, ~1.8 GB), not param counts (7B). */
export function isFileSizeLabel(label: string): boolean {
  return /(?:^|[^\d])(\d+(?:\.\d+)?)\s*(?:GB|MB|KB|TB)\b/i.test(label.trim());
}

/** Strip estimates (~) and normalize spacing/casing for display. */
export function normalizeSizeLabel(label: string): string {
  const trimmed = label.trim().replace(/^~\s*/, "");
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/i);
  if (!match) return trimmed;
  return formatUnitSize(parseFloat(match[1]), match[2]);
}

/** Pull GB/MB/KB/TB file sizes from model ids, names, or API fields. */
export function extractFileSizeLabel(
  ...sources: (string | null | undefined)[]
): string | null {
  for (const source of sources) {
    if (!source?.trim()) continue;
    const matches = [...source.matchAll(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/gi)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1];
    const formatted = formatUnitSize(parseFloat(last[1]), last[2]);
    if (formatted) return formatted;
  }
  return null;
}

export function resolveFileSizeLabel(
  ...sources: (string | number | null | undefined)[]
): string | null {
  for (const source of sources) {
    if (typeof source === "number" && source > 0) {
      const formatted = formatFileSize(source);
      if (formatted) return formatted;
    }
  }
  for (const source of sources) {
    if (typeof source !== "string" || !source.trim()) continue;
    if (isFileSizeLabel(source)) {
      return normalizeSizeLabel(source);
    }
  }
  return extractFileSizeLabel(
    ...sources.filter((s): s is string => typeof s === "string")
  );
}
