/**
 * lib/local-models.ts
 *
 * On-device model catalog and llama.rn inference hook.
 * Downloads GGUF models from HuggingFace, stores them in the app's document
 * directory, and runs them locally via llama.cpp (llama.rn).
 *
 * Uses expo-file-system v4 API (File / Paths / DownloadTask classes).
 *
 * In Expo Go / web the native modules are unavailable — the hook gracefully
 * returns isAvailable: false so the UI can show an appropriate message.
 *
 * GLOBAL CONTEXT MANAGER: Only one llama context is ever loaded in RAM at a
 * time. Switching models releases the previous context before loading the new
 * one, regardless of how many hook instances exist.
 */

import { File, Paths } from "expo-file-system";
import { displayNameFromGgufFilename } from "./model-download-string";
import { useCallback, useEffect, useRef, useState } from "react";
import { isSystemRoleUnsupportedError } from "./chat-request";

// ─── llama.rn — conditional native import ─────────────────────────────────────

interface LlamaContextHandle {
  completion: (
    params: {
      messages: Array<{ role: string; content: string }>;
      n_predict?: number;
      temperature?: number;
      top_p?: number;
      stop?: string[];
    },
    callback?: (data: { token: string }) => void
  ) => Promise<{
    text: string;
    timings: {
      predicted_per_second: number;
      predicted_n: number;
      prompt_n: number;
    };
  }>;
  stopCompletion: () => Promise<void>;
  release: () => Promise<void>;
}

type InitLlamaFn = (params: {
  model: string;
  n_ctx?: number;
  n_threads?: number;
  n_gpu_layers?: number;
}) => Promise<LlamaContextHandle>;

let _initLlama: InitLlamaFn | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const llamaModule = require("llama.rn");
  _initLlama = llamaModule.initLlama as InitLlamaFn;

  // require("llama.rn") succeeds even in Expo Go because it returns a JS stub.
  // Verify the native side is actually linked by checking NativeModules.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NativeModules } = require("react-native");
  if (!NativeModules.RNLlama) {
    // Native module not linked → treat as Expo Go / unsupported build
    _initLlama = null;
  }
} catch {
  // Expo Go, web, or module not linked
}

export const IS_EXPO_GO = _initLlama === null;

/** Shown when on-device download/inference isn't available in this build. */
export const LOCAL_NATIVE_BUILD_MESSAGE =
  "On-device models aren't available in Expo Go. Build a dev or preview app with npx expo run:android or EAS Build, then return here to download and run models offline.";

// ─── Model catalog ────────────────────────────────────────────────────────────

export interface LocalModelInfo {
  key: string;
  name: string;
  provider: string;
  providerColor: string;
  description: string;
  sizeLabel: string;
  ramLabel: string;
  badge: string;
  badgeColor: string;
  downloadUrl: string;
  filename: string;
}

export function localModelSupportsThinking(model: LocalModelInfo): boolean {
  const hay = `${model.key} ${model.name} ${model.description} ${model.badge}`.toLowerCase();
  return /r1|reason|think|o1|deepseek-r1|qwq/.test(hay);
}

export function localModelSupportsVision(_model: LocalModelInfo): boolean {
  return false;
}

