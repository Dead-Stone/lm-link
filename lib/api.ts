import * as Network from "expo-network";
import { Platform } from "react-native";
import { discoverServersViaMDNS } from "./mdns";
import { resolveServerDisplayName } from "./scan-device-names";
import { LMAccount, resolveAccountRelayUrl, sanitizeApiToken } from "./auth";
import { normalizeServerInputUrl } from "./connection-string";
import { HUB_CONNECTION_ENABLED } from "./hub-url";
import {
  buildChatApiMessages,
  isSystemRoleUnsupportedError,
  modelSupportsSystemRole,
} from "./chat-request";
import { isSameModelId, resolveCanonicalModelId } from "./model-id";
import { modelStringNeedsHfAuth } from "./catalog-hf-repo";
import {
  classifyHfDownloadError,
  downloadUsesHuggingFaceAuth,
  formatHfDownloadFailureMessage,
  resolveHfRepoIdForDownload,
  type DownloadErrorContext,
  type HfDownloadIssue,
} from "./huggingface-gated";
import { resolveHuggingFaceToken } from "./huggingface-api";
import { resolveRemoteDownloadModelString } from "./model-download-string";
import { LibraryDownloadSource } from "./remote-model-library";
import {
  formatLmStudioLoadError,
  formatLmStudioRuntimeDownloadError,
  isLmStudioMacDownloadModel,
  lmStudioMacDownloadBlockedMessage,
} from "./lmstudio-downloadable";
import { runSimulatedProgress } from "./simulated-progress";
import { LMModel, Message, ModelDownloadJob, ModelLoadResult, Settings } from "./types";
import { modelSupportsVision } from "./vision-models";

/** Server root for native `/api/v1/*` calls — strips OpenAI `/v1` or native `/api/v1` suffixes. */
export function managementApiBase(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/i, "");
  url = url.replace(/\/v1$/i, "");
  return url.replace(/\/+$/, "");
}

function nativeV1Endpoint(baseUrl: string, path: string): string {
  const root = managementApiBase(baseUrl);
  const sub = path.startsWith("/") ? path : `/${path}`;
  return `${root}/api/v1${sub}`;
}

/** OpenAI-compatible chat completions URL (always under /v1). */
export function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (/\/v\d+$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export function isHubUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("lmstudio.ai") || lower.includes(".lm.link");
}

export function normalizeServiceUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** True when chat uses the signed-in remote server URL. */
export function isHubConnectionActive(
  settings: Pick<Settings, "baseUrl">,
  account: Pick<LMAccount, "email" | "relayUrl"> | null
): boolean {
  if (!account) return false;
  const relayUrl = resolveAccountRelayUrl(account);
  if (!relayUrl) return false;
  return (
    normalizeServiceUrl(settings.baseUrl) === normalizeServiceUrl(relayUrl)
  );
}

/** Settings patch to route chat through the signed-in server URL. */
export function getHubConnectionPatch(
  account: LMAccount,
  settings: Pick<Settings, "baseUrl" | "localServerUrl">
): Partial<Settings> {
  const relayUrl = resolveAccountRelayUrl(account);
  if (!relayUrl) return {};

  const token = sanitizeApiToken(account.token);

  if (!HUB_CONNECTION_ENABLED && isHubUrl(relayUrl)) {
    return token ? { apiKey: token } : {};
  }

  const localServerUrl =
    settings.localServerUrl?.trim() ||
    (isHubUrl(settings.baseUrl) ? undefined : settings.baseUrl.trim()) ||
    undefined;

  if (!HUB_CONNECTION_ENABLED || !isHubUrl(relayUrl)) {
    return {
      baseUrl: relayUrl,
      apiKey: token,
      localServerUrl: localServerUrl ?? relayUrl,
    };
  }

  return {
    baseUrl: relayUrl,
    apiKey: token,
    ...(localServerUrl ? { localServerUrl } : {}),
  };
}

/** Direct Mac/server URL for model download & management (not Hub relay). */
export function resolveManagementBaseUrl(
  settings: Pick<Settings, "baseUrl" | "localServerUrl">
): string | null {
  const savedLocal = settings.localServerUrl?.trim();
  const candidate =
    savedLocal && !isHubUrl(savedLocal)
      ? savedLocal
      : !isHubUrl(settings.baseUrl)
        ? settings.baseUrl.trim()
        : null;
  if (!candidate) return null;
  try {
    return normalizeServerInputUrl(candidate);
  } catch {
    return candidate;
  }
}

/** Saved Mac LAN URL for downloads (may differ from active Hub chat URL). */
export function getEffectiveLocalServerUrl(
  settings: Pick<Settings, "baseUrl" | "localServerUrl">
): string {
  const saved = settings.localServerUrl?.trim();
  if (saved && !isHubUrl(saved)) return saved;
  if (!isHubUrl(settings.baseUrl)) return settings.baseUrl.trim();
  return "";
}

/** API token for download/load/unload on the local Mac server. */
export function resolveManagementApiKey(
  settings: Pick<Settings, "baseUrl" | "localServerUrl" | "apiKey">,
  account?: Pick<LMAccount, "token"> | null
): string | undefined {
  if (!resolveManagementBaseUrl(settings)) return undefined;
  const key = sanitizeApiToken(settings.apiKey ?? account?.token ?? "");
  return key || undefined;
}

function unwrapApiRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const nested = obj.data ?? obj.result ?? obj.job;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...obj, ...(nested as Record<string, unknown>) };
  }
  return obj;
}

function parseDownloadJob(raw: unknown): ModelDownloadJob {
  const obj = unwrapApiRecord(raw);
  const status = String(obj.status ?? "downloading");
  let job_id = String(obj.job_id ?? obj.jobId ?? "");
  if (!job_id && typeof obj.id === "string" && obj.id.startsWith("job_")) {
    job_id = obj.id;
  }
  if (
    !job_id &&
    status !== "already_downloaded" &&
    status !== "completed" &&
    status !== "complete"
  ) {
    const preview = JSON.stringify(obj).slice(0, 160);
    throw new Error(
      preview
        ? `Download started but the server returned an unexpected response: ${preview}`
        : "Download started but the server returned an empty response"
    );
  }
  return {
    job_id,
    status,
    total_size_bytes:
      typeof obj.total_size_bytes === "number" ? obj.total_size_bytes : undefined,
    downloaded_bytes:
      typeof obj.downloaded_bytes === "number" ? obj.downloaded_bytes : undefined,
    started_at: typeof obj.started_at === "string" ? obj.started_at : undefined,
    completed_at: typeof obj.completed_at === "string" ? obj.completed_at : undefined,
    error: typeof obj.error === "string" ? obj.error : undefined,
  };
}

export function isDownloadTerminalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === "completed" ||
    s === "complete" ||
    s === "already_downloaded" ||
    s === "failed" ||
    s === "error"
  );
}

