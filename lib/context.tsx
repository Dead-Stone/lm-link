import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LMAccount, loadAccount, resolveAccountRelayUrl, signOut } from "./auth";
import {
  getHubConnectionPatch,
  isHubConnectionActive,
  isHubUrl,
} from "./api";
import { HUB_CONNECTION_ENABLED } from "./hub-url";
import { Conversation, Settings } from "./types";
import {
  clearAllAppData,
  DEFAULT_SETTINGS,
  deleteConversation as storageDelete,
  generateId,
  getConversations,
  getSettings,
  saveConversation,
  saveSettings,
} from "./storage";

// ─── Settings context ─────────────────────────────────────────────────────────

export interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  account: LMAccount | null;
  setAccount: (a: LMAccount | null) => void;
  isLoading: boolean;
  resetApp: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Conversations context ──────────────────────────────────────────────────────

export interface ConversationsContextValue {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  setActiveConversation: (conv: Conversation | null) => void;
  createConversation: () => Conversation;
  updateConversation: (conv: Conversation) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

// ─── Combined provider ────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [account, setAccountState] = useState<LMAccount | null>(null);
  const resettingRef = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    (async () => {
      const [s, c, acc] = await Promise.all([
        getSettings(),
        getConversations(),
        loadAccount(),
      ]);
      setSettings(s);
      setConversations(c);
      if (acc) {
        setAccountState(acc);
        const relayUrl = resolveAccountRelayUrl(acc);
        const hubRelay =
          HUB_CONNECTION_ENABLED && relayUrl && isHubUrl(relayUrl);
        if (relayUrl && hubRelay && !isHubConnectionActive(s, acc)) {
          const patched = { ...s, ...getHubConnectionPatch(acc, s) };
          setSettings(patched);
          settingsRef.current = patched;
          try {
            await saveSettings(patched);
          } catch {
            /* keep legacy storage until secure write succeeds */
          }
        } else if (
          relayUrl &&
          hubRelay &&
          isHubConnectionActive(s, acc) &&
          acc.token !== s.apiKey
        ) {
          const patched = { ...s, apiKey: acc.token };
          setSettings(patched);
          settingsRef.current = patched;
          try {
            await saveSettings(patched);
          } catch {
            /* keep legacy storage until secure write succeeds */
          }
        } else if (relayUrl && !hubRelay) {
          const patched = { ...s, ...getHubConnectionPatch(acc, s) };
          setSettings(patched);
          settingsRef.current = patched;
          try {
            await saveSettings(patched);
          } catch {
            /* keep legacy storage until secure write succeeds */
          }
        } else if (acc.token && !s.apiKey) {
          const patched = { ...s, apiKey: acc.token };
          setSettings(patched);
          settingsRef.current = patched;
          try {
            await saveSettings(patched);
          } catch {
            /* keep legacy storage until secure write succeeds */
          }
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const setAccount = useCallback((a: LMAccount | null) => {
    setAccountState(a);
    if (a) {
      const next: Settings = {
        ...settingsRef.current,
        ...getHubConnectionPatch(a, settingsRef.current),
      };
      setSettings(next);
      settingsRef.current = next;
      void saveSettings(next).catch(() => {
        /* surfaced when user explicitly saves settings */
      });
    }
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    if (resettingRef.current) return;
    const next = { ...settingsRef.current, ...partial };
    setSettings(next);
    settingsRef.current = next;
    await saveSettings(next);
  }, []);

  const refreshConversations = useCallback(async () => {
    const c = await getConversations();
    setConversations(c);
  }, []);

  const createConversation = useCallback((): Conversation => {
    const now = Date.now();
    const conv: Conversation = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
      systemPrompt: settings.defaultSystemPrompt,
    };
    return conv;
  }, [settings.defaultSystemPrompt]);

  const updateConversation = useCallback(async (conv: Conversation) => {
    if (resettingRef.current) return;
    await saveConversation(conv);
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = conv;
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return [conv, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
    });
    setActiveConversation((prev) => (prev?.id === conv.id ? conv : prev));
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    if (resettingRef.current) return;
    await storageDelete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveConversation((prev) => (prev?.id === id ? null : prev));
  }, []);

  const resetApp = useCallback(async () => {
    resettingRef.current = true;
    try {
      setConversations([]);
      setActiveConversation(null);
      setAccountState(null);
      setSettings(DEFAULT_SETTINGS);
      await signOut();
      await clearAllAppData();
      await saveSettings(DEFAULT_SETTINGS);
    } finally {
      resettingRef.current = false;
    }
  }, []);

  const settingsValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      account,
      setAccount,
      isLoading,
      resetApp,
    }),
    [settings, updateSettings, account, setAccount, isLoading, resetApp]
  );

  const conversationsValue = useMemo<ConversationsContextValue>(
    () => ({
      conversations,
      activeConversation,
      setActiveConversation,
      createConversation,
      updateConversation,
      removeConversation,
      refreshConversations,
    }),
    [
      conversations,
      activeConversation,
      createConversation,
      updateConversation,
      removeConversation,
      refreshConversations,
    ]
  );

  return (
    <SettingsContext.Provider value={settingsValue}>
      <ConversationsContext.Provider value={conversationsValue}>
        {children}
      </ConversationsContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within AppProvider");
  return ctx;
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within AppProvider");
  return ctx;
}

/** Full app context — prefer `useSettings` / `useConversations` for narrower subscriptions. */
export function useApp() {
  const settingsCtx = useSettings();
  const convCtx = useConversations();
  return useMemo(
    () => ({ ...settingsCtx, ...convCtx }),
    [settingsCtx, convCtx]
  );
}