export const LOCAL_MODEL_CATALOG: LocalModelInfo[] = [
  // ── Meta / Llama ────────────────────────────────────────────────────────────
  {
    key: "llama32_1b",
    name: "Llama 3.2 1B",
    provider: "Meta",
    providerColor: "#8b5cf6",
    description: "Meta's efficient small model. Best default choice.",
    sizeLabel: "~670 MB",
    ramLabel: "~1 GB RAM",
    badge: "Recommended",
    badgeColor: "#8b5cf6",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    filename: "llama-3.2-1b-q4_k_m.gguf",
  },
  {
    key: "llama32_3b",
    name: "Llama 3.2 3B",
    provider: "Meta",
    providerColor: "#8b5cf6",
    description: "Strong reasoning, still mobile-friendly.",
    sizeLabel: "~1.8 GB",
    ramLabel: "~3 GB RAM",
    badge: "High Quality",
    badgeColor: "#8b5cf6",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    filename: "llama-3.2-3b-q4_k_m.gguf",
  },
  {
    key: "llama31_8b",
    name: "Llama 3.1 8B",
    provider: "Meta",
    providerColor: "#8b5cf6",
    description: "Full 8B power. Needs a flagship device with 8+ GB RAM.",
    sizeLabel: "~4.7 GB",
    ramLabel: "~8 GB RAM",
    badge: "Powerful",
    badgeColor: "#dc2626",
    downloadUrl:
      "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    filename: "llama-3.1-8b-q4_k_m.gguf",
  },

  // ── Google / Gemma ──────────────────────────────────────────────────────────
  {
    key: "gemma3_1b",
    name: "Gemma 3 1B",
    provider: "Google",
    providerColor: "#a78bfa",
    description: "Google's newest tiny model. Punches above its weight.",
    sizeLabel: "~600 MB",
    ramLabel: "~1 GB RAM",
    badge: "New",
    badgeColor: "#a78bfa",
    downloadUrl:
      "https://huggingface.co/bartowski/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf",
    filename: "gemma-3-1b-q4_k_m.gguf",
  },
  {
    key: "gemma2_2b",
    name: "Gemma 2 2B",
    provider: "Google",
    providerColor: "#a78bfa",
    description: "Google's efficient 2B model. Great instruction following.",
    sizeLabel: "~1.5 GB",
    ramLabel: "~2.5 GB RAM",
    badge: "Balanced",
    badgeColor: "#a78bfa",
    downloadUrl:
      "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    filename: "gemma-2-2b-q4_k_m.gguf",
  },

  // ── Microsoft / Phi ─────────────────────────────────────────────────────────
  {
    key: "phi4_mini",
    name: "Phi-4 Mini",
    provider: "Microsoft",
    providerColor: "#60a5fa",
    description: "Microsoft's latest 3.8B model. Excellent reasoning and math.",
    sizeLabel: "~2.5 GB",
    ramLabel: "~4 GB RAM",
    badge: "New · Reasoning",
    badgeColor: "#f59e0b",
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf",
    filename: "phi-4-mini-q4_k_m.gguf",
  },
  {
    key: "phi35_mini",
    name: "Phi-3.5 Mini",
    provider: "Microsoft",
    providerColor: "#60a5fa",
    description: "3.8B model with excellent coding and reasoning.",
    sizeLabel: "~2.3 GB",
    ramLabel: "~4 GB RAM",
    badge: "Coding",
    badgeColor: "#f59e0b",
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    filename: "phi-3.5-mini-q4_k_m.gguf",
  },

  // ── Qwen / Alibaba ──────────────────────────────────────────────────────────
  {
    key: "qwen25_0b5",
    name: "Qwen 2.5 0.5B",
    provider: "Qwen",
    providerColor: "#f97316",
    description: "Tiny but capable. Fastest on any device.",
    sizeLabel: "~400 MB",
    ramLabel: "~1 GB RAM",
    badge: "Fastest",
    badgeColor: "#8b5cf6",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-0.5b-q4_k_m.gguf",
  },
  {
    key: "qwen25_1b5",
    name: "Qwen 2.5 1.5B",
    provider: "Qwen",
    providerColor: "#f97316",
    description: "Great multilingual support with very low memory use.",
    sizeLabel: "~950 MB",
    ramLabel: "~2 GB RAM",
    badge: "Multilingual",
    badgeColor: "#f97316",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-1.5b-q4_k_m.gguf",
  },
  {
    key: "qwen25_3b",
    name: "Qwen 2.5 3B",
    provider: "Qwen",
    providerColor: "#f97316",
    description: "Strong 3B with excellent multilingual and coding ability.",
    sizeLabel: "~1.9 GB",
    ramLabel: "~3 GB RAM",
    badge: "Coding",
    badgeColor: "#f59e0b",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-3b-q4_k_m.gguf",
  },
  {
    key: "qwen25_7b",
    name: "Qwen 2.5 7B",
    provider: "Qwen",
    providerColor: "#f97316",
    description: "Top-tier 7B with leading multilingual and STEM performance.",
    sizeLabel: "~4.4 GB",
    ramLabel: "~7 GB RAM",
    badge: "STEM",
    badgeColor: "#dc2626",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-7b-q4_k_m.gguf",
  },

  // ── Mistral AI ──────────────────────────────────────────────────────────────
  {
    key: "mistral7b",
    name: "Mistral 7B v0.3",
    provider: "Mistral AI",
    providerColor: "#a78bfa",
    description: "Classic 7B. Fast, capable, great for general use.",
    sizeLabel: "~4.1 GB",
    ramLabel: "~6 GB RAM",
    badge: "Classic",
    badgeColor: "#a78bfa",
    downloadUrl:
      "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    filename: "mistral-7b-v0.3-q4_k_m.gguf",
  },

  // ── DeepSeek ────────────────────────────────────────────────────────────────
  {
    key: "deepseek_r1_1b5",
    name: "DeepSeek-R1 1.5B",
    provider: "DeepSeek",
    providerColor: "#06b6d4",
    description: "Reasoning model distilled to 1.5B. Shows its work.",
    sizeLabel: "~1 GB",
    ramLabel: "~2 GB RAM",
    badge: "Reasoning",
    badgeColor: "#06b6d4",
    downloadUrl:
      "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    filename: "deepseek-r1-1.5b-q4_k_m.gguf",
  },

  // ── HuggingFace / SmolLM ────────────────────────────────────────────────────
  {
    key: "smollm2_1b7",
    name: "SmolLM2 1.7B",
    provider: "HuggingFace",
    providerColor: "#fbbf24",
    description: "HuggingFace's efficient 1.7B. Surprisingly capable for size.",
    sizeLabel: "~1 GB",
    ramLabel: "~2 GB RAM",
    badge: "Efficient",
    badgeColor: "#fbbf24",
    downloadUrl:
      "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
    filename: "smollm2-1.7b-q4_k_m.gguf",
  },
];

