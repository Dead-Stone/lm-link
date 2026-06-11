import { isGatedHfCatalogId, catalogIdToCommunityGgufDownloadUrl } from "./catalog-hf-repo";
import { normalizeModelKey } from "./model-id";
import { resolveRemoteDownloadModelString } from "./model-download-string";
import { extractModelParamLabel, parseModelName } from "./model-name";
import { estimateDownloadSizeFromParams, resolveFileSizeLabel } from "./model-size";

export { normalizeModelKey } from "./model-id";
import {
  ModelCapabilityFilter,
  modelMatchesCapabilityFilter,
  remoteLibraryEntryHaystack,
} from "./vision-models";

export const QUICK_ACCESS_LIMIT = 5;

export type LibraryDownloadSource = "lmstudio" | "huggingface";

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
  /** Popularity metric — LM Studio hub when available, else Hugging Face. */
  downloads?: number;
  downloadSource?: LibraryDownloadSource;
  /** Override for POST /api/v1/models/download when the catalog id is missing or gated. */
  downloadModel?: string;
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
    id: "meta-llama/llama-3.2-1b-instruct",
    name: "Llama 3.2 1B Instruct",
    publisher: "Meta",
    params: "1B",
    sizeLabel: "~670 MB",
    badge: "Efficient",
    badgeColor: "#0866ff",
    description: "Meta's efficient small Llama — great daily driver on Mac.",
    downloadSource: "huggingface",
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
    downloadSource: "huggingface",
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
  {
    id: "google/gemma-3n-e4b",
    name: "Gemma 3n E4B",
    publisher: "Google",
    params: "4B",
    sizeLabel: "~3 GB",
    badge: "Vision",
    badgeColor: "#4285f4",
    description: "Compact multimodal Gemma — image and video understanding on Mac.",
    downloadSource: "huggingface",
  },
  {
    id: "google/gemma-3n-e2b",
    name: "Gemma 3n E2B",
    publisher: "Google",
    params: "2B",
    sizeLabel: "~1.8 GB",
    badge: "Vision",
    badgeColor: "#4285f4",
    description: "Lightweight multimodal Gemma for vision chat.",
    downloadSource: "huggingface",
  },
  {
    id: "qwen/qwen2.5-vl-3b-instruct",
    name: "Qwen2.5-VL 3B",
    publisher: "Qwen",
    params: "3B",
    sizeLabel: "~2 GB",
    badge: "Vision",
    badgeColor: "#06b6d4",
    description: "Small vision-language model for image and video chat.",
    downloadSource: "huggingface",
  },
  {
    id: "qwen/qwen2.5-vl-7b-instruct",
    name: "Qwen2.5-VL 7B",
    publisher: "Qwen",
    params: "7B",
    sizeLabel: "~4.7 GB",
    badge: "Vision",
    badgeColor: "#06b6d4",
    description: "Stronger Qwen vision model for detailed image understanding.",
    downloadSource: "huggingface",
  },
  {
    id: "qwen/qwen3-vl-4b",
    name: "Qwen3-VL 4B",
    publisher: "Qwen",
    params: "4B",
    sizeLabel: "~2.5 GB",
    badge: "Vision",
    badgeColor: "#06b6d4",
    description: "Latest Qwen3 vision model — image and video inputs.",
    downloadSource: "huggingface",
  },
];

/** Curated Mac/PC picks for Quick download when capability filter is All. */
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

/** LM Studio catalog ids for Quick download, grouped by capability (chat picker). */
export const QUICK_ACCESS_REMOTE_BY_CAPABILITY: Record<
  ModelCapabilityFilter,
  readonly string[]
> = {
  all: QUICK_ACCESS_REMOTE_MODEL_IDS,
  text: [
    "google/gemma-3-270m",
    "google/gemma-3-1b",
    "qwen/qwen3-1.7b",
    "qwen/qwen3-0.6b",
    "ibm/granite-4-micro",
    "qwen/qwen3-4b-2507",
    "meta-llama/llama-3.2-1b-instruct",
    "meta-llama/llama-3.2-3b-instruct",
    "mistralai/mistral-7b-instruct-v0.3",
    "microsoft/phi-4",
  ],
  image: [
    "google/gemma-3n-e4b",
    "google/gemma-3n-e2b",
    "qwen/qwen2.5-vl-3b-instruct",
    "qwen/qwen2.5-vl-7b-instruct",
    "qwen/qwen3-vl-4b",
    "microsoft/phi-3.5-vision-instruct",
    "microsoft/phi-4-multimodal-instruct",
    "mistralai/pixtral-12b",
    "moonshotai/moondream2",
    "llava-hf/llava-1.5-7b-hf",
  ],
  video: [
    "google/gemma-3n-e4b",
    "qwen/qwen2.5-vl-3b-instruct",
    "qwen/qwen2.5-vl-7b-instruct",
    "qwen/qwen3-vl-4b",
    "google/gemma-3n-e2b",
    "microsoft/phi-4-multimodal-instruct",
    "microsoft/phi-3.5-vision-instruct",
    "mistralai/pixtral-12b",
    "moonshotai/moondream2",
    "llava-hf/llava-1.5-7b-hf",
  ],
  thinking: [
    "deepseek/deepseek-r1-distill-qwen-7b",
    "deepseek/deepseek-r1-distill-qwen-1.5b",
    "deepseek/deepseek-r1-distill-llama-8b",
    "qwen/qwq-1.5b",
    "qwen/qwq-32b-preview",
    "microsoft/phi-4-reasoning-plus",
    "openai/gpt-oss-20b",
    "qwen/qwen3-4b-2507",
    "nousresearch/deephermes-3-llama-3-8b-preview",
    "ibm/granite-3-2-8b-instruct-reasoning",
  ],
};