export function isDownloadSuccessStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "completed" || s === "complete" || s === "already_downloaded";
}

function isDownloadEndpointMissing(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("missing download api")) return true;
  if (lower.includes("unexpected endpoint")) return true;
  if (lower.includes("download api not found")) return true;
  if (
    lower.includes("404") &&
    (lower.includes("/api/v1/models/download") ||
      lower.includes("api/v1/models/download") ||
      (lower.includes("api/v1") && !lower.includes("model not") && !lower.includes("model_not")))
  ) {
    return true;
  }
  return false;
}

export type ParsedDownloadError = {
  message: string;
  hfIssue: HfDownloadIssue | null;
};

export function parseDownloadError(
  error: unknown,
  settings: Pick<Settings, "baseUrl" | "localServerUrl">,
  context?: DownloadErrorContext
): ParsedDownloadError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const usesHf = context ? downloadUsesHuggingFaceAuth(context) : false;
  const repoId = context ? resolveHfRepoIdForDownload(context) : null;
  const hasToken = context?.hfToken
    ? !!resolveHuggingFaceToken({ hfToken: context.hfToken })
    : false;

  if (!resolveManagementBaseUrl(settings)) {
    return {
      message:
        "Model downloads need a direct connection to your Mac — Hub relay can't download for you. " +
        "In Settings → Connection → Local, add your Mac's server URL (e.g. http://192.168.1.5:1234/v1) on the same Wi‑Fi.",
      hfIssue: null,
    };
  }

  if (usesHf) {
    const hfIssue = classifyHfDownloadError(message, { repoId, hasToken });
    if (hfIssue) return { message: hfIssue.message, hfIssue };
    if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
      const fallback: HfDownloadIssue = hasToken
        ? {
            kind: "acceptance_required",
            repoId: repoId ?? "this model",
            message:
              "Hugging Face blocked this download. Accept the model agreement on Hugging Face, then retry.",
          }
        : {
            kind: "token_missing",
            repoId: repoId ?? "this model",
            message:
              "Add your Hugging Face token under Settings → Connection → Advanced keys, then retry.",
          };
      return { message: fallback.message, hfIssue: fallback };
    }
  } else if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    return {
      message:
        "LM Studio rejected the request — add your API token under Settings → Connection → Local → Advanced.",
      hfIssue: null,
    };
  }

  if (isDownloadEndpointMissing(message)) {
    return {
      message:
        "Download API not found on your Mac — use a server URL like http://192.168.1.5:1234/v1 (not /api/v1), " +
        "confirm LM Studio 0.4+ is running, and restart the Developer server.",
      hfIssue: null,
    };
  }
  if (lower.includes("network request failed") || lower.includes("failed to connect")) {
    return {
      message:
        "Can't reach your Mac — confirm LM Studio's server is running, Serve on Local Network is on, and you're on the same Wi‑Fi.",
      hfIssue: null,
    };
  }
  if (
    lower.includes("no longer be found") ||
    lower.includes("use_policy") ||
    lower.includes("hf-proxy")
  ) {
    return {
      message:
        "Meta's license file (USE_POLICY.md) wasn't found on Hugging Face. Retry the download — LM Link routes Llama models through a community GGUF quant.",
      hfIssue: null,
    };
  }
  if (
    lower.includes("model not found") ||
    lower.includes("model_not_found") ||
    (lower.includes("not found") && lower.includes("model") && !isDownloadEndpointMissing(message))
  ) {
    return {
      message:
        "LM Studio couldn't find that model. Paste a catalog ID (qwen/qwen3-4b-2507), " +
        "an org/model Hugging Face repo, or a full https://huggingface.co/… link.",
      hfIssue: null,
    };
  }
  const runtimeMessage = formatLmStudioRuntimeDownloadError(message, undefined);
  if (runtimeMessage) return { message: runtimeMessage, hfIssue: null };
  if (usesHf || context?.downloadSource === "huggingface") {
    const hfMessage = formatHfDownloadFailureMessage(
      message,
      context?.resolvedModel ?? context?.modelId ?? repoId ?? message,
      context?.hfToken
    );
    if (hfMessage) return { message: hfMessage, hfIssue: null };
  }
  return { message, hfIssue: null };
}

export function formatDownloadError(
  error: unknown,
  settings: Pick<Settings, "baseUrl" | "localServerUrl">,
  context?: DownloadErrorContext
): string {
  return parseDownloadError(error, settings, context).message;
}

function readApiErrorDetail(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = obj.message ?? obj.detail ?? obj.error;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    if (nested && typeof nested === "object") {
      const inner = readApiErrorDetail(nested);
      if (inner) return inner;
    }
  }
  return undefined;
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const detail =
      readApiErrorDetail(json.error) ??
      readApiErrorDetail(json.message) ??
      readApiErrorDetail(json.detail);
    if (detail) return detail;
  } catch {
    // use raw text
  }
  return text.trim() || res.statusText;
}

function readQuantization(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.toUpperCase();
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.toUpperCase();
  }
  return undefined;
}

function readModelSizeBytes(raw: Record<string, unknown>): number | undefined {
  const candidates = [
    raw.size_bytes,
    raw.sizeBytes,
    raw.file_size_bytes,
    raw.file_size,
    raw.fileSize,
    raw.size,
    raw.bytes,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && value > 0) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
}

function readModelState(raw: Record<string, unknown>): string | undefined {
  const instances = raw.loaded_instances;
  if (Array.isArray(instances) && instances.length > 0) return "loaded";
  if (typeof raw.state === "string" && raw.state.trim()) return raw.state;
  if (raw.is_loaded === true || raw.loaded === true) return "loaded";
  return undefined;
}

function isLoadedModelState(state?: string): boolean {
  const normalized = state?.trim().toLowerCase();
  return normalized === "loaded" || normalized === "loading";
}

function mergeModelRows(primary: LMModel, incoming: LMModel): LMModel {
  const incomingLoaded = isLoadedModelState(incoming.state);
  const primaryLoaded = isLoadedModelState(primary.state);
  const keep = incomingLoaded && !primaryLoaded ? incoming : primary;
  const other = keep === incoming ? primary : incoming;

  return {
    ...other,
    ...keep,
    id: keep.id || other.id,
    state:
      incomingLoaded || primaryLoaded
        ? keep.state ?? other.state ?? "loaded"
        : keep.state ?? other.state,
    size_bytes: keep.size_bytes ?? other.size_bytes,
    max_context_length: keep.max_context_length ?? other.max_context_length,
    params_string: keep.params_string ?? other.params_string,
    publisher: keep.publisher ?? other.publisher,
    quantization: keep.quantization ?? other.quantization,
    arch: keep.arch ?? other.arch,
    type: keep.type ?? other.type,
    format: keep.format ?? other.format,
    compatibility_type: keep.compatibility_type ?? other.compatibility_type,
  };
}

