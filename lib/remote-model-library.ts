import { parseModelName } from "./model-name";

export interface RemoteLibraryEntry {
  id: string;
  name: string;
  publisher: string;
  params?: string;
  sizeLabel?: string;
  /** Short trait beside the model name, e.g. Recomm, Powerful */
  badge?: string;
  badgeColor: string;
  description?: string;
}

/**
 * Curated LM Studio catalog keys for POST /api/v1/models/download.
 * Curated lmstudio.ai/models paths (e.g. qwen/qwen3-4b-2507). Custom downloads also accept Hugging Face strings.
 */
export const REMOTE_MODEL_LIBRARY: RemoteLibraryEntry[] = [
  {
    id: "google/gemma-3-270m",
    name: "Gemma 3 270M",
    publisher: "Google",
    params: "270M",
    sizeLabel: "~550 MB",
    badge: "Tiny",
    badgeColor: "#4285f4",
    description: "Tiny Gemma 3 model — great for quick tests on limited hardware.",
  },
  {
    id: "google/gemma-3-1b",
    name: "Gemma 3 1B",
    publisher: "Google",
    params: "1B",
    sizeLabel: "~755 MB",
    badge: "Compact",
    badgeColor: "#4285f4",
    description: "Compact Google model with solid instruction following.",
  },
  {
    id: "qwen/qwen3-1.7b",
    name: "Qwen3 1.7B",
    publisher: "Qwen",
    params: "1.7B",
    sizeLabel: "~1 GB",
    badge: "Balanced",
    badgeColor: "#06b6d4",
    description: "Small Qwen3 with optional reasoning mode.",
  },
  {
    id: "ibm/granite-4-micro",
    name: "Granite 4 Micro",
    publisher: "IBM",
    params: "3B",
    sizeLabel: "~2 GB",
    badge: "Efficient",
    badgeColor: "#6366f1",
    description: "Compact IBM model for fast local inference.",
  },
  {
    id: "qwen/qwen3-4b-2507",
    name: "Qwen3 4B Instruct",
    publisher: "Qwen",
    params: "4B",
    sizeLabel: "~2.5 GB",
    badge: "Recomm",
    badgeColor: "#06b6d4",
    description: "Strong 4B general-purpose model — LM Studio staff pick.",
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B Instruct",
    publisher: "Meta",
    params: "3B",
    sizeLabel: "~2 GB",
    badge: "Balanced",
    badgeColor: "#0866ff",
    description: "Strong small Llama model — a solid daily driver on Mac.",
  },
  {
    id: "mistralai/mistral-7b-instruct-v0.3",
    name: "Mistral 7B Instruct",
    publisher: "Mistral",
    params: "7B",
    sizeLabel: "~4.1 GB",
    badge: "Popular",
    badgeColor: "#f59e0b",
    description: "Popular open-weight 7B daily driver.",
  },
  {
    id: "deepseek/deepseek-r1-distill-qwen-7b",
    name: "DeepSeek R1 Distill 7B",
    publisher: "DeepSeek",
    params: "7B",
    sizeLabel: "~4.5 GB",
    badge: "Reasoning",
    badgeColor: "#10b981",
    description: "Reasoning-focused distilled model.",
  },
  {
    id: "microsoft/phi-4",
    name: "Phi 4",
    publisher: "Microsoft",
    params: "14B",
    sizeLabel: "~8 GB",
    badge: "Powerful",
    badgeColor: "#2563eb",
    description: "Microsoft's capable mid-size chat model.",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "gpt-oss 20B",
    publisher: "OpenAI",
    params: "20B",
    sizeLabel: "~12 GB",
    badge: "MoE",
    badgeColor: "#22c55e",
    description: "OpenAI's open MoE model with tool use and reasoning (needs ~12 GB RAM).",
  },
];

/** Curated Mac/PC picks for Quick download (chat picker + model library). */
export const QUICK_ACCESS_REMOTE_MODEL_IDS = [
  "google/gemma-3-270m",
  "google/gemma-3-1b",
  "qwen/qwen3-1.7b",
  "ibm/granite-4-micro",
  "qwen/qwen3-4b-2507",
  "meta-llama/llama-3.2-3b-instruct",
  "mistralai/mistral-7b-instruct-v0.3",
  "deepseek/deepseek-r1-distill-qwen-7b",
  "microsoft/phi-4",
  "openai/gpt-oss-20b",
] as const;

export function normalizeModelKey(id: string): string {
  return id.toLowerCase().replace(/@.*$/, "").replace(/\.gguf$/i, "");
}

export function findCuratedRemoteLibraryEntry(
  id: string
): RemoteLibraryEntry | undefined {
  const key = normalizeModelKey(id);
  return REMOTE_MODEL_LIBRARY.find((item) => normalizeModelKey(item.id) === key);
}

/** Title for library/download rows — curated names first, then parsed id (matches model picker). */
export function resolveRemoteLibraryDisplayName(
  entry: Pick<RemoteLibraryEntry, "id" | "name">
): string {
  const key = normalizeModelKey(entry.id);
  const curated = REMOTE_MODEL_LIBRARY.find((item) => normalizeModelKey(item.id) === key);
  if (curated?.name?.trim()) return curated.name;

  const trimmedName = entry.name?.trim();
  if (trimmedName) return trimmedName;

  const { displayName } = parseModelName(entry.id);
  return displayName || entry.id;
}

export function isModelInstalled(installedIds: string[], libraryId: string): boolean {
  const key = normalizeModelKey(libraryId);
  return installedIds.some((id) => {
    const normalized = normalizeModelKey(id);
    return normalized === key || normalized.endsWith(key) || key.endsWith(normalized);
  });
}

export function getQuickAccessRemoteLibrary(installedIds: string[]): RemoteLibraryEntry[] {
  const entries: RemoteLibraryEntry[] = [];
  for (const id of QUICK_ACCESS_REMOTE_MODEL_IDS) {
    const entry = REMOTE_MODEL_LIBRARY.find(
      (item) => normalizeModelKey(item.id) === normalizeModelKey(id)
    );
    if (!entry || isModelInstalled(installedIds, entry.id)) continue;
    entries.push(entry);
  }
  return entries;
}
