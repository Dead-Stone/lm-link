// lib/auth.ts
import * as SecureStore from "expo-secure-store";
import {
  normalizeServerInputUrl,
  parseConnectionString,
  validateServerCredentials,
} from "./connection-string";
import {
  buildHubRelayUrl,
  HUB_CONNECTION_ENABLED,
  hubUsernameFromRelayUrl,
  isHubUsernameInput,
  normalizeHubUsername,
} from "./hub-url";

export interface LMAccount {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  token: string;       // Bearer token for API calls
  relayUrl?: string;   // LM Studio server URL (e.g. http://192.168.1.5:1234/v1)
}

const STORE_KEY = "lmlink:account";

const HUB_UNAVAILABLE =
  "Hub connection is not available yet. Use your local server URL (http://YOUR-MAC-IP:1234/v1).";

function assertHubAllowed(relayUrl: string, fromUsername = false): void {
  if (HUB_CONNECTION_ENABLED) return;
  if (fromUsername) throw new Error(HUB_UNAVAILABLE);
  const lower = relayUrl.toLowerCase();
  if (lower.includes("lmstudio.ai") || lower.includes(".lm.link")) {
    throw new Error(HUB_UNAVAILABLE);
  }
}

/** Strip whitespace and invisible chars from pasted API tokens. */
export function sanitizeApiToken(raw: string): string {
  return raw.replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}

/** @deprecated Use normalizeHubUsername from hub-url */
export { normalizeHubUsername } from "./hub-url";

/** Saved server URL for the signed-in remote connection. */
export function resolveAccountRelayUrl(
  account: Pick<LMAccount, "email" | "relayUrl">
): string | null {
  return account.relayUrl?.trim() || null;
}

function withRelayUrl(account: LMAccount): LMAccount {
  const relayUrl = resolveAccountRelayUrl(account);
  return relayUrl && account.relayUrl !== relayUrl
    ? { ...account, relayUrl }
    : account;
}

/**
 * Connect with Hub username + token, or a direct server / LM Link URL.
 *
 * Username `your-name` → https://your-name.lmstudio.ai/v1
 * Server URL → http://192.168.1.5:1234/v1
 */
export async function signIn(usernameOrUrl: string, apiKey: string): Promise<LMAccount> {
  const token = sanitizeApiToken(apiKey);
  if (!token) throw new Error("Enter your API token");

  const fromHub = isHubUsernameInput(usernameOrUrl);
  const relayUrl = fromHub
    ? buildHubRelayUrl(usernameOrUrl)
    : normalizeServerInputUrl(usernameOrUrl);
  assertHubAllowed(relayUrl, fromHub);
  const username = fromHub
    ? normalizeHubUsername(usernameOrUrl)
    : hubUsernameFromRelayUrl(relayUrl) ??
      (() => {
        try {
          return new URL(relayUrl).hostname;
        } catch {
          return "server";
        }
      })();

  await validateServerCredentials(relayUrl, token);

  const account: LMAccount = withRelayUrl({
    email: username,
    displayName: username,
    token,
    relayUrl,
  });
  await saveAccount(account);
  return account;
}

/** Sign in or update credentials from a pasted connection string. */
export async function signInWithConnectionString(
  connectionString: string
): Promise<LMAccount> {
  const { relayUrl, token, username } = parseConnectionString(connectionString);
  assertHubAllowed(relayUrl);
  await validateServerCredentials(relayUrl, token);

  const account: LMAccount = withRelayUrl({
    email: username,
    displayName: username,
    token,
    relayUrl,
  });
  await saveAccount(account);
  return account;
}

export async function signOut(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // Key may already be absent — treat as signed out.
  }
}

export async function saveAccount(account: LMAccount): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(account));
}

/** Persist an LM Studio API token for local download/load/unload. */
export async function saveManagementApiToken(
  token: string,
  updateSettings: (partial: { apiKey: string }) => Promise<void>,
  account: LMAccount | null,
  setAccount: (account: LMAccount | null) => void
): Promise<string> {
  const clean = sanitizeApiToken(token);
  if (!clean) throw new Error("Enter your API token");

  await updateSettings({ apiKey: clean });
  if (account) {
    const updated = { ...account, token: clean };
    await saveAccount(updated);
    setAccount(updated);
  }
  return clean;
}

export async function loadAccount(): Promise<LMAccount | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    const account = JSON.parse(raw) as LMAccount;
    const migrated = withRelayUrl({
      ...account,
      token: sanitizeApiToken(account.token ?? ""),
    });
    if (
      migrated.relayUrl !== account.relayUrl ||
      migrated.token !== account.token
    ) {
      await saveAccount(migrated);
    }
    return migrated;
  } catch {
    return null;
  }
}

export function getAccountUrl(account: LMAccount): string | null {
  return resolveAccountRelayUrl(account);
}
