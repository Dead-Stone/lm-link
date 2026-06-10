import type { Ionicons } from "@expo/vector-icons";

export type ErrorKind = "network" | "auth" | "server" | "local" | "general";

export interface ErrorPresentation {
  kind: ErrorKind;
  title: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const NETWORK_HINT =
  "Make sure your phone and computer are on the same Wi‑Fi, LM Studio's server is running, and network access is enabled in LM Studio.";

const AUTH_HINT =
  "Check your username and API token in LM Studio → Developer → Manage Tokens.";

const LOCAL_HINT =
  "On-device models need llama.cpp, which only ships in a dev or preview build — not Expo Go. Run npx expo run:android or use EAS Build, then open Model Library → On-Device.";

function inferKind(message: string): ErrorKind {
  const m = message.toLowerCase();
  if (
    /network|wifi|wi-fi|fetch|connect|timeout|abort|econnrefused|unreachable|host|subnet|scan|mdns|bonjour|local network/.test(m)
  ) {
    return "network";
  }
  if (/token|401|403|unauthorized|forbidden|username|sign.?in|auth|invalid api/.test(m)) {
    return "auth";
  }
  if (/native build|expo go|llama|gguf|download|on-device|model not/.test(m)) {
    return "local";
  }
  if (/server|5\d{2}|failed to fetch models|lm studio/.test(m)) {
    return "server";
  }
  return "general";
}

const PRESETS: Record<ErrorKind, Omit<ErrorPresentation, "kind">> = {
  network: {
    title: "Connection problem",
    hint: NETWORK_HINT,
    icon: "wifi-outline",
  },
  auth: {
    title: "Sign-in failed",
    hint: AUTH_HINT,
    icon: "key-outline",
  },
  server: {
    title: "LM Studio error",
    hint: "Confirm a model is loaded and the server is running on your computer.",
    icon: "server-outline",
  },
  local: {
    title: "On-device unavailable",
    hint: LOCAL_HINT,
    icon: "construct-outline",
  },
  general: {
    title: "Something went wrong",
    icon: "alert-circle-outline",
  },
};

export function presentError(message: string, kind?: ErrorKind): ErrorPresentation {
  const k = kind ?? inferKind(message);
  return { kind: k, ...PRESETS[k] };
}

export function errorFromUnknown(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

/** User-facing copy for Settings → Test connection (plain inline text, no chrome). */
export function formatConnectionTestError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Could not reach LM Studio on that address.";

  const pres = presentError(trimmed);
  const lower = trimmed.toLowerCase();

  if (/invalid api token|check your hub token/.test(lower)) {
    return "Invalid API token — check the token in Advanced settings.";
  }
  if (/enter your server url|invalid server url/.test(lower)) {
    return trimmed;
  }

  const statusMatch = /failed to fetch models:\s*(\d+)/i.exec(trimmed);
  if (statusMatch) {
    const code = statusMatch[1];
    if (code === "404") {
      return "Server not found — check the URL ends with /v1 and LM Studio is running.";
    }
    return `LM Studio returned HTTP ${code} — start the server in Developer and try again.`;
  }

  if (
    /network request failed|failed to fetch|timeout|timed out|abort|econnrefused|enotfound|could not connect|unreachable|same wi-?fi/.test(
      lower
    )
  ) {
    return pres.hint ?? NETWORK_HINT;
  }

  if (pres.kind === "auth" && pres.hint) return pres.hint;
  if (pres.kind === "network" && pres.hint) return pres.hint;

  return trimmed;
}