/** Collapse duplicate LM Studio rows (path vs key, loaded vs catalog entry). */
export function dedupeModels(models: LMModel[]): LMModel[] {
  const merged: LMModel[] = [];
  for (const model of models) {
    const index = merged.findIndex((entry) => isSameModelId(entry.id, model.id));
    if (index >= 0) {
      merged[index] = mergeModelRows(merged[index], model);
    } else {
      merged.push(model);
    }
  }
  return merged;
}

function mapNativeModel(raw: Record<string, unknown>): LMModel {
  const publisher =
    typeof raw.publisher === "string"
      ? raw.publisher
      : typeof raw.owned_by === "string"
      ? raw.owned_by
      : "local";

  const id = String(raw.key ?? raw.id ?? "");

  return {
    id,
    object: String(raw.object ?? "model"),
    created: typeof raw.created === "number" ? raw.created : 0,
    owned_by: publisher,
    max_context_length:
      typeof raw.max_context_length === "number" ? raw.max_context_length : undefined,
    arch:
      typeof raw.arch === "string"
        ? raw.arch
        : typeof raw.architecture === "string"
        ? raw.architecture
        : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    publisher,
    quantization: readQuantization(raw.quantization),
    state: readModelState(raw),
    compatibility_type:
      typeof raw.compatibility_type === "string" ? raw.compatibility_type : undefined,
    format: typeof raw.format === "string" ? raw.format : undefined,
    size_bytes: readModelSizeBytes(raw),
    params_string:
      typeof raw.params_string === "string"
        ? raw.params_string
        : typeof raw.display_name === "string"
        ? raw.display_name
        : undefined,
  };
}

function mapNativeModelList(rows: Record<string, unknown>[]): LMModel[] {
  return dedupeModels(rows.map(mapNativeModel).filter((m) => m.id));
}

async function fetchNativeModels(
  baseUrl: string,
  apiKey?: string
): Promise<LMModel[] | null> {
  const base = managementApiBase(baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  for (const path of ["/api/v1/models", "/api/v0/models"]) {
    try {
      const res = await fetch(`${base}${path}`, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const rows = (data.models ?? data.data ?? []) as Record<string, unknown>[];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      return mapNativeModelList(rows);
    } catch {
      // try next endpoint
    }
  }

  return null;
}

export async function fetchModels(baseUrl: string, apiKey?: string): Promise<LMModel[]> {
  const token = apiKey ? sanitizeApiToken(apiKey) : undefined;

  if (!isHubUrl(baseUrl)) {
    const native = await fetchNativeModels(baseUrl, token);
    if (native?.length) return native;
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid API token — check your Hub token in Settings");
  }
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  return mapNativeModelList((data.data ?? []) as Record<string, unknown>[]);
}

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function managementFetch(
  url: string,
  init: RequestInit,
  apiKey?: string
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(apiKey), ...(init.headers as Record<string, string> | undefined) },
  });
  if ((res.status === 401 || res.status === 403) && apiKey) {
    const retry = await fetch(url, {
      ...init,
      headers: { ...authHeaders(undefined), ...(init.headers as Record<string, string> | undefined) },
    });
    if (retry.ok) return retry;
  }
  return res;
}

export async function isNativeV1ManagementAvailable(
  baseUrl: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const res = await managementFetch(
      nativeV1Endpoint(baseUrl, "/models"),
      { method: "GET" },
      apiKey
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type LmStudioSearchResult = {
  id: string;
  name: string;
  staffPick?: boolean;
  downloads?: number;
};

export type LmStudioModelSearchOptions = {
  searchTerm?: string;
  limit?: number;
  offset?: number;
  compatibilityTypes?: string[];
};

function readSearchIdentifier(raw: Record<string, unknown>): string {
  const identifier = raw.identifier;
  if (typeof identifier === "string" && identifier.trim()) return identifier.trim();
  if (identifier && typeof identifier === "object" && !Array.isArray(identifier)) {
    const obj = identifier as Record<string, unknown>;
    const nested = obj.identifier ?? obj.id ?? obj.key;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    const user = typeof obj.user === "string" ? obj.user.trim() : "";
    const repo = typeof obj.repo === "string" ? obj.repo.trim() : "";
    if (user && repo) return `${user}/${repo}`;
  }
  const source = raw.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const obj = source as Record<string, unknown>;
    const user = typeof obj.user === "string" ? obj.user.trim() : "";
    const repo = typeof obj.repo === "string" ? obj.repo.trim() : "";
    if (user && repo) return `${user}/${repo}`;
  }
  const user = typeof raw.user === "string" ? raw.user.trim() : "";
  const repo = typeof raw.repo === "string" ? raw.repo.trim() : "";
  if (user && repo) return `${user}/${repo}`;
  const owner = typeof raw.owner === "string" ? raw.owner.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (owner && name && !name.includes(" ")) return `${owner}/${name}`;
  const fallback = raw.id ?? raw.key ?? raw.model;
  return typeof fallback === "string" ? fallback.trim() : "";
}

function readHubDownloadCount(raw: Record<string, unknown>): number | undefined {
  const candidates: unknown[] = [
    raw.downloadCount,
    raw.download_count,
    raw.downloads,
  ];
  const stats = raw.stats;
  if (stats && typeof stats === "object" && !Array.isArray(stats)) {
    candidates.push((stats as Record<string, unknown>).downloads);
  }
  const aggregates = raw.aggregates;
  if (aggregates && typeof aggregates === "object" && !Array.isArray(aggregates)) {
    const allTime = (aggregates as Record<string, unknown>).allTime;
    if (allTime && typeof allTime === "object" && !Array.isArray(allTime)) {
      candidates.push((allTime as Record<string, unknown>).total);
    }
  }
  const current = raw.current;
  if (current && typeof current === "object" && !Array.isArray(current)) {
    candidates.push((current as Record<string, unknown>).downloadCount);
  }

  for (const value of candidates) {
    if (typeof value === "number" && value > 0) return value;
  }
  return undefined;
}

function mapSearchResult(raw: Record<string, unknown>): LmStudioSearchResult | null {
  const id = readSearchIdentifier(raw);
  if (!id) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : id;
  const downloads = readHubDownloadCount(raw);
  return {
    id,
    name,
    staffPick: raw.staffPick === true || raw.staff_pick === true,
    ...(downloads != null ? { downloads } : {}),
  };
}

function parseSearchModelsResponse(
  raw: unknown,
  limit: number,
  offset: number
): { results: LmStudioSearchResult[]; hasMore: boolean } {
  const obj = unwrapApiRecord(raw);
  const rows = (obj.results ?? obj.models ?? obj.data ?? []) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    return { results: [], hasMore: false };
  }

  const results = rows
    .map((row) => mapSearchResult(row))
    .filter((row): row is LmStudioSearchResult => row !== null);

  const total =
    typeof obj.total === "number"
      ? obj.total
      : typeof obj.total_count === "number"
        ? obj.total_count
        : undefined;
  const hasMore =
    typeof obj.has_more === "boolean"
      ? obj.has_more
      : total !== undefined
        ? offset + results.length < total
        : results.length >= limit;

  return { results, hasMore };
}

