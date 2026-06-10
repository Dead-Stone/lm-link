import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { stripConversationForStorage } from "./conversation-storage";
import { sanitizeApiToken } from "./auth";
import { ConnectionProfile, Conversation, Settings } from "./types";

const KEYS = {
  CONVERSATIONS: "lmlink:conversations",
  SETTINGS: "lmlink:settings",
  ACTIVE_CONVERSATION: "lmlink:active_conversation",
  ONBOARDING_DONE: "lmlink:onboarding_done",
};

const SECURE_KEYS = {
  HF_TOKEN: "lmlink:hf_token",
  API_KEY: "lmlink:api_key",
} as const;

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureCredentialError extends Error {
  constructor(message = "Could not save credentials securely. Try again.") {
    super(message);
    this.name = "SecureCredentialError";
  }
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: "http://localhost:1234/v1",
  defaultModel: "",
  defaultLocalModel: "",
  defaultSystemPrompt:
    "You are a helpful, concise AI assistant. Be direct and clear in your responses.",
  temperature: 0.7,
  maxTokens: 2048,
  theme: "dark",
  singleModelMode: true,
  connectionProfiles: [],
};

async function readSecureToken(key: string): Promise<string | undefined> {
  try {
    const token = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    const clean = sanitizeApiToken(token ?? "");
    return clean || undefined;
  } catch {
    return undefined;
  }
}

async function writeSecureToken(key: string, token: string | undefined): Promise<boolean> {
  try {
    const clean = token ? sanitizeApiToken(token) : "";
    if (clean) {
      await SecureStore.setItemAsync(key, clean, SECURE_STORE_OPTIONS);
    } else {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    }
    return true;
  } catch {
    return false;
  }
}

async function clearSecureToken(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    /* ignore */
  }
}

async function readSecureHfToken(): Promise<string | undefined> {
  return readSecureToken(SECURE_KEYS.HF_TOKEN);
}

async function writeSecureHfToken(token: string | undefined): Promise<boolean> {
  return writeSecureToken(SECURE_KEYS.HF_TOKEN, token);
}

async function readSecureApiKey(): Promise<string | undefined> {
  return readSecureToken(SECURE_KEYS.API_KEY);
}

async function writeSecureApiKey(token: string | undefined): Promise<boolean> {
  return writeSecureToken(SECURE_KEYS.API_KEY, token);
}

async function clearAllSecureCredentials(): Promise<void> {
  await Promise.all([
    clearSecureToken(SECURE_KEYS.HF_TOKEN),
    clearSecureToken(SECURE_KEYS.API_KEY),
  ]);
}

type PersistedSettings = Omit<Settings, "hfToken" | "apiKey">;

function stripSecretsFromSettingsPayload(settings: Settings): PersistedSettings {
  const { hfToken: _hfToken, apiKey: _apiKey, ...rest } = settings;
  const profiles = settings.connectionProfiles?.map((profile) => {
    const { apiKey: _profileApiKey, ...safeProfile } = profile;
    return safeProfile;
  });
  return {
    ...rest,
    ...(profiles ? { connectionProfiles: profiles } : {}),
  };
}

function legacyApiKeyFromSettings(parsed: Settings): string {
  const settingsKey = parsed.apiKey ? sanitizeApiToken(parsed.apiKey) : "";
  if (settingsKey) return settingsKey;
  for (const profile of parsed.connectionProfiles ?? []) {
    const profileKey = profile.apiKey ? sanitizeApiToken(profile.apiKey) : "";
    if (profileKey) return profileKey;
  }
  return "";
}

function settingsPayloadHasLegacySecrets(parsed: Settings): boolean {
  return (
    Boolean(parsed.hfToken) ||
    Boolean(parsed.apiKey) ||
    (parsed.connectionProfiles ?? []).some((profile) => Boolean(profile.apiKey))
  );
}

