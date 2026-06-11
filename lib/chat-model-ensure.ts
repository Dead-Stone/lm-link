import { isModelInMemory } from "./api";
import { LMModel } from "./types";
import { isSameModelId } from "./model-id";

export function buildRemoteEnsureKey(conversationId: string, modelId: string): string {
  return `${conversationId}:${modelId}`;
}

export function findCatalogModel(catalog: LMModel[], modelId: string): LMModel | undefined {
  return catalog.find((m) => isSameModelId(m.id, modelId));
}

/** Skip re-fetch/load only when cache matches and the model is fully loaded in memory. */
export function shouldSkipRemoteModelEnsure(
  catalog: LMModel[],
  modelId: string,
  cachedEnsureKey: string | null,
  ensureKey: string
): boolean {
  if (cachedEnsureKey !== ensureKey) return false;
  const row = findCatalogModel(catalog, modelId);
  return !!row && isModelInMemory(row);
}