/** Search the LM Studio hub catalog via the Mac server (when supported). */
export async function searchLmStudioModels(
  baseUrl: string,
  options: LmStudioModelSearchOptions = {},
  apiKey?: string
): Promise<{ results: LmStudioSearchResult[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 25);
  const offset = Math.max(options.offset ?? 0, 0);
  const searchTerm = options.searchTerm?.trim() || undefined;

  const payloads: unknown[] = [
    {
      opts: {
        searchTerm,
        limit,
        offset,
        compatibilityTypes: options.compatibilityTypes,
      },
    },
    { searchTerm, limit, offset, compatibilityTypes: options.compatibilityTypes },
    { query: searchTerm, limit, offset },
  ];

  const endpoints = [
    "/repository/searchModels",
    "/repository/search",
    "/models/search",
  ];

  let lastError: Error | null = null;

  for (const path of endpoints) {
    for (const body of payloads) {
      try {
        const res = await managementFetch(
          nativeV1Endpoint(baseUrl, path),
          { method: "POST", body: JSON.stringify(body) },
          apiKey
        );
        if (res.status === 404 || res.status === 405) continue;
        if (!res.ok) {
          const detail = await readApiError(res);
          lastError = new Error(`Catalog search failed (${res.status}): ${detail}`);
          continue;
        }
        return parseSearchModelsResponse(await res.json(), limit, offset);
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw lastError ?? new Error("Catalog search is not available on this LM Studio server");
}

export async function downloadLmStudioModel(
  baseUrl: string,
  modelId: string,
  apiKey?: string,
  options?: { downloadSource?: LibraryDownloadSource; hfToken?: string }
): Promise<ModelDownloadJob> {
  const resolvedModel = resolveRemoteDownloadModelString(modelId, {
    downloadSource: options?.downloadSource,
  });
  if (!isLmStudioMacDownloadModel(modelId) && !isLmStudioMacDownloadModel(resolvedModel)) {
    throw new Error(lmStudioMacDownloadBlockedMessage(modelId || resolvedModel));
  }

  const available = await isNativeV1ManagementAvailable(baseUrl, apiKey);
  if (!available) {
    throw new Error(
      "Download API not found — use http://YOUR-MAC-IP:1234/v1 (not /api/v1) and confirm LM Studio 0.4+ Developer server is running"
    );
  }

  const hfToken = resolveHuggingFaceToken({ hfToken: options?.hfToken });
  const attachHfToken = !!hfToken && modelStringNeedsHfAuth(resolvedModel);
  const body: Record<string, string> = { model: resolvedModel };
  if (attachHfToken) {
    body.huggingface_token = hfToken;
  }

  const res = await managementFetch(
    nativeV1Endpoint(baseUrl, "/models/download"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    apiKey
  );
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(`Download failed (${res.status}): ${detail}`);
  }
  return parseDownloadJob(await res.json());
}

export async function getLmStudioDownloadStatus(
  baseUrl: string,
  jobId: string,
  apiKey?: string
): Promise<ModelDownloadJob> {
  const statusUrl = `${nativeV1Endpoint(baseUrl, "/models/download/status")}/${encodeURIComponent(jobId)}`;
  let res = await managementFetch(statusUrl, { method: "GET" }, apiKey);
  if (res.status === 404) {
    res = await managementFetch(
      `${nativeV1Endpoint(baseUrl, "/models/download/status")}:${encodeURIComponent(jobId)}`,
      { method: "GET" },
      apiKey
    );
  }
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(`Status check failed (${res.status}): ${detail}`);
  }
  return parseDownloadJob(await res.json());
}

/** URL for load/download/unload — direct Mac when on Hub, otherwise active server. */
export function resolveModelControlUrl(
  settings: Pick<Settings, "baseUrl" | "localServerUrl">
): string | null {
  const direct = resolveManagementBaseUrl(settings);
  if (direct) return direct;
  if (!isHubUrl(settings.baseUrl)) return settings.baseUrl;
  return null;
}

export function formatLoadError(error: unknown, settings: Pick<Settings, "baseUrl" | "localServerUrl">): string {
  const message = error instanceof Error ? error.message : String(error);

  if (!resolveModelControlUrl(settings)) {
    return (
      "Loading models on your Mac needs a direct local connection. " +
      "Add your Mac's server URL in Settings → Connection → Local (same Wi‑Fi)."
    );
  }
  if (/401|403|unauthorized/i.test(message)) {
    return "LM Studio rejected the load — check your API token in Settings → Connection.";
  }
  if (/404|not found/i.test(message) && !/model/i.test(message)) {
    return "Load API not found — use http://YOUR-MAC-IP:1234/v1 and confirm LM Studio 0.4+ Developer server is running.";
  }
  if (/network request failed|failed to connect/i.test(message)) {
    return "Can't reach your Mac — confirm LM Studio's server is running on your network.";
  }
  const loadDetail = message.match(/^Load failed \((\d+)\):\s*(.*)$/is);
  const runtimeMessage = formatLmStudioLoadError(
    loadDetail?.[2] ?? message,
    undefined,
    loadDetail ? Number(loadDetail[1]) : undefined
  );
  if (runtimeMessage) return runtimeMessage;
  const genericRuntime = formatLmStudioLoadError(message);
  if (genericRuntime) return genericRuntime;
  return message;
}

function parseLoadResult(raw: unknown): ModelLoadResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    status: String(obj.status ?? "loaded"),
    instance_id: typeof obj.instance_id === "string" ? obj.instance_id : undefined,
    type: typeof obj.type === "string" ? obj.type : undefined,
    load_time_seconds:
      typeof obj.load_time_seconds === "number" ? obj.load_time_seconds : undefined,
    error: typeof obj.error === "string" ? obj.error : undefined,
  };
}

export async function loadLmStudioModel(
  baseUrl: string,
  modelId: string,
  apiKey?: string
): Promise<ModelLoadResult> {
  const res = await fetch(nativeV1Endpoint(baseUrl, "/models/load"), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ model: modelId }),
  });
  if (!res.ok) {
    const detail = await readApiError(res);
    const friendly =
      formatLmStudioLoadError(detail, modelId, res.status) ??
      `Load failed (${res.status}): ${detail}`;
    throw new Error(friendly);
  }
  const result = parseLoadResult(await res.json());
  if (result.error) {
    throw new Error(formatLmStudioLoadError(result.error, modelId) ?? result.error);
  }
  return result;
}

