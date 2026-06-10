import AsyncStorage from "@react-native-async-storage/async-storage";
import { stripConversationForStorage } from "./conversation-storage";
import { ConnectionProfile, Conversation, Settings } from "./types";

const KEYS = {
  CONVERSATIONS: "lmlink:conversations",
  SETTINGS: "lmlink:settings",
  ACTIVE_CONVERSATION: "lmlink:active_conversation",
  ONBOARDING_DONE: "lmlink:onboarding_done",
};

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

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
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