/** On-device picks for Quick download (chat picker + model library). */
export const QUICK_ACCESS_LOCAL_MODEL_KEYS = [
  "llama32_1b",
  "gemma3_1b",
  "qwen25_0b5",
  "qwen25_1b5",
  "phi4_mini",
  "gemma2_2b",
  "smollm2_1b7",
  "deepseek_r1_1b5",
  "llama32_3b",
  "qwen25_3b",
] as const;

export function getQuickAccessLocalModels(): LocalModelInfo[] {
  const models: LocalModelInfo[] = [];
  for (const key of QUICK_ACCESS_LOCAL_MODEL_KEYS) {
    const model = LOCAL_MODEL_CATALOG.find((item) => item.key === key);
    if (model) models.push(model);
  }
  return models;
}

export function getLocalModelByKey(key: string | null | undefined): LocalModelInfo | undefined {
  if (!key) return undefined;
  const catalog = LOCAL_MODEL_CATALOG.find((model) => model.key === key);
  if (catalog) return catalog;
  if (!key.startsWith("custom:")) return undefined;

  const filename = key.slice("custom:".length);
  if (!filename || !isModelDownloaded(filename)) return undefined;

  return {
    key,
    name: displayNameFromGgufFilename(filename),
    provider: "Custom",
    providerColor: "#888888",
    description: "Downloaded from the web.",
    sizeLabel: "—",
    ramLabel: "—",
    badge: "Custom",
    badgeColor: "#888888",
    downloadUrl: "",
    filename,
  };
}

// ─── File helpers (expo-file-system v4) ───────────────────────────────────────

export function modelFile(filename: string): File {
  return new File(Paths.document, filename);
}

export function isModelDownloaded(filename: string): boolean {
  try {
    return modelFile(filename).exists;
  } catch {
    return false;
  }
}

