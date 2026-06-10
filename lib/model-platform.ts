import { Ionicons } from "@expo/vector-icons";
import { isHubUrl } from "./api";
import { ChatModelMode, ModelPlatform } from "./types";

export function resolveModelPlatform(
  mode: ChatModelMode,
  baseUrl?: string | null
): ModelPlatform {
  if (mode === "local") return "phone";
  if (baseUrl && isHubUrl(baseUrl)) return "hub";
  return "pc";
}

export function platformRemoteLabel(platform: ModelPlatform): string {
  switch (platform) {
    case "hub":
      return "Hub";
    case "pc":
      return "System";
    case "phone":
      return "On-Device";
  }
}

export function platformShellIcon(
  platform: ModelPlatform
): keyof typeof Ionicons.glyphMap {
  switch (platform) {
    case "hub":
      return "cloud-outline";
    case "pc":
      return "laptop-outline";
    case "phone":
      return "phone-portrait-outline";
  }
}

export function platformShellLayout(platform: ModelPlatform, size: number) {
  switch (platform) {
    case "hub":
      return { logoScale: 0.46, logoTop: size * 0.28 };
    case "pc":
      return { logoScale: 0.42, logoTop: size * 0.24 };
    case "phone":
      return { logoScale: 0.4, logoTop: size * 0.3 };
  }
}
