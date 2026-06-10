import {
  buildHubConnectionString,
  buildHubRelayUrl,
  hubUsernameFromRelayUrl,
  normalizeHubUsername,
} from "./hub-url";

export interface ParsedHubConnection {
  relayUrl: string;
  token: string;
  username: string;
}

const VALIDATE_TIMEOUT_MS = 20_000;

function sanitizeToken(raw: string): string {
  return raw.replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}

function modelBaseHost(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/i, "");
  url = url.replace(/\/v1$/i, "");
  return url.replace(/\/+$/, "");
}

function looksLikeServerAddress(raw: string): boolean {
  const s = raw.trim();
  return (
    s.includes("://") ||
    s.includes("/") ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(s) ||
    (s.includes(".") && s.includes(":"))
  );
}

/** Normalize user-entered server URL (bare IP, lmlink://, etc.) to /v1 base. */
export function normalizeServerInputUrl(raw: string): string {
  let url = raw.trim();
  if (!url) throw new Error("Enter your server URL");
  if (!url.includes("://")) {
    url = `http://${url}`;
  }
  return normalizeConnectionBaseUrl(url);
}

/** Normalize relay / LM Link URLs to OpenAI-compatible /v1 base. */
export function normalizeConnectionBaseUrl(raw: string): string {
  let url = raw.trim();
  if (url.startsWith("lmlink://")) {
    url = `https://${url.slice("lmlink://".length)}`;
  }
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/i, "/v1");
  if (!/\/v\d+$/i.test(url)) url = `${url}/v1`;
  return url;
}

export function displayLabelFromRelayUrl(relayUrl: string): string {
  try {
    const host = new URL(relayUrl).host;
    return host || relayUrl;
  } catch {
    return relayUrl;
  }
}

function usernameFromRelayUrl(relayUrl: string): string {
  return displayLabelFromRelayUrl(relayUrl);
}

function networkErrorMessage(serverUrl: string, cause?: string): Error {
  const hubUser = hubUsernameFromRelayUrl(serverUrl);
  const lower = (cause ?? "").toLowerCase();
  const isDnsFailure =
    lower.includes("resolve") ||
    lower.includes("enotfound") ||
    lower.includes("could not resolve") ||
    lower.includes("network request failed");

  if (hubUser && isDnsFailure) {
    return new Error(
      `Hub address https://${hubUser}.lmstudio.ai is not reachable — the subdomain may not be provisioned yet. Enable LM Link for Android in LM Studio on your Mac, or use your local server URL (http://YOUR-MAC-IP:1234/v1) in Advanced.`
    );
  }
  if (isDnsFailure) {
    return new Error(
      `Cannot reach ${displayLabelFromRelayUrl(serverUrl)} — check the URL and your network connection.`
    );
  }
  return new Error(
    `Cannot reach ${displayLabelFromRelayUrl(serverUrl)}. Open LM Studio → Developer → Start Server, copy the network URL, and ensure your phone is on the same Wi‑Fi. For LM Link for Android, paste the full connection string in Advanced.`
  );
}

/** Validate server URL + API token against LM Studio OpenAI or native /models endpoints. */
export async function validateServerCredentials(
  serverUrl: string,
  token: string
): Promise<void> {
  const base = normalizeConnectionBaseUrl(serverUrl);
  const host = modelBaseHost(base);
  const cleanToken = sanitizeToken(token);
  if (!cleanToken) throw new Error("Enter your API token");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);

  const endpoints = [
    `${base}/models`,
    `${host}/api/v1/models`,
    `${host}/api/v0/models`,
  ];

  let lastStatus: number | undefined;
  let lastCause: string | undefined;

  try {
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (res.ok) return;
        lastStatus = res.status;
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            "Invalid API token — create one in LM Studio → Developer → Manage Tokens (same token you use for the model)"
          );
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (e.message.includes("Invalid API token")) throw e;
          if (e.name === "AbortError") {
            throw new Error(
              "Connection timed out — check the server URL and that LM Studio is running"
            );
          }
          lastCause = e.message;
        }
      }
    }

    if (lastStatus) {
      throw new Error(`Server returned ${lastStatus} — is a model loaded in LM Studio?`);
    }
    throw networkErrorMessage(base, lastCause);
  } catch (e: unknown) {
    if (e instanceof Error) throw e;
    throw networkErrorMessage(base);
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonConnection(raw: string): ParsedHubConnection {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const url = obj.url ?? obj.baseUrl ?? obj.relayUrl;
  const token = obj.token ?? obj.apiKey ?? obj.api_key;
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("JSON must include url (or baseUrl / relayUrl)");
  }
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("JSON must include token (or apiKey)");
  }
  const relayUrl = normalizeServerInputUrl(url);
  return {
    relayUrl,
    token: sanitizeToken(token),
    username: usernameFromRelayUrl(relayUrl),
  };
}