export function findCuratedRemoteLibraryEntry(
  id: string
): RemoteLibraryEntry | undefined {
  const key = normalizeModelKey(id);
  return REMOTE_MODEL_LIBRARY.find((item) => normalizeModelKey(item.id) === key);
}

/** LM Studio download source — gated Meta Llama uses community GGUF quants for download. */
export function resolveRemoteEntryDownloadSource(
  entry: Pick<RemoteLibraryEntry, "id" | "downloadSource">
): LibraryDownloadSource {
  if (entry.downloadSource) return entry.downloadSource;
  if (catalogIdToCommunityGgufDownloadUrl(entry.id)) return "huggingface";
  if (isGatedHfCatalogId(entry.id)) return "huggingface";
  return "lmstudio";
}

/** String sent to LM Studio `POST /api/v1/models/download`. */
export function resolveRemoteEntryDownloadModel(
  entry: Pick<RemoteLibraryEntry, "id" | "downloadModel" | "downloadSource">
): string {
  if (entry.downloadModel?.trim()) {
    return entry.downloadModel.trim();
  }
  const communityGguf = catalogIdToCommunityGgufDownloadUrl(entry.id);
  if (communityGguf) return communityGguf;
  const downloadSource = resolveRemoteEntryDownloadSource(entry);
  return resolveRemoteDownloadModelString(entry.id, { downloadSource });
}

function publisherBadgeColor(publisher: string): string {
  const key = publisher.toLowerCase();
  if (key.includes("google")) return "#4285f4";
  if (key.includes("qwen")) return "#06b6d4";
  if (key.includes("meta") || key.includes("llama")) return "#0866ff";
  if (key.includes("mistral")) return "#f59e0b";
  if (key.includes("microsoft") || key.includes("phi")) return "#2563eb";
  if (key.includes("deepseek")) return "#10b981";
  if (key.includes("openai")) return "#22c55e";
  if (key.includes("ibm")) return "#6366f1";
  if (key.includes("nvidia")) return "#76b900";
  return "#8b5cf6";
}

export function resolveRemoteCatalogEntry(id: string): RemoteLibraryEntry {
  const curated = findCuratedRemoteLibraryEntry(id);
  if (curated) return curated;

  const { displayName, family } = parseModelName(id);
  const org = id.split("/")[0] ?? "";
  const publisher = org
    ? org.charAt(0).toUpperCase() + org.slice(1).replace(/-/g, " ")
    : "LM Studio";
  const params = extractModelParamLabel(id, displayName);

  return {
    id,
    name: displayName || family,
    publisher,
    params: params ?? undefined,
    badgeColor: publisherBadgeColor(publisher),
    downloadSource: "lmstudio",
  };
}

function quickAccessEntryMatches(
  entry: RemoteLibraryEntry,
  capability: ModelCapabilityFilter
): boolean {
  if (capability === "all") return true;
  return modelMatchesCapabilityFilter(
    entry.id,
    capability,
    [],
    undefined,
    entry.badge,
    remoteLibraryEntryHaystack(entry)
  );
}

/** Title for library/download rows — curated names first, then parsed id (matches model picker). */
/** Download / on-disk size for library rows — known labels, parsed ids, then param estimate. */
export function resolveRemoteLibrarySizeLabel(
  entry: Pick<RemoteLibraryEntry, "id" | "name" | "sizeLabel" | "params" | "description">
): string | null {
  const curated = findCuratedRemoteLibraryEntry(entry.id);
  const resolved = resolveFileSizeLabel(
    entry.sizeLabel && entry.sizeLabel !== "—" ? entry.sizeLabel : undefined,
    curated?.sizeLabel,
    entry.id,
    entry.name,
    entry.description
  );
  if (resolved) return resolved;

  const param =
    entry.params ??
    curated?.params ??
    extractModelParamLabel(entry.id, entry.name, entry.params) ??
    parseModelName(entry.id).sizeTag ??
    null;
  if (!param) return null;

  const estimate = estimateDownloadSizeFromParams(param);
  return estimate ? estimate.replace(/^~\s*/, "") : null;
}

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

export function getQuickAccessRemoteLibrary(
  installedIds: string[],
  capability: ModelCapabilityFilter = "all",
  limit = QUICK_ACCESS_LIMIT
): RemoteLibraryEntry[] {
  const primary = QUICK_ACCESS_REMOTE_BY_CAPABILITY[capability];
  const pool = [
    ...primary,
    ...REMOTE_MODEL_LIBRARY.map((entry) => entry.id),
    ...QUICK_ACCESS_REMOTE_BY_CAPABILITY.all,
  ];

  const seen = new Set<string>();
  const entries: RemoteLibraryEntry[] = [];

  for (const id of pool) {
    if (entries.length >= limit) break;
    const key = normalizeModelKey(id);
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = resolveRemoteCatalogEntry(id);
    if (isModelInstalled(installedIds, entry.id)) continue;
    if (!quickAccessEntryMatches(entry, capability)) continue;
    entries.push(entry);
  }

  return entries;
}