/** True when the model is fully loaded in memory (not merely loading). */
export function isModelInMemory(model: Pick<LMModel, "state">): boolean {
  return model.state?.trim().toLowerCase() === "loaded";
}

/** True when LM Studio is still loading this model into memory. */
export function isModelLoading(model: Pick<LMModel, "state">): boolean {
  return model.state?.trim().toLowerCase() === "loading";
}

export function isRemoteModelLoaded(model: Pick<LMModel, "state">): boolean {
  return isLoadedModelState(model.state);
}

type PartitionLibraryOptions = {
  /** Enrich the loaded row that matches this id (metadata only — never fake-loaded). */
  activeModelId?: string | null;
  /** When true (default), at most one Mac/PC model appears under Loaded. */
  singleModelMode?: boolean;
};

function enrichLoadedRow(activeRow: LMModel, loadedRow: LMModel): LMModel {
  return {
    ...activeRow,
    ...loadedRow,
    id: loadedRow.id,
    state: loadedRow.state ?? "loaded",
  };
}

/** Models fully loaded in LM Studio memory (not merely loading). */
export function listMemoryLoadedModels(models: Iterable<LMModel>): LMModel[] {
  return dedupeModels([...models]).filter(isModelInMemory);
}

/**
 * Pick a remote model for a new chat from memory-loaded models only.
 * When several are loaded and none is preferred, returns `pickFrom` for the user to choose.
 */
export function resolveNewChatRemoteModel(
  models: Iterable<LMModel>,
  options?: { preferredId?: string | null }
): { modelId: string | null; pickFrom: LMModel[] } {
  const loaded = listMemoryLoadedModels(models);
  if (loaded.length === 0) {
    return { modelId: null, pickFrom: [] };
  }
  if (loaded.length === 1) {
    return { modelId: loaded[0].id, pickFrom: [] };
  }
  const preferred = options?.preferredId?.trim();
  if (preferred) {
    const match = loaded.find((model) => isSameModelId(model.id, preferred));
    if (match) {
      return { modelId: match.id, pickFrom: [] };
    }
  }
  return { modelId: null, pickFrom: loaded };
}

/** Split catalog rows into memory-loaded vs installed-only (no duplicate identities). */
export function partitionLibraryModels(
  models: LMModel[],
  options?: PartitionLibraryOptions
): {
  loaded: LMModel[];
  installed: LMModel[];
} {
  const unique = dedupeModels(models);
  const activeModelId = options?.activeModelId?.trim();
  const singleModelMode = options?.singleModelMode !== false;
  const activeRow = activeModelId
    ? unique.find((model) => isSameModelId(model.id, activeModelId))
    : undefined;

  let loaded = unique.filter(isModelInMemory);

  if (activeRow) {
    loaded = loaded.map((model) =>
      isSameModelId(model.id, activeRow.id) ? enrichLoadedRow(activeRow, model) : model
    );
  }

  if (singleModelMode && loaded.length > 1) {
    const preferred =
      (activeModelId && loaded.find((model) => isSameModelId(model.id, activeModelId))) ??
      loaded[0];
    loaded = preferred ? [preferred] : [];
  }

  const installed = unique.filter(
    (model) => !loaded.some((entry) => isSameModelId(entry.id, model.id))
  );
  return { loaded, installed };
}

/** Unload a specific model from LM Studio memory. */
export async function ejectRemoteModel(
  settings: Settings,
  modelId: string,
  accountToken?: string
): Promise<void> {
  const controlUrl = resolveModelControlUrl(settings);
  if (!controlUrl) {
    throw new Error(formatLoadError(new Error("no control url"), settings));
  }

  const accountRef = accountToken
    ? ({ token: accountToken } as Pick<LMAccount, "token">)
    : null;
  const mgmtKey = resolveManagementApiKey(settings, accountRef);
  await unloadLmStudioModel(controlUrl, modelId, mgmtKey);
}

/** When exactly one Mac model is loaded in memory, unload it (used when clearing chat selection). */
export async function clearRemoteModelSelection(
  settings: Settings,
  models: Iterable<LMModel>,
  accountToken?: string
): Promise<void> {
  const loaded = [...models].filter(isRemoteModelLoaded);
  if (loaded.length !== 1) return;

  const controlUrl = resolveModelControlUrl(settings);
  if (!controlUrl) return;

  const accountRef = accountToken
    ? ({ token: accountToken } as Pick<LMAccount, "token">)
    : null;
  const mgmtKey = resolveManagementApiKey(settings, accountRef);

  try {
    await unloadLmStudioModel(controlUrl, loaded[0].id, mgmtKey);
  } catch {
    // Best effort — selection can still clear
  }
}

type ResolvedRemoteModelTargets = {
  catalogKey: string;
  unloadInstanceId: string | null;
  variantKeys: string[];
};

async function fetchNativeModelRecords(
  baseUrl: string,
  apiKey?: string
): Promise<Record<string, unknown>[]> {
  const base = managementApiBase(baseUrl);
  const res = await managementFetch(`${base}/api/v1/models`, { method: "GET" }, apiKey);
  if (!res.ok) return [];
  const data = await res.json();
  const rows = (data.models ?? data.data ?? []) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows : [];
}

function findNativeModelRecord(
  records: Record<string, unknown>[],
  modelId: string
): Record<string, unknown> | undefined {
  return records.find((raw) => {
    const key = String(raw.key ?? raw.id ?? "");
    if (isSameModelId(key, modelId)) return true;
    const variants = raw.variants;
    if (!Array.isArray(variants)) return false;
    return variants.some((variant) => isSameModelId(String(variant), modelId));
  });
}

async function resolveRemoteModelTargets(
  baseUrl: string,
  modelId: string,
  apiKey?: string
): Promise<ResolvedRemoteModelTargets> {
  const fallback: ResolvedRemoteModelTargets = {
    catalogKey: modelId,
    unloadInstanceId: null,
    variantKeys: [],
  };
  try {
    const records = await fetchNativeModelRecords(baseUrl, apiKey);
    const raw = findNativeModelRecord(records, modelId);
    if (!raw) return fallback;

    const key = String(raw.key ?? raw.id ?? modelId);
    const selectedVariant =
      typeof raw.selected_variant === "string" ? raw.selected_variant.trim() : "";
    const variants = Array.isArray(raw.variants)
      ? raw.variants.map((variant) => String(variant)).filter(Boolean)
      : [];

    let unloadInstanceId: string | null = null;
    const instances = raw.loaded_instances;
    if (Array.isArray(instances) && instances.length > 0) {
      const first = instances[0] as Record<string, unknown>;
      if (typeof first.id === "string" && first.id.trim()) {
        unloadInstanceId = first.id.trim();
      }
    }

    return {
      catalogKey: selectedVariant || key,
      unloadInstanceId,
      variantKeys: variants,
    };
  } catch {
    return fallback;
  }
}

