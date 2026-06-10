export type ModelBrandKey =
  | "google"
  | "meta"
  | "microsoft"
  | "mistral"
  | "qwen"
  | "deepseek"
  | "ibm"
  | "huggingface"
  | "lmstudio"
  | "nvidia"
  | "apple"
  | "cohere"
  | "anthropic"
  | "openai"
  | "alibaba"
  | "bytedance"
  | "perplexity";

/** Brand accent colors for letter marks and UI (no network). */
export const BRAND_DISPLAY_COLORS: Record<ModelBrandKey, string> = {
  google: "#4285F4",
  meta: "#0467DF",
  microsoft: "#5E5E5E",
  mistral: "#FA520F",
  qwen: "#6950EF",
  deepseek: "#5786FE",
  ibm: "#052FAD",
  huggingface: "#FFD21E",
  lmstudio: "#4F8EF7",
  nvidia: "#76B900",
  apple: "#000000",
  cohere: "#39594D",
  anthropic: "#191919",
  openai: "#412991",
  alibaba: "#FF6A00",
  bytedance: "#3C8CFF",
  perplexity: "#1FB8CD",
};

function matchBrand(haystack: string): ModelBrandKey | null {
  const s = haystack.toLowerCase();

  if (s.includes("openai") || s.includes("chatgpt") || /gpt[-_]/.test(s)) return "openai";
  if (s.includes("google") || s.includes("gemma")) return "google";
  if (s.includes("meta") || s.includes("llama")) return "meta";
  if (s.includes("microsoft") || s.includes("phi-") || /\bphi\b/.test(s)) return "microsoft";
  if (s.includes("mistral") || s.includes("mixtral") || s.includes("mistralai")) return "mistral";
  if (s.includes("qwen") || s.includes("tongyi")) return "qwen";
  if (s.includes("deepseek")) return "deepseek";
  if (s.includes("ibm") || s.includes("granite")) return "ibm";
  if (s.includes("hugging") || s.includes("lmstudio-community")) return "huggingface";
  if (s.includes("nvidia") || s.includes("nemotron")) return "nvidia";
  if (s.includes("apple") || s.includes("openelm")) return "apple";
  if (s.includes("cohere") || s.includes("command-r")) return "cohere";
  if (s.includes("anthropic") || s.includes("claude")) return "anthropic";
  if (s.includes("alibaba") || s.includes("alibabacloud")) return "alibaba";
  if (s.includes("bytedance") || s.includes("doubao")) return "bytedance";
  if (s.includes("perplexity") || s.includes("sonar")) return "perplexity";

  return null;
}

function huggingFaceRepoFromString(value: string): string | null {
  const match = value.match(/huggingface\.co\/([^/?#]+\/[^/?#]+)/i);
  return match?.[1] ?? null;
}

function publisherFromModelId(modelId: string): string | null {
  const slash = modelId.indexOf("/");
  if (slash <= 0) return null;
  return modelId.slice(0, slash);
}

function resolvePartBrand(part: string): ModelBrandKey | null {
  const hfRepo = huggingFaceRepoFromString(part);
  if (hfRepo) {
    const repoBrand = matchBrand(hfRepo);
    if (repoBrand) return repoBrand;
    const org = publisherFromModelId(hfRepo);
    if (org) {
      const orgBrand = matchBrand(org);
      if (orgBrand) return orgBrand;
    }
    return "huggingface";
  }

  const org = publisherFromModelId(part);
  if (org) {
    const orgBrand = matchBrand(org);
    if (orgBrand) return orgBrand;
  }

  const direct = matchBrand(part);
  if (direct) return direct;

  return null;
}

/** Resolve a publisher, family, or model id string to a known brand logo. */
export function resolveModelBrandKey(
  ...parts: (string | undefined | null)[]
): ModelBrandKey | null {
  for (const part of parts) {
    if (!part) continue;
    const key = resolvePartBrand(part);
    if (key) return key;
  }
  return null;
}