function parsePipeConnection(raw: string): ParsedHubConnection {
  const pipe = raw.indexOf("|");
  const left = raw.slice(0, pipe).trim();
  const right = raw.slice(pipe + 1).trim();
  if (!left || !right) {
    throw new Error("Use username|token or http://192.168.1.5:1234/v1|token");
  }
  if (!looksLikeServerAddress(left)) {
    const user = normalizeHubUsername(left);
    return {
      relayUrl: buildHubRelayUrl(user),
      token: sanitizeToken(right),
      username: user,
    };
  }
  const relayUrl = normalizeServerInputUrl(left);
  return {
    relayUrl,
    token: sanitizeToken(right),
    username: usernameFromRelayUrl(relayUrl),
  };
}

function parseUrlConnection(raw: string): ParsedHubConnection {
  let urlStr = raw.trim();
  if (urlStr.startsWith("lmlink://")) {
    urlStr = `https://${urlStr.slice("lmlink://".length)}`;
  }

  const parsed = new URL(urlStr);
  let token =
    parsed.searchParams.get("token") ??
    parsed.searchParams.get("api_key") ??
    parsed.searchParams.get("apikey") ??
    parsed.searchParams.get("key") ??
    "";

  if (!token && parsed.hash) {
    const hashBody = parsed.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashBody);
    token =
      hashParams.get("token") ??
      hashParams.get("api_key") ??
      hashParams.get("key") ??
      hashBody;
  }

  if (!token && parsed.password) {
    token = decodeURIComponent(parsed.password);
  }

  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  const relayUrl = normalizeConnectionBaseUrl(parsed.toString());

  if (!token) {
    throw new Error(
      "URL must include a token (?token=…) or use url|token format"
    );
  }

  return {
    relayUrl,
    token: sanitizeToken(token),
    username: usernameFromRelayUrl(relayUrl),
  };
}

/**
 * Parse remote connection strings:
 * - http://192.168.1.5:1234/v1?token=lms-…
 * - lmlink://device.lm.link/v1?token=…
 * - http://192.168.1.5:1234/v1|lms-…
 * - {"url":"…","token":"…"}
 */
export function parseConnectionString(input: string): ParsedHubConnection {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a connection string");

  if (trimmed.startsWith("{")) {
    return parseJsonConnection(trimmed);
  }

  if (trimmed.includes("|")) {
    return parsePipeConnection(trimmed);
  }

  if (trimmed.includes("://") || looksLikeServerAddress(trimmed)) {
    if (!trimmed.includes("://")) {
      return parseUrlConnection(`http://${trimmed}`);
    }
    return parseUrlConnection(trimmed);
  }

  throw new Error(
    "Unrecognized format — try http://192.168.1.5:1234/v1?token=lms-… or url|token"
  );
}

/** Build a copyable Hub connection string from username + token. */
export function formatHubConnectionString(
  relayUrl: string,
  token: string
): string {
  const hubUser = hubUsernameFromRelayUrl(relayUrl);
  if (hubUser) {
    return buildHubConnectionString(hubUser, token);
  }
  const base = normalizeConnectionBaseUrl(relayUrl);
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
}