export const REMOTE_MODEL_FILE_DELETE_UNSUPPORTED =
  "LM Studio can't delete model files from your phone yet. On your Mac, open LM Studio → My Models → ⋯ → Delete.";

async function attemptDeleteRemoteModelFile(
  baseUrl: string,
  targets: ResolvedRemoteModelTargets,
  apiKey?: string
): Promise<boolean> {
  const candidateIds = [
    targets.catalogKey,
    ...targets.variantKeys,
    targets.unloadInstanceId,
  ].filter((id): id is string => !!id?.trim());

  const uniqueIds = [...new Set(candidateIds)];
  let lastStatus = 0;
  let lastDetail = "";

  for (const id of uniqueIds) {
    for (const body of [{ model: id }, { key: id }] as const) {
      for (const path of ["/models/delete", "/models/remove"] as const) {
        const res = await managementFetch(
          nativeV1Endpoint(baseUrl, path),
          { method: "POST", body: JSON.stringify(body) },
          apiKey
        );
        if (res.ok) return true;
        lastStatus = res.status;
        lastDetail = await readApiError(res);
        if (res.status !== 404 && res.status !== 405) {
          throw new Error(`Delete failed (${res.status}): ${lastDetail}`);
        }
      }
    }
  }

  if (lastStatus === 404 || lastStatus === 405) {
    return false;
  }
  throw new Error(`Delete failed (${lastStatus}): ${lastDetail}`);
}

export async function unloadLmStudioModel(
  baseUrl: string,
  modelId: string,
  apiKey?: string
): Promise<void> {
  const targets = await resolveRemoteModelTargets(baseUrl, modelId, apiKey);
  const instanceId = targets.unloadInstanceId ?? modelId;
  const res = await fetch(nativeV1Endpoint(baseUrl, "/models/unload"), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ instance_id: instanceId }),
  });
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(`Unload failed (${res.status}): ${detail}`);
  }
}

export function formatDeleteError(
  error: unknown,
  settings: Pick<Settings, "baseUrl" | "localServerUrl">
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!resolveManagementBaseUrl(settings)) {
    return (
      "Removing models needs a direct local connection. " +
      "Add your Mac's server URL in Settings → Connection → Local."
    );
  }
  if (/401|403|unauthorized/i.test(message)) {
    return "LM Studio rejected the request — check your API token in Settings → Connection.";
  }
  if (/isn't supported over the api/i.test(message)) {
    return message;
  }
  if (message.includes(REMOTE_MODEL_FILE_DELETE_UNSUPPORTED)) {
    return message;
  }
  return message;
}

/** Permanently remove an installed model on the Mac (unloads first if in memory). */
export async function deleteRemoteModel(
  settings: Settings,
  modelId: string,
  accountToken?: string
): Promise<void> {
  const controlUrl = resolveModelControlUrl(settings);
  if (!controlUrl) {
    throw new Error(formatDeleteError(new Error("no control url"), settings));
  }
  const accountRef = accountToken
    ? ({ token: accountToken } as Pick<LMAccount, "token">)
    : null;
  const mgmtKey = resolveManagementApiKey(settings, accountRef);
  await deleteLmStudioModel(controlUrl, modelId, mgmtKey);
}

/** Permanently remove a model from the Mac (unloads first if in memory). */
export async function deleteLmStudioModel(
  baseUrl: string,
  modelId: string,
  apiKey?: string
): Promise<void> {
  const available = await isNativeV1ManagementAvailable(baseUrl, apiKey);
  if (!available) {
    throw new Error(
      "Model management API not found — use http://YOUR-MAC-IP:1234/v1 and confirm LM Studio 0.4+ is running."
    );
  }

  const targets = await resolveRemoteModelTargets(baseUrl, modelId, apiKey);
  const wasLoaded = !!targets.unloadInstanceId;

  if (wasLoaded) {
    try {
      await unloadLmStudioModel(baseUrl, modelId, apiKey);
    } catch {
      // Still attempt file removal when unload fails.
    }
  }

  const deleted = await attemptDeleteRemoteModelFile(baseUrl, targets, apiKey);
  if (deleted) {
    try {
      const remaining = await fetchModels(baseUrl, apiKey);
      if (!remaining.some((model) => isSameModelId(model.id, modelId))) {
        return;
      }
    } catch {
      return;
    }
  }

  if (wasLoaded) {
    try {
      const remaining = await fetchModels(baseUrl, apiKey);
      const stillLoaded = remaining.some(
        (model) => isSameModelId(model.id, modelId) && isModelInMemory(model)
      );
      if (!stillLoaded) {
        throw new Error(
          `${REMOTE_MODEL_FILE_DELETE_UNSUPPORTED} The model was unloaded from memory.`
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes(REMOTE_MODEL_FILE_DELETE_UNSUPPORTED)) {
        throw e;
      }
    }
  }

  throw new Error(REMOTE_MODEL_FILE_DELETE_UNSUPPORTED);
}

/** Unload all models currently in memory on the Mac, optionally keeping one. */
export async function unloadLoadedRemoteModels(
  settings: Settings,
  exceptModelId?: string,
  accountToken?: string
): Promise<void> {
  const controlUrl = resolveModelControlUrl(settings);
  if (!controlUrl) return;

  const accountRef = accountToken
    ? ({ token: accountToken } as Pick<LMAccount, "token">)
    : null;
  const mgmtKey = resolveManagementApiKey(settings, accountRef);

  let models: LMModel[];
  try {
    models = await fetchModels(controlUrl, mgmtKey);
  } catch {
    return;
  }

  const loaded = models.filter(
    (m) => isLoadedModelState(m.state) && !isSameModelId(m.id, exceptModelId)
  );

  for (const model of loaded) {
    try {
      await unloadLmStudioModel(controlUrl, model.id, mgmtKey);
    } catch {
      // Continue unloading others even if one fails
    }
  }
}

export type LoadRemoteModelOptions = {
  onProgress?: (progress: number) => void;
  previousModelId?: string | null;
  /** Fallback when settings.apiKey is not set (e.g. saved in secure account store). */
  accountToken?: string;
};

export async function loadRemoteModelOnSystem(
  settings: Settings,
  modelId: string,
  options?: LoadRemoteModelOptions
): Promise<ModelLoadResult> {
  const controlUrl = resolveModelControlUrl(settings);
  if (!controlUrl) {
    throw new Error(formatLoadError(new Error("no control url"), settings));
  }

  const singleMode = settings.singleModelMode !== false;
  const onProgress = options?.onProgress;
  const accountRef = options?.accountToken
    ? ({ token: options.accountToken } as Pick<LMAccount, "token">)
    : null;
  const mgmtKey = resolveManagementApiKey(settings, accountRef);

  let installed: LMModel[] = [];
  try {
    installed = await fetchModels(controlUrl, mgmtKey);
  } catch {
    // Load may still work with the raw id.
  }

  const targetId =
    installed.length > 0 ? resolveCanonicalModelId(installed, modelId) : modelId.trim();

  if (singleMode) {
    await unloadLoadedRemoteModels(settings, targetId, options?.accountToken);
    const previous = options?.previousModelId?.trim();
    if (previous && !isSameModelId(previous, targetId)) {
      const previousId =
        installed.length > 0 ? resolveCanonicalModelId(installed, previous) : previous;
      try {
        await unloadLmStudioModel(controlUrl, previousId, mgmtKey);
      } catch {
        // Already unloaded via unloadLoadedRemoteModels
      }
    }
  }

  const alreadyLoaded = installed.some(
    (m) => isSameModelId(m.id, targetId) && isLoadedModelState(m.state)
  );
  if (alreadyLoaded) {
    onProgress?.(1);
    return { status: "loaded", instance_id: targetId };
  }

  const stopProgress = onProgress ? runSimulatedProgress(onProgress) : undefined;
  try {
    return await loadLmStudioModel(controlUrl, targetId, mgmtKey);
  } finally {
    stopProgress?.();
  }
}

export async function probeDownloadApi(
  baseUrl: string,
  apiKey?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await managementFetch(
      nativeV1Endpoint(baseUrl, "/models"),
      { method: "GET" },
      apiKey
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "API token required or invalid" };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `LM Studio v1 API unavailable (${res.status}) — update to 0.4+ on your Mac`,
      };
    }
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Can't reach your Mac",
    };
  }
}

