function normalizeParamToken(num: string, unit: string): string {
  const parsed = Number(num);
  const normalizedNum =
    Number.isFinite(parsed) && parsed % 1 !== 0 ? String(parsed) : String(Math.trunc(parsed) === parsed ? parsed : num);
  return `${normalizedNum}${unit.toUpperCase()}`;
}

/** Extract parameter count (7B, 1.5B, 270M, etc.) from model ids, names, or API fields. */
export function extractModelParamLabel(
  ...sources: (string | null | undefined)[]
): string | null {
  for (const source of sources) {
    if (!source?.trim()) continue;
    const direct = source.trim();
    const directMatch = direct.match(/^(\d+(?:\.\d+)?)([BMbm])$/);
    if (directMatch) return normalizeParamToken(directMatch[1], directMatch[2]);
  }

  for (const source of sources) {
    if (!source) continue;
    const matches = [...source.matchAll(/(\d+(?:\.\d+)?)\s*([BMbm])(?![a-z])/gi)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      return normalizeParamToken(last[1], last[2]);
    }
  }

  for (const source of sources) {
    if (!source) continue;
    const phiMatch = source.match(/(?:^|[\s\-_/])phi[\s\-_]?(\d+(?:\.\d+)?)(?:[\s\-_./]|$)/i);
    if (phiMatch) return normalizeParamToken(phiMatch[1], "B");
  }

  return null;
}

export type ParsedModelName = {
  displayName: string;
  family: string;
  quant: string | null;
  sizeTag: string | null;
};

// Model ids are stable and bounded; parsing is pure, so cache results. This is
// called per-row per-render across the library — caching removes that regex cost.
const parsedModelNameCache = new Map<string, ParsedModelName>();

export function parseModelName(id: string): ParsedModelName {
  const cached = parsedModelNameCache.get(id);
  if (cached) return cached;

  const parts = id.split("/");
  const filename = parts[parts.length - 1].replace(/\.gguf$/i, "");

  const quantMatch = filename.match(/[_-](Q\d[_A-Z0-9]*|F16|F32|BF16|IQ\d[_A-Z0-9]*)$/i);
  const quant = quantMatch ? quantMatch[1].toUpperCase() : null;

  let displayName = filename
    .replace(/[_-](Q\d[_A-Z0-9]*|F16|F32|BF16|IQ\d[_A-Z0-9]*)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sizeTag = extractModelParamLabel(filename, displayName, id);

  const lower = displayName.toLowerCase();
  let family = "Other";
  if (lower.includes("llama")) family = "Llama";
  else if (lower.includes("mistral") || lower.includes("mixtral")) family = "Mistral";
  else if (lower.includes("phi")) family = "Phi";
  else if (lower.includes("gemma")) family = "Gemma";
  else if (lower.includes("qwen")) family = "Qwen";
  else if (lower.includes("deepseek")) family = "DeepSeek";
  else if (lower.includes("falcon")) family = "Falcon";
  else if (lower.includes("vicuna")) family = "Vicuna";
  else if (lower.includes("wizard")) family = "WizardLM";
  else if (lower.includes("orca")) family = "Orca";
  else if (lower.includes("codellama") || lower.includes("code")) family = "Code";
  else if (lower.includes("smol")) family = "SmolLM";
  else if (lower.includes("yi")) family = "Yi";
  else if (lower.includes("solar")) family = "Solar";
  else if (lower.includes("neural")) family = "Neural";

  const result: ParsedModelName = { displayName, family, quant, sizeTag };
  parsedModelNameCache.set(id, result);
  return result;
}

/** Match a model haystack against a free-text query (substring or all tokens). */
export function matchesModelSearchQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = haystack.toLowerCase();
  if (hay.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return false;
  return tokens.every((token) => hay.includes(token));
}