export function deleteModelFile(filename: string): void {
  try {
    const f = modelFile(filename);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

export function modelFileSize(filename: string): number {
  try {
    const f = modelFile(filename);
    return f.exists ? f.size : 0;
  } catch {
    return 0;
  }
}

// ─── Global Context Manager ───────────────────────────────────────────────────
//
// Ensures only ONE llama context is ever resident in memory at a time.
// When a different model is requested, the existing context is released first.
// All useOnDeviceLLM hook instances share this singleton.

const N_CTX = 2048;

const BASE_STOP_TOKENS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|endoftext|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<end_of_turn>",
  "[/INST]",
  "<|END_OF_TURN_TOKEN|>",
];

function getStopTokensForModel(modelKey: string | null): string[] {
  const key = (modelKey ?? "").toLowerCase();
  const stops = [...BASE_STOP_TOKENS];
  if (key.includes("mistral")) {
    stops.push("<s>", "[INST]");
  }
  if (key.includes("phi")) {
    stops.push("<|user|>", "<|assistant|>");
  }
  if (key.includes("gemma")) {
    stops.push("<start_of_turn>", "<end_of_turn>");
  }
  return stops;
}

function resolveModelPath(file: File): string {
  const uri = file.uri;
  return uri.startsWith("file://") ? uri.slice(7) : uri;
}

class LlamaContextManager {
  private _ctx: LlamaContextHandle | null = null;
  private _loadedKey: string | null = null;
  // Key currently being loaded (used to detect race when model changes mid-load)
  private _loadingKey: string | null = null;
  private _loadPromise: Promise<LlamaContextHandle> | null = null;

  get loadedKey(): string | null {
    return this._loadedKey;
  }

  /** Returns the active context, or null if nothing is loaded. */
  context(): LlamaContextHandle | null {
    return this._ctx;
  }

  /**
   * Load `modelKey` (identified by its filename on disk).
   * If the same key is already loaded, returns the existing context.
   * If a different key is loaded/loading, releases it first.
   */
  async load(
    modelKey: string,
    filePath: string,
    onProgress?: (p: number) => void
  ): Promise<LlamaContextHandle> {
    // Already loaded
    if (this._loadedKey === modelKey && this._ctx) return this._ctx;

    // Already loading the same key — share the in-flight promise
    if (this._loadingKey === modelKey && this._loadPromise) {
      return this._loadPromise;
    }

    // A different model is now requested — cancel previous load tracking
    this._loadingKey = modelKey;

    // Release any existing context
    if (this._ctx) {
      const old = this._ctx;
      this._ctx = null;
      this._loadedKey = null;
      await old.release().catch(() => {});
    }

    const promise = this._doLoad(modelKey, filePath, onProgress);
    this._loadPromise = promise;

    try {
      const ctx = await promise;
      // If model changed while we were loading, discard this result
      if (this._loadingKey !== modelKey) {
        ctx.release().catch(() => {});
        throw new Error("Load superseded by another model request.");
      }
      this._ctx = ctx;
      this._loadedKey = modelKey;
      this._loadPromise = null;
      return ctx;
    } catch (e) {
      if (this._loadingKey === modelKey) {
        this._loadPromise = null;
        this._loadingKey = null;
      }
      throw e;
    }
  }

  private async _doLoad(
    _key: string,
    filePath: string,
    onProgress?: (p: number) => void
  ): Promise<LlamaContextHandle> {
    // Simulate load progress (llama.rn doesn't expose it)
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(p + 0.04, 0.9);
      onProgress?.(p);
    }, 300);

    try {
      const ctx = await _initLlama!({
        model: filePath,
        n_ctx: N_CTX,
        n_threads: 4,
        n_gpu_layers: 0,
      });
      clearInterval(timer);
      onProgress?.(1);
      return ctx;
    } catch (e) {
      clearInterval(timer);
      const msg = e instanceof Error ? e.message : String(e);
      // "install of null" = JSI native module not linked or not initialized
      if (msg.includes("install") || msg.includes("RNLlama")) {
        throw new Error(
          "On-device AI failed to initialize on this device. " +
          "Try restarting the app, or switch to Remote mode to use LM Studio instead."
        );
      }
      throw e;
    }
  }

  /** Release all resources (e.g. on app background). */
  async releaseAll(): Promise<void> {
    this._loadingKey = null;
    this._loadPromise = null;
    if (this._ctx) {
      const old = this._ctx;
      this._ctx = null;
      this._loadedKey = null;
      await old.release().catch(() => {});
    }
  }
}

// Single shared instance across the app
export const llamaManager = new LlamaContextManager();

export function getLoadedOnDeviceModelKey(): string | null {
  return llamaManager.loadedKey;
}

export async function ejectOnDeviceModel(modelKey: string): Promise<void> {
  if (llamaManager.loadedKey === modelKey) {
    await llamaManager.releaseAll();
  }
}

/** Unload the on-device model when clearing chat selection (only if one is in memory). */
export async function clearOnDeviceModelSelection(): Promise<void> {
  const loadedKey = getLoadedOnDeviceModelKey();
  if (loadedKey) {
    await ejectOnDeviceModel(loadedKey);
  }
}

// ─── Hook state type ──────────────────────────────────────────────────────────

export interface OnDeviceLLMState {
  isAvailable: boolean;
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  isGenerating: boolean;
  downloadProgress: number; // compat shim
  error: string | null;
  response: string;
  tokensPerSec: number;
  contextTokens: number;
  contextLimit: number;
  generate: (messages: Array<{ role: string; content: string }>) => Promise<string>;
  interrupt: () => void;
}

const UNAVAILABLE: OnDeviceLLMState = {
  isAvailable: false,
  isReady: false,
  isLoading: false,
  loadProgress: 0,
  isGenerating: false,
  downloadProgress: 0,
  error: LOCAL_NATIVE_BUILD_MESSAGE,
  response: "",
  tokensPerSec: 0,
  contextTokens: 0,
  contextLimit: N_CTX,
  generate: async () => { throw new Error("Not available in this build."); },
  interrupt: () => {},
};

// ─── useOnDeviceLLM ───────────────────────────────────────────────────────────