// ─── Connection test ──────────────────────────────────────────────────────────

export interface ConnectionResult {
  ok: boolean;
  modelCount?: number;
  models?: LMModel[];
  error?: string;
  latencyMs?: number;
}

export async function testConnection(baseUrl: string, apiKey?: string): Promise<ConnectionResult> {
  const start = Date.now();
  try {
    const models = await fetchModels(baseUrl, apiKey);
    return {
      ok: true,
      modelCount: models.length,
      models,
      latencyMs: Date.now() - start,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ─── Local network scanner ────────────────────────────────────────────────────

export interface FoundServer {
  url: string;
  displayName: string;
  modelCount: number;
  models: LMModel[];
  latencyMs: number;
}

type ProbedServer = Omit<FoundServer, "displayName">;

function withDisplayName(server: ProbedServer, bonjourName?: string | null): FoundServer {
  return {
    ...server,
    displayName: resolveServerDisplayName(server.url, bonjourName),
  };
}

const FALLBACK_SUBNETS = [
  "192.168.1",
  "192.168.0",
  "192.168.68",
  "192.168.2",
  "10.0.0",
  "10.0.1",
  "172.20.10",
];

const SCAN_PRIORITY_OCTETS = [1, 2, 10, 50, 99, 100, 101, 102, 150, 200, 254];
const SCAN_BATCH_SIZE = 30;
const SCAN_TIMEOUT_MS = 1200;

async function resolveScanSubnets(): Promise<string[]> {
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== "0.0.0.0" && ip !== "127.0.0.1") {
      const parts = ip.split(".");
      if (parts.length === 4) {
        return [`${parts[0]}.${parts[1]}.${parts[2]}`];
      }
    }
  } catch {
    // Fall back to common subnets below.
  }
  return [...FALLBACK_SUBNETS];
}

async function probeLmStudioServer(
  baseUrl: string,
  timeoutMs = SCAN_TIMEOUT_MS
): Promise<ProbedServer | null> {
  const url = baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(`${url}/models`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const models: LMModel[] = data.data ?? [];
    return { url, modelCount: models.length, models, latencyMs: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function scanLocalNetwork(
  port = 1234,
  onProgress?: (scanned: number, total: number, foundSoFar: FoundServer[]) => void
): Promise<FoundServer[]> {
  const found: FoundServer[] = [];
  const foundUrls = new Set<string>();

  const addFound = (server: ProbedServer, bonjourName?: string | null) => {
    if (foundUrls.has(server.url)) return;
    foundUrls.add(server.url);
    found.push(withDisplayName(server, bonjourName));
  };

  // mDNS (Bonjour) finds LM Studio quickly when the native module is available.
  const mdnsHits = await discoverServersViaMDNS(4500);
  const bonjourNameByUrl = new Map(
    mdnsHits.map((hit) => [hit.url.replace(/\/+$/, ""), hit.name])
  );

  if (mdnsHits.length > 0) {
    const verified = await Promise.all(mdnsHits.map((hit) => probeLmStudioServer(hit.url)));
    for (let i = 0; i < verified.length; i += 1) {
      const server = verified[i];
      if (server) addFound(server, mdnsHits[i].name);
    }
    onProgress?.(0, 1, [...found]);
  }

  const subnets = await resolveScanSubnets();
  const priorityHosts: string[] = [];
  const remainingHosts: string[] = [];
  const seenHosts = new Set<string>();

  for (const subnet of subnets) {
    for (const oct of SCAN_PRIORITY_OCTETS) {
      const h = `${subnet}.${oct}`;
      priorityHosts.push(h);
      seenHosts.add(h);
    }
    for (let i = 1; i <= 254; i++) {
      const h = `${subnet}.${i}`;
      if (!seenHosts.has(h)) remainingHosts.push(h);
    }
  }
  const hosts: string[] = [...priorityHosts, ...remainingHosts];

  const total = hosts.length;
  let scanned = 0;

  for (let i = 0; i < hosts.length; i += SCAN_BATCH_SIZE) {
    const batch = hosts.slice(i, i + SCAN_BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (host) => {
        const url = `http://${host}:${port}/v1`;
        if (foundUrls.has(url)) return null;
        const server = await probeLmStudioServer(url);
        if (!server) return null;
        const bonjourName = bonjourNameByUrl.get(url.replace(/\/+$/, ""));
        addFound(server, bonjourName);
        return server;
      })
    );

    scanned += batch.length;

    onProgress?.(Math.min(scanned, total), total, [...found]);
  }

  return found;
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

type ChatPayload = {
  model: string | undefined;
  messages: Awaited<ReturnType<typeof buildChatApiMessages>>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
};

function readChatErrorDetail(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const detail =
      readApiErrorDetail(json.error) ??
      readApiErrorDetail(json.message) ??
      readApiErrorDetail(json.detail);
    if (detail) return detail;
  } catch {
    // use raw body
  }
  return body.trim();
}

function parseSSEDelta(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "data: [DONE]") return null;
  if (!trimmed.startsWith("data: ")) return null;
  try {
    const json = JSON.parse(trimmed.slice(6));
    const delta: string | undefined = json.choices?.[0]?.delta?.content;
    return delta ?? null;
  } catch {
    return null;
  }
}

function consumeSSEBuffer(
  buffer: string,
  onDelta: (delta: string) => void
): string {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  for (const line of lines) {
    const delta = parseSSEDelta(line);
    if (delta) onDelta(delta);
  }
  return remainder;
}

async function deliverInChunks(
  text: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks
): Promise<void> {
  let full = "";
  for (let i = 0; i < text.length; i += 2) {
    if (signal.aborted) return;
    const part = text.slice(i, i + 2);
    full += part;
    callbacks.onToken(part);
    await new Promise((r) => setTimeout(r, 10));
  }
  callbacks.onDone(full);
}

async function nonStreamingFallback(
  url: string,
  payload: ChatPayload,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  extraHeaders?: Record<string, string>
): Promise<"ok" | "system_role_error" | "error"> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ ...payload, stream: false }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      const detail = readChatErrorDetail(text);
      if (isSystemRoleUnsupportedError(detail)) return "system_role_error";
      callbacks.onError(new Error(`Server ${res.status}: ${detail}`));
      return "error";
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";

    if (!content) {
      callbacks.onError(
        new Error("Server returned an empty response. Is a model loaded in LM Studio?")
      );
      return "error";
    }

    await deliverInChunks(content, signal, callbacks);
    return "ok";
  } catch (err: unknown) {
    if (signal.aborted) return "error";
    const message = err instanceof Error ? err.message : "Request failed";
    if (isSystemRoleUnsupportedError(message)) return "system_role_error";
    callbacks.onError(err instanceof Error ? err : new Error("Request failed"));
    return "error";
  }
}

