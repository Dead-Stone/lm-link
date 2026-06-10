/** Simple Icons CDN — https://simpleicons.org */
const CDN = "https://cdn.simpleicons.org";

export type ModelBrandKey =
  | "google"
  | "meta"
  | "microsoft"
  | "mistral"
  | "qwen"
  | "deepseek"
  | "ibm"
  | "huggingface"
  | "nvidia"
  | "apple"
  | "cohere"
  | "anthropic";

const BRAND_COLORS: Record<ModelBrandKey, string> = {
  google: "4285F4",
  meta: "0081FB",
  microsoft: "5E5E5E",
  mistral: "F7D046",
  qwen: "615EFF",
  deepseek: "4D6BFE",
  ibm: "052FAD",
  huggingface: "FFD21E",
  nvidia: "76B900",
  apple: "000000",
  cohere: "39594D",
  anthropic: "191919",
};

export function getBrandLogoUri(key: ModelBrandKey, colorHex?: string): string {
  const hex = colorHex?.replace("#", "") ?? BRAND_COLORS[key];
  return `${CDN}/${key}/${hex}`;
}

function matchBrand(haystack: string): ModelBrandKey | null {
  const s = haystack.toLowerCase();

  if (s.includes("google") || s.includes("gemma")) return "google";
  if (s.includes("meta") || s.includes("llama")) return "meta";
  if (s.includes("microsoft") || s.includes("phi")) return "microsoft";
  if (s.includes("mistral") || s.includes("mixtral")) return "mistral";
  if (s.includes("qwen")) return "qwen";
  if (s.includes("deepseek")) return "deepseek";
  if (s.includes("ibm") || s.includes("granite")) return "ibm";
  if (s.includes("hugging") || s.includes("lmstudio-community")) return "huggingface";
  if (s.includes("nvidia") || s.includes("nemotron")) return "nvidia";
  if (s.includes("apple") || s.includes("openelm")) return "apple";
  if (s.includes("cohere") || s.includes("command")) return "cohere";
  if (s.includes("anthropic") || s.includes("claude")) return "anthropic";

  return null;
}

/** Resolve a publisher, family, or model id string to a known brand logo. */
export function resolveModelBrandKey(
  ...parts: (string | undefined | null)[]
): ModelBrandKey | null {
  for (const part of parts) {
    if (!part) continue;
    const key = matchBrand(part);
    if (key) return key;
  }
  return null;
}
