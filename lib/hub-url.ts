/** LM Studio Hub per-user relay base: https://{username}.lmstudio.ai/v1 */

/** Hub relay sign-in is not ready yet — keep Local as the primary connection path. */
export const HUB_CONNECTION_ENABLED = false;

export function normalizeHubUsername(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  const base = at > 0 ? trimmed.slice(0, at) : trimmed;
  return base.replace(/[^a-z0-9-]/g, "");
}

export function buildHubRelayUrl(username: string): string {
  const user = normalizeHubUsername(username);
  if (!user) throw new Error("Enter your LM Studio username");
  return `https://${user}.lmstudio.ai/v1`;
}

export function buildHubConnectionString(username: string, token: string): string {
  const url = new URL(buildHubRelayUrl(username));
  url.searchParams.set("token", token.trim());
  return url.toString();
}

/** True when input is a Hub username (not an IP, URL, or host:port). */
export function isHubUsernameInput(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.includes("://") || s.includes("/")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(s)) return false;
  if (s.includes(":")) return false;
  return /^[a-zA-Z0-9-]+$/.test(s);
}

export function hubUsernameFromRelayUrl(relayUrl: string): string | null {
  try {
    const host = new URL(relayUrl).hostname.toLowerCase();
    if (!host.endsWith(".lmstudio.ai")) return null;
    const user = host.slice(0, -".lmstudio.ai".length);
    return user || null;
  } catch {
    return null;
  }
}
