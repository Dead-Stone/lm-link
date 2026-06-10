import type { LMModel } from "./types";

/** Lowercase catalog key without `@quant` variant suffix or `.gguf` extension. */
export function normalizeModelKey(id: string): string {
  return id.toLowerCase().replace(/@.*$/, "").replace(/\.gguf$/i, "");
}

function stripVariantSuffix(key: string): string {
  const at = key.lastIndexOf("@");
  return at > 0 ? key.slice(0, at) : key;
}

/** Filename / catalog key without path or `@quant` variant suffix. */
export function modelBasename(id: string): string {
  const key = normalizeModelKey(id);
  const segment = key.split(/[/\\]/).pop() ?? key;
  return stripVariantSuffix(segment);
}

/** True when two LM Studio ids refer to the same on-disk model. */
export function isSameModelId(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;

  const na = normalizeModelKey(a);
  const nb = normalizeModelKey(b);
  if (na === nb) return true;

  const ba = modelBasename(a);
  const bb = modelBasename(b);
  if (ba && bb && ba === bb) return true;

  if (na.length >= nb.length && na.endsWith(nb)) return true;
  if (nb.length >= na.length && nb.endsWith(na)) return true;

  return false;
}

export function findModelInList(
  models: LMModel[],
  modelId: string
): LMModel | undefined {
  return models.find((m) => isSameModelId(m.id, modelId));
}

/** Prefer the server-reported id so selection matches loaded/installed rows. */
export function resolveCanonicalModelId(models: LMModel[], modelId: string): string {
  return findModelInList(models, modelId)?.id ?? modelId;
}
