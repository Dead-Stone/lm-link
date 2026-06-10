/** Stable display names for discovered LM Studio hosts (Bonjour or random). */

const ADJECTIVES = [
  "Silver",
  "Quiet",
  "Swift",
  "Calm",
  "Bright",
  "Lunar",
  "Cosmic",
  "Velvet",
  "Amber",
  "Crystal",
  "Golden",
  "Misty",
  "Nova",
  "Orchid",
  "Sage",
  "Azure",
] as const;

const NOUNS = [
  "Mac",
  "Studio",
  "Desk",
  "Node",
  "Host",
  "Box",
  "Core",
  "Link",
  "Hub",
  "Beacon",
  "Pulse",
  "Orbit",
  "Spark",
  "Forge",
  "Nexus",
  "Relay",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeUrlKey(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function cleanBonjourName(name: string): string | null {
  let cleaned = name.trim();
  if (!cleaned) return null;

  cleaned = cleaned
    .replace(/^LM Studio on /i, "")
    .replace(/\._lmstudio\._tcp\.local\.?$/i, "")
    .replace(/\._lmstudio-server\._tcp\.local\.?$/i, "")
    .replace(/\.local\.?$/i, "")
    .trim();

  if (!cleaned || /^lm studio$/i.test(cleaned)) return null;
  return cleaned;
}

function hostnameFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return host.replace(/\.local$/i, "");
  } catch {
    return null;
  }
}

function assignRandomName(url: string): string {
  const hash = hashString(normalizeUrlKey(url));
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[(hash >> 4) % NOUNS.length];
  return `${adj}-${noun}`;
}

/** Host portion of a server URL for compact display (e.g. scan list, settings). */
export function formatServerHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/v1.*$/, "");
  }
}

/** Prefer Bonjour name, then non-IP hostname, else a stable random label per URL. */
export function resolveServerDisplayName(url: string, bonjourName?: string | null): string {
  if (bonjourName) {
    const cleaned = cleanBonjourName(bonjourName);
    if (cleaned) return cleaned;
  }

  const host = hostnameFromUrl(url);
  if (host) return host;

  return assignRandomName(url);
}

/** Place a device blip inside the radar circle (deterministic per URL). */
export function radarBlipPosition(
  url: string,
  radarSize: number,
  index = 0
): { x: number; y: number } {
  const hash = hashString(normalizeUrlKey(url));
  const angle =
    ((hash % 360) * Math.PI) / 180 + index * 0.22;
  const radius = radarSize * 0.5 * (0.34 + (hash % 24) / 100);
  const cx = radarSize / 2;
  const cy = radarSize / 2;

  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const BLIP_COLORS = [
  "#8B5CF6",
  "#6366F1",
  "#0EA5E9",
  "#14B8A6",
  "#F59E0B",
  "#EC4899",
  "#10B981",
] as const;

export function radarBlipColor(url: string): string {
  return BLIP_COLORS[hashString(normalizeUrlKey(url)) % BLIP_COLORS.length];
}