export function useOnDeviceLLM(
  modelKey: string | null,
  active: boolean
): OnDeviceLLMState {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [tokensPerSec, setTokensPerSec] = useState(0);
  const [contextTokens, setContextTokens] = useState(0);

  const abortRef = useRef(false);
  const responseBufferRef = useRef("");
  const responseFrameRef = useRef<number | null>(null);

  const flushResponseBuffer = useCallback(() => {
    if (responseFrameRef.current !== null) {
      cancelAnimationFrame(responseFrameRef.current);
      responseFrameRef.current = null;
    }
    if (!responseBufferRef.current) return;
    const chunk = responseBufferRef.current;
    responseBufferRef.current = "";
    setResponse((prev) => prev + chunk);
  }, []);

  const resetResponseBuffer = useCallback(() => {
    if (responseFrameRef.current !== null) {
      cancelAnimationFrame(responseFrameRef.current);
      responseFrameRef.current = null;
    }
    responseBufferRef.current = "";
  }, []);

  // Load / unload via the global manager
  useEffect(() => {
    if (IS_EXPO_GO) return;

    if (!active || !modelKey) {
      setIsReady(false);
      setIsLoading(false);
      setLoadProgress(0);
      return;
    }

    // If this model is already resident in the global manager, just mark ready
    if (llamaManager.loadedKey === modelKey && llamaManager.context()) {
      setIsReady(true);
      setLoadProgress(1);
      return;
    }

    const modelInfo = getLocalModelByKey(modelKey);
    if (!modelInfo) return;

    let cancelled = false;

    async function load() {
      setIsReady(false);
      setIsLoading(true);
      setLoadProgress(0);
      setError(null);

      const file = modelFile(modelInfo!.filename);
      if (!file.exists) {
        if (!cancelled) {
          setError("Model not downloaded. Download it in Settings → Local Models.");
          setIsLoading(false);
        }
        return;
      }

      try {
        await llamaManager.load(modelKey!, resolveModelPath(file), (p) => {
          if (!cancelled) setLoadProgress(p);
        });

        if (!cancelled) {
          setLoadProgress(1);
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load model");
          setIsLoading(false);
          setLoadProgress(0);
        }
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, modelKey]);

  const generate = useCallback(
    async (messages: Array<{ role: string; content: string }>): Promise<string> => {
      const ctx = llamaManager.context();
      if (!ctx) throw new Error("Model not loaded");

      setIsGenerating(true);
      resetResponseBuffer();
      setResponse("");
      setTokensPerSec(0);
      setContextTokens(0);
      abortRef.current = false;

      const appendResponseToken = (token: string) => {
        responseBufferRef.current += token;
        if (responseFrameRef.current !== null) return;
        responseFrameRef.current = requestAnimationFrame(() => {
          responseFrameRef.current = null;
          const chunk = responseBufferRef.current;
          responseBufferRef.current = "";
          setResponse((prev) => prev + chunk);
        });
      };

      const run = async (payload: Array<{ role: string; content: string }>) => {
        const result = await ctx.completion(
          {
            messages: payload.filter((m) => m.role === "user" || m.role === "assistant"),
            n_predict: 1024,
            temperature: 0.7,
            top_p: 0.95,
            stop: getStopTokensForModel(modelKey),
          },
          (data: { token: string }) => {
            if (!abortRef.current) {
              appendResponseToken(data.token);
            }
          }
        );

        flushResponseBuffer();

        if (!abortRef.current) {
          setTokensPerSec(result.timings.predicted_per_second);
          setContextTokens(result.timings.prompt_n + result.timings.predicted_n);
        }

        return result.text;
      };

      try {
        try {
          return await run(messages);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const hasSystem = messages.some((m) => m.role === "system");
          if (
            hasSystem &&
            (isSystemRoleUnsupportedError(msg) ||
              /jinja|chat template|only user and assistant/i.test(msg))
          ) {
            const stripped = messages.filter((m) => m.role !== "system");
            return await run(stripped);
          }
          throw e;
        }
      } finally {
        flushResponseBuffer();
        setIsGenerating(false);
      }
    },
    [flushResponseBuffer, modelKey, resetResponseBuffer]
  );

  const interrupt = useCallback(() => {
    abortRef.current = true;
    llamaManager.context()?.stopCompletion().catch(() => {});
    flushResponseBuffer();
    setIsGenerating(false);
  }, [flushResponseBuffer]);

  if (IS_EXPO_GO) return UNAVAILABLE;

  return {
    isAvailable: true,
    isReady,
    isLoading,
    loadProgress,
    isGenerating,
    downloadProgress: 0,
    error,
    response,
    tokensPerSec,
    contextTokens,
    contextLimit: N_CTX,
    generate,
    interrupt,
  };
}
