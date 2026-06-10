import { isPlausibleCatalogModelId } from "./catalog-model-id";
import { normalizeModelKey } from "./remote-model-library";

const LM_STUDIO_ARTIFACT_API = "https://lmstudio.ai/api/v1/artifacts";

const lmStudioDownloadCache = new Map<string, number>();

type LmStudioArtifactResponse = {
  downloadCount?: number;
  current?: {
    downloadCount?: number;
  };
};

export function getCachedLmStudioDownloadCount(id: string): number | null {
  const key = normalizeModelKey(id);
  const cached = lmStudioDownloadCache.get(key);
  return cached != null && cached > 0 ? cached : null;
}

/** Fetch LM Studio hub download count for a catalog model id (org/model). */
export async function fetchLmStudioArtifactDownloadCount(modelId: string): Promise<number | null> {
  const trimmed = modelId.trim();
  if (!isPlausibleCatalogModelId(trimmed)) return null;

  const key = normalizeModelKey(trimmed);
  const cached = lmStudioDownloadCache.get(key);
  if (cached != null && cached > 0) return cached;

  const slash = trimmed.indexOf("/");
  const org = trimmed.slice(0, slash);
  const name = trimmed.slice(slash + 1);
  const url = `${LM_STUDIO_ARTIFACT_API}/${encodeURIComponent(org)}/${encodeURIComponent(name)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as LmStudioArtifactResponse;
    const count = data.downloadCount ?? data.current?.downloadCount;
    if (typeof count !== "number" || count <= 0) return null;

    lmStudioDownloadCache.set(key, count);
    return count;
  } catch {
    return null;
  }
}
