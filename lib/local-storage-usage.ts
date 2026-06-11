import { getCustomLocalModels } from "./custom-local-models";
import {
  isModelDownloaded,
  LOCAL_MODEL_CATALOG,
  modelFileSize,
} from "./local-models";

export async function computeLocalModelsUsedBytes(): Promise<number> {
  let used = 0;
  const countedFilenames = new Set<string>();

  for (const model of LOCAL_MODEL_CATALOG) {
    if (isModelDownloaded(model.filename)) {
      used += modelFileSize(model.filename);
      countedFilenames.add(model.filename);
    }
  }

  const custom = await getCustomLocalModels();
  for (const model of custom) {
    if (countedFilenames.has(model.filename)) continue;
    if (isModelDownloaded(model.filename)) {
      used += modelFileSize(model.filename);
      countedFilenames.add(model.filename);
    }
  }

  return used;
}

export async function countDownloadedLocalModels(
  excludeKey?: string | null
): Promise<number> {
  let count = 0;
  const countedFilenames = new Set<string>();

  for (const model of LOCAL_MODEL_CATALOG) {
    if (model.key === excludeKey) continue;
    if (isModelDownloaded(model.filename)) {
      count += 1;
      countedFilenames.add(model.filename);
    }
  }

  const custom = await getCustomLocalModels();
  for (const model of custom) {
    if (model.key === excludeKey) continue;
    if (countedFilenames.has(model.filename)) continue;
    if (isModelDownloaded(model.filename)) {
      count += 1;
      countedFilenames.add(model.filename);
    }
  }

  return count;
}
