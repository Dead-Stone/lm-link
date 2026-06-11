import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "lmlink:pc_downloads_from_phone_enabled";
export const PC_DOWNLOAD_TERMS_VERSION = 1;

type Listener = () => void;

let cachedEnabled: boolean | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export async function isPcDownloadFromPhoneEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedEnabled = raw === "true";
    return cachedEnabled;
  } catch {
    return false;
  }
}

export function getPcDownloadFromPhoneEnabledSync(): boolean {
  return cachedEnabled === true;
}

export async function setPcDownloadFromPhoneEnabled(enabled: boolean): Promise<void> {
  cachedEnabled = enabled;
  if (enabled) {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

export function subscribePcDownloadFromPhoneEnabled(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function hydratePcDownloadFromPhoneEnabled(): Promise<boolean> {
  return isPcDownloadFromPhoneEnabled();
}