async function streamChatXHR(
  url: string,
  payload: ChatPayload,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  extraHeaders?: Record<string, string>
): Promise<"ok" | "system_role_error" | "error"> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    for (const [key, value] of Object.entries(extraHeaders ?? {})) {
      xhr.setRequestHeader(key, value);
    }

    let buffer = "";
    let fullText = "";
    let processedLength = 0;

    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort);

    const finish = (result: "ok" | "system_role_error" | "error") => {
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };

    xhr.onprogress = () => {
      const chunk = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      buffer += chunk;
      buffer = consumeSSEBuffer(buffer, (delta) => {
        fullText += delta;
        callbacks.onToken(delta);
      });
    };

    xhr.onload = async () => {
      buffer = consumeSSEBuffer(buffer + "\n", (delta) => {
        fullText += delta;
        callbacks.onToken(delta);
      });

      if (xhr.status >= 400) {
        const detail = readChatErrorDetail(xhr.responseText || `Server error ${xhr.status}`);
        if (isSystemRoleUnsupportedError(detail)) {
          finish("system_role_error");
          return;
        }
        if (xhr.status >= 400 && xhr.status < 500) {
          const fallback = await nonStreamingFallback(url, payload, signal, callbacks, extraHeaders);
          finish(fallback);
          return;
        }
        callbacks.onError(new Error(`Server error ${xhr.status}: ${detail}`));
        finish("error");
        return;
      }

      if (!fullText) {
        const fallback = await nonStreamingFallback(url, payload, signal, callbacks, extraHeaders);
        finish(fallback);
        return;
      }

      callbacks.onDone(fullText);
      finish("ok");
    };

    xhr.onerror = () => {
      if (!signal.aborted) {
        callbacks.onError(new Error("Network error while streaming response"));
      }
      finish("error");
    };

    xhr.onabort = () => finish("error");

    xhr.send(JSON.stringify(payload));
  });
}

async function streamChatWeb(
  url: string,
  payload: ChatPayload,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  authHeaders: Record<string, string>
): Promise<"ok" | "system_role_error" | "error"> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err: unknown) {
    if (signal.aborted) return "error";
    callbacks.onError(
      new Error(
        "Cannot reach LM Studio. Check the server is running and the URL uses your Mac's IP (not localhost) on a phone."
      )
    );
    return "error";
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    const detail = readChatErrorDetail(body);
    if (isSystemRoleUnsupportedError(detail)) return "system_role_error";
    if (res.status >= 400 && res.status < 500) {
      return nonStreamingFallback(url, payload, signal, callbacks, authHeaders);
    }
    callbacks.onError(new Error(`Server error ${res.status}: ${detail}`));
    return "error";
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return nonStreamingFallback(url, payload, signal, callbacks, authHeaders);
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const delta = parseSSEDelta(line);
        if (delta) {
          fullText += delta;
          callbacks.onToken(delta);
        }
      }
    }
  } catch (err: unknown) {
    if (signal.aborted) return "error";
    callbacks.onError(err instanceof Error ? err : new Error("Stream read failed"));
    return "error";
  } finally {
    reader.releaseLock();
  }

  // Flush a trailing SSE event that arrived without a final newline.
  const tail = parseSSEDelta(buffer);
  if (tail) {
    fullText += tail;
    callbacks.onToken(tail);
  }

  if (!fullText) {
    return nonStreamingFallback(url, payload, signal, callbacks, authHeaders);
  }

  callbacks.onDone(fullText);
  return "ok";
}

export async function streamChat(
  settings: Settings,
  messages: Message[],
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  options?: { modelCatalog?: LMModel[] }
): Promise<void> {
  const url = resolveChatCompletionsUrl(settings.baseUrl);
  const model = settings.defaultModel?.trim() || undefined;

  if (!model) {
    callbacks.onError(new Error("No model selected. Choose a model first."));
    return;
  }

  const catalog = options?.modelCatalog ?? [];
  const supportsVision = modelSupportsVision(model, catalog);
  const authHeaders: Record<string, string> = {};
  const apiKey = settings.apiKey ? sanitizeApiToken(settings.apiKey) : undefined;
  if (apiKey) {
    authHeaders["Authorization"] = `Bearer ${apiKey}`;
  }

  const attempts: boolean[] = [modelSupportsSystemRole(model, catalog)];
  if (attempts[0]) attempts.push(false);

  for (let i = 0; i < attempts.length; i += 1) {
    const useSystemRole = attempts[i];
    const payload: ChatPayload = {
      model,
      messages: await buildChatApiMessages({
        messages,
        systemPrompt: settings.defaultSystemPrompt,
        modelId: model,
        catalog,
        supportsVision,
        useSystemRole,
      }),
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true,
    };

    const result =
      Platform.OS !== "web"
        ? await streamChatXHR(url, payload, signal, callbacks, authHeaders)
        : await streamChatWeb(url, payload, signal, callbacks, authHeaders);

    if (result === "ok" || result === "error" || signal.aborted) return;
    if (result === "system_role_error" && i + 1 < attempts.length) continue;
    callbacks.onError(
      new Error(
        "This model does not support a separate system prompt. Clear the system prompt in Settings → Generation, or choose a different model."
      )
    );
    return;
  }
}
