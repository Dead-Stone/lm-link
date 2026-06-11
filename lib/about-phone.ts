import { Paths } from "expo-file-system";
import { Platform } from "react-native";
import { IS_EXPO_GO, LOCAL_NATIVE_BUILD_MESSAGE } from "./local-models";
import { formatFileSize } from "./model-size";

/** Smallest catalog GGUF plus a little headroom for partial writes. */
const MIN_FREE_STORAGE_FOR_DOWNLOAD = 850_000_000;
const RAM_FOR_3B = 2_800_000_000;
const RAM_FOR_7B = 5_500_000_000;
const RAM_FOR_8B = 7_500_000_000;

type AndroidPlatformConstants = {
  Manufacturer?: string;
  Model?: string;
  Brand?: string;
  Release?: string;
  Version?: number;
  uiMode?: string;
};

export type AboutPhoneStats = {
  deviceLabel: string;
  osLabel: string;
  deviceTypeLabel: string | null;
  ramBytes: number | null;
  totalStorageBytes: number | null;
  freeStorageBytes: number | null;
  nativeBuild: boolean;
};

export type OnDeviceDownloadStatus =
  | "blocked_expo_go"
  | "storage_low"
  | "ram_limited"
  | "ready";

export type OnDeviceDownloadAssessment = {
  status: OnDeviceDownloadStatus;
  statusLabel: string;
  statusDetail: string;
  maxModelHint: string;
  canDownload: boolean;
};

function androidConstants(): AndroidPlatformConstants {
  if (Platform.OS !== "android") return {};
  return Platform.constants as AndroidPlatformConstants;
}

function readStorageBytes(): { total: number | null; free: number | null } {
  try {
    const total = Paths.totalDiskSpace;
    const free = Paths.availableDiskSpace;
    if (total > 0 || free > 0) {
      return { total: total > 0 ? total : null, free: free > 0 ? free : null };
    }
  } catch {
    /* web / unavailable */
  }
  return { total: null, free: null };
}

function resolveDeviceTypeLabel(): string | null {
  const uiMode = androidConstants().uiMode;
  if (uiMode === "tv") return "TV";
  if (uiMode === "watch") return "Watch";
  if (Platform.OS === "android" || Platform.OS === "ios") return "Phone";
  return null;
}

function resolveDeviceLabel(): string {
  const android = androidConstants();
  const fallback = [android.Manufacturer ?? android.Brand, android.Model].filter(Boolean);
  if (fallback.length > 0) return fallback.join(" ");

  if (Platform.OS === "ios") return "iPhone";
  return "This device";
}

function resolveOsLabel(): string {
  if (Platform.OS === "android") {
    const android = androidConstants();
    const api = android.Version ?? Platform.Version;
    return android.Release
      ? `Android ${android.Release} (API ${api})`
      : `Android (API ${api})`;
  }

  if (Platform.OS === "ios" && typeof Platform.Version === "string") {
    return `iOS ${Platform.Version}`;
  }

  return Platform.OS;
}

export function readAboutPhoneStats(): AboutPhoneStats {
  const { total, free } = readStorageBytes();
  return {
    deviceLabel: resolveDeviceLabel(),
    osLabel: resolveOsLabel(),
    deviceTypeLabel: resolveDeviceTypeLabel(),
    ramBytes: null,
    totalStorageBytes: total,
    freeStorageBytes: free,
    nativeBuild: !IS_EXPO_GO,
  };
}

function maxModelHintForRam(ramBytes: number | null): string {
  if (ramBytes == null) return "Up to ~3B models (RAM unknown)";
  if (ramBytes < RAM_FOR_3B) return "Best with ~1B models";
  if (ramBytes < RAM_FOR_7B) return "Up to ~3B models comfortably";
  if (ramBytes < RAM_FOR_8B) return "Up to ~7B models on strong devices";
  return "Up to ~8B models on this device";
}

export function assessOnDeviceDownloads(
  stats: AboutPhoneStats,
  modelsUsedBytes = 0
): OnDeviceDownloadAssessment {
  if (!stats.nativeBuild) {
    return {
      status: "blocked_expo_go",
      statusLabel: "On-device downloads unavailable",
      statusDetail: LOCAL_NATIVE_BUILD_MESSAGE,
      maxModelHint: "Build a dev or preview app to download GGUF models",
      canDownload: false,
    };
  }

  const free = stats.freeStorageBytes;
  if (free != null && free < MIN_FREE_STORAGE_FOR_DOWNLOAD) {
    const need = formatFileSize(MIN_FREE_STORAGE_FOR_DOWNLOAD) || "~850 MB";
    return {
      status: "storage_low",
      statusLabel: "Not enough free storage",
      statusDetail: `${formatFileSize(free) || "Very little space"} free — free at least ${need} to download a small GGUF model.`,
      maxModelHint: modelsUsedBytes > 0 ? "Remove a model or clear space first" : "Clear phone storage, then try again",
      canDownload: false,
    };
  }

  const ramHint = maxModelHintForRam(stats.ramBytes);
  const ramLimited = stats.ramBytes != null && stats.ramBytes < RAM_FOR_3B;

  if (ramLimited) {
    return {
      status: "ram_limited",
      statusLabel: "Limited RAM for larger models",
      statusDetail: `${formatFileSize(stats.ramBytes!) || "Low RAM"} total — stick to small models or close other apps before loading.`,
      maxModelHint: ramHint,
      canDownload: true,
    };
  }

  const storageNote =
    free != null
      ? `${formatFileSize(free) || "Space"} free for downloads`
      : "Storage looks OK for downloads";

  return {
    status: "ready",
    statusLabel: "Ready for on-device downloads",
    statusDetail: `${storageNote}. ${ramHint}.`,
    maxModelHint: ramHint,
    canDownload: true,
  };
}

export function formatAboutPhoneStat(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "Unknown";
  return formatFileSize(bytes) || "Unknown";
}