async function attachSecureCredentials(parsed: Settings): Promise<Settings> {
  const legacyHfToken = parsed.hfToken ? sanitizeApiToken(parsed.hfToken) : "";
  const legacyApiKey = legacyApiKeyFromSettings(parsed);
  const secureHfToken = await readSecureHfToken();
  const secureApiKey = await readSecureApiKey();

  const hfToken = secureHfToken ?? (legacyHfToken || undefined);
  const apiKey = secureApiKey ?? (legacyApiKey || undefined);

  let hfReady = Boolean(secureHfToken) || !legacyHfToken;
  let apiReady = Boolean(secureApiKey) || !legacyApiKey;

  if (legacyHfToken && !secureHfToken) {
    hfReady = await writeSecureHfToken(hfToken);
  }

  if (legacyApiKey && !secureApiKey) {
    apiReady = await writeSecureApiKey(apiKey);
  }

  if (settingsPayloadHasLegacySecrets(parsed) && hfReady && apiReady) {
    await AsyncStorage.setItem(
      KEYS.SETTINGS,
      JSON.stringify(stripSecretsFromSettingsPayload(parsed))
    );
  }

  return { ...stripSecretsFromSettingsPayload(parsed), hfToken, apiKey };
}

async function persistSecureCredentials(settings: Settings): Promise<void> {
  const hfToken = settings.hfToken ? sanitizeApiToken(settings.hfToken) : undefined;
  const apiKey = settings.apiKey ? sanitizeApiToken(settings.apiKey) : undefined;

  const [hfOk, apiOk] = await Promise.all([
    writeSecureHfToken(hfToken),
    writeSecureApiKey(apiKey),
  ]);

  if (!hfOk || !apiOk) {
    throw new SecureCredentialError();
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    const parsed = raw
      ? ({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings)
      : { ...DEFAULT_SETTINGS };
    return attachSecureCredentials(parsed);
  } catch {
    const [hfToken, apiKey] = await Promise.all([readSecureHfToken(), readSecureApiKey()]);
    return { ...DEFAULT_SETTINGS, hfToken, apiKey };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await persistSecureCredentials(settings);
  await AsyncStorage.setItem(
    KEYS.SETTINGS,
    JSON.stringify(stripSecretsFromSettingsPayload(settings))
  );
}

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    if (!raw) return [];
    const conversations: Conversation[] = JSON.parse(raw);
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const stored = stripConversationForStorage(conv);
  const all = await getConversations();
  const idx = all.findIndex((c) => c.id === conv.id);
  if (idx >= 0) {
    all[idx] = stored;
  } else {
    all.unshift(stored);
  }
  await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(all));
}

export async function deleteConversation(id: string): Promise<void> {
  const all = await getConversations();
  const filtered = all.filter((c) => c.id !== id);
  await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(filtered));
}

export async function getConversation(
  id: string
): Promise<Conversation | null> {
  const all = await getConversations();
  return all.find((c) => c.id === id) ?? null;
}

// ─── Active conversation ───────────────────────────────────────────────────────

export async function getActiveConversationId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ACTIVE_CONVERSATION);
}

export async function setActiveConversationId(id: string | null): Promise<void> {
  if (id === null) {
    await AsyncStorage.removeItem(KEYS.ACTIVE_CONVERSATION);
  } else {
    await AsyncStorage.setItem(KEYS.ACTIVE_CONVERSATION, id);
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDING_DONE);
    return val === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING_DONE, "true");
}

/** Wipe all persisted app data (settings, chats, onboarding, etc.). */
export async function clearAllAppData(): Promise<void> {
  await AsyncStorage.clear();
  await clearAllSecureCredentials();
}

// ─── Connection Profiles ──────────────────────────────────────────────────────

export async function getConnectionProfiles(): Promise<ConnectionProfile[]> {
  const s = await getSettings();
  return s.connectionProfiles ?? [];
}

export async function saveConnectionProfile(profile: ConnectionProfile): Promise<void> {
  const s = await getSettings();
  const profiles = s.connectionProfiles ?? [];
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await saveSettings({ ...s, connectionProfiles: profiles });
}

export async function deleteConnectionProfile(id: string): Promise<void> {
  const s = await getSettings();
  const profiles = (s.connectionProfiles ?? []).filter((p) => p.id !== id);
  const patch: Partial<Settings> = { connectionProfiles: profiles };
  if (s.activeProfileId === id) {
    patch.activeProfileId = undefined;
    patch.apiKey = undefined;
  }
  await saveSettings({ ...s, ...patch });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().slice(0, 60);
  return trimmed.length < firstMessage.trim().length
    ? trimmed + "…"
    : trimmed || "New conversation";
}
