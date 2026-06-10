import { MessageStats } from "./types";

export type StreamingMessageStats = {
  tokensPerSec: number;
  totalTokens: number;
  elapsedMs: number;
};

function joinStatParts(parts: string[]): string | null {
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

export function formatMessageStatsLabel(
  stats: Pick<MessageStats, "tokensPerSec" | "totalTokens" | "totalTimeMs" | "timeToFirstTokenMs">
): string | null {
  const parts: string[] = [];
  if (stats.tokensPerSec > 0) {
    parts.push(`${stats.tokensPerSec.toFixed(1)} tok/s`);
  }
  if (stats.totalTokens > 0) {
    parts.push(`${stats.totalTokens} token${stats.totalTokens === 1 ? "" : "s"}`);
  }
  if (stats.totalTimeMs > 0) {
    parts.push(`${(stats.totalTimeMs / 1000).toFixed(1)}s`);
  } else if (stats.timeToFirstTokenMs > 0) {
    parts.push(`TTFT ${(stats.timeToFirstTokenMs / 1000).toFixed(1)}s`);
  }
  return joinStatParts(parts);
}

export function formatStreamingStatsLabel(stats: StreamingMessageStats): string | null {
  const parts: string[] = [];
  if (stats.tokensPerSec > 0) {
    parts.push(`${stats.tokensPerSec.toFixed(1)} tok/s`);
  }
  if (stats.totalTokens > 0) {
    parts.push(`${stats.totalTokens} token${stats.totalTokens === 1 ? "" : "s"}`);
  }
  if (stats.elapsedMs > 0) {
    parts.push(`${(stats.elapsedMs / 1000).toFixed(1)}s`);
  }
  return joinStatParts(parts);
}
