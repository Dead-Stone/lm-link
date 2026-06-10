import type { Ionicons } from "@expo/vector-icons";

import { APP_DISPLAY_NAME } from "./app-name";
import {
  APP_LEGAL_FOOTER,
  LM_STUDIO_TRADEMARK_DISCLAIMER,
} from "./legal";

export const LM_STUDIO_URL = "https://lmstudio.ai";

export const APP_ABOUT_TAGLINE = "A mobile client for LM Studio on Android.";

export const APP_ABOUT_DESCRIPTION =
  "Chat with models served from LM Studio on your Mac or PC over Wi‑Fi, or run quantized GGUF models on-device with llama.cpp. Attach photos for vision models, keep conversation history, and switch between local and remote endpoints.";

export const APP_ABOUT_TRADEMARK = LM_STUDIO_TRADEMARK_DISCLAIMER;

export const APP_ABOUT_LEGAL_FOOTER = APP_LEGAL_FOOTER;

export type AboutHighlight = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
};

export const APP_ABOUT_HIGHLIGHTS: AboutHighlight[] = [
  {
    icon: "chatbubbles-outline",
    label: "Streaming chat",
    detail: "Token-by-token replies with live speed and usage stats",
  },
  {
    icon: "library-outline",
    label: "Model library",
    detail: "Browse, search, and pick models from LM Studio or on-device",
  },
  {
    icon: "phone-portrait-outline",
    label: "On-device inference",
    detail: "Run GGUF models locally via llama.rn — no Mac required",
  },
  {
    icon: "image-outline",
    label: "Vision attachments",
    detail: "Send photos to vision-capable models in the chat composer",
  },
  {
    icon: "wifi-outline",
    label: "Flexible connections",
    detail: "Local network, hub relay, or saved endpoints in Settings",
  },
];
