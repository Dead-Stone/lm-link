import { sanitizeApiToken } from "./auth";

const HF_API = "https://huggingface.co/api/models";
const HF_MIN_REQUEST_INTERVAL_MS = 300;
const HF_MAX_RATE_LIMIT_RETRIES = 3;
const HF_DEFAULT_RATE_LIMIT_WAIT_SEC = 60;

export type HuggingFaceAuthOptions = {
  /** User token from Settings (SecureStore). */
  hfToken?: string;
};

export class HuggingFaceApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "HuggingFaceApiError";
    this.status = status;
  }
}

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Settings token first, then `EXPO_PUBLIC_HF_TOKEN` when no proxy is configured. */
export function resolveHuggingFaceToken(options?: HuggingFaceAuthOptions): string {
  const user = sanitizeApiToken(options?.hfToken ?? "");
  if (user) return user;
  if (trimEnv(process.env.EXPO_PUBLIC_HF_PROXY_URL)) return "";
  return trimEnv(process.env.EXPO_PUBLIC_HF_TOKEN);
}

export function resolveHuggingFaceApiBase(): string {
  const proxy = trimEnv(process.env.EXPO_PUBLIC_HF_PROXY_URL);
  return proxy || HF_API;
}

export function huggingFaceAuthHeaders(
  options?: HuggingFaceAuthOptions
): Record<string, string> {
  const token = resolveHuggingFaceToken(options);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Parse `Link: <url>; rel="next"` from Hugging Face list responses. */
export function parseHuggingFaceLinkNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
  return match?.[1] ?? null;
}

/** Seconds to wait after a 429, from the RateLimit header (`t=`). */
export function parseHuggingFaceRateLimitRetrySeconds(headers: Headers): number {
  const raw = headers.get("RateLimit");
  if (!raw) return HF_DEFAULT_RATE_LIMIT_WAIT_SEC;
  const match = raw.match(/(?:^|;)\s*t=(\d+)/i);
  if (!match) return HF_DEFAULT_RATE_LIMIT_WAIT_SEC;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return HF_DEFAULT_RATE_LIMIT_WAIT_SEC;
  return Math.min(seconds, 300);
}

let hfRequestQueue: Promise<unknown> = Promise.resolve();
let lastHfRequestAt = 0;

/** Serialize Hub API calls and space them out to reduce rate-limit hits. */
function scheduleHuggingFaceRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = hfRequestQueue.then(async () => {
    const wait = Math.max(0, HF_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastHfRequestAt));
    if (wait > 0) await sleep(wait);
    lastHfRequestAt = Date.now();
    return fn();
  });
  hfRequestQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function huggingFaceFetchOnce(
  url: string,
  init: RequestInit | undefined,
  auth?: HuggingFaceAuthOptions
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const authHeaders = huggingFaceAuthHeaders(auth);
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return fetch(url, { ...init, headers });
}

async function huggingFaceFetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  auth?: HuggingFaceAuthOptions
): Promise<Response> {
  for (let attempt = 0; attempt <= HF_MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await scheduleHuggingFaceRequest(() =>
      huggingFaceFetchOnce(url, init, auth)
    );
    if (response.status !== 429 || attempt === HF_MAX_RATE_LIMIT_RETRIES) {
      return response;
    }
    const waitSec = parseHuggingFaceRateLimitRetrySeconds(response.headers);
    await sleep(waitSec * 1000);
  }
  return scheduleHuggingFaceRequest(() => huggingFaceFetchOnce(url, init, auth));
}

export async function huggingFaceApiFetch(
  path: string,
  init?: RequestInit,
  auth?: HuggingFaceAuthOptions
): Promise<Response> {
  const base = resolveHuggingFaceApiBase().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${suffix}`;
  return huggingFaceFetchWithRetry(url, init, auth);
}

export async function huggingFaceApiFetchUrl(
  url: string,
  init?: RequestInit,
  auth?: HuggingFaceAuthOptions
): Promise<Response> {
  return huggingFaceFetchWithRetry(url, init, auth);
}
