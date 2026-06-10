import { isSameModelId } from "./model-id";
import { LMModel } from "./types";

export type ModelModality = "text" | "image" | "video";
export type ModelModalityFilter = "all" | ModelModality;

const VISION_ID_PATTERNS: RegExp[] = [
  /(^|[/_-])vlm([/_-]|$)/i,
  /qwen[\d._-]*vl/i,
  /llava/i,
  /pixtral/i,
  /idefics/i,
  /moondream/i,
  /smolvlm/i,
  /internvl/i,
  /cogvlm/i,
  /minicpm-v/i,
  /gemma-3n/i,
  /glm-4\.6v/i,
  /qwen3-vl/i,
  /deepseek-vl/i,
  /fuyu/i,
  /bakllava/i,
];

const VIDEO_ID_PATTERNS: RegExp[] = [
  /video/i,
  /nemotron-3-omni/i,
  /(^|[/_-])omni([/_-]|$)/i,
];

const THINKING_ID_PATTERNS: RegExp[] = [
  /(^|[/_-])r1([/_-]|$)/i,
  /reason/i,
  /think/i,
  /\bo1\b/i,
  /deepseek-r1/i,
  /qwq/i,
];

export function modelIdLooksVisionCapable(modelId: string): boolean {
  const key = modelId.trim().toLowerCase();
  if (!key) return false;
  return VISION_ID_PATTERNS.some((pattern) => pattern.test(key));
}

export function modelIdLooksVideoCapable(modelId: string): boolean {
  const key = modelId.trim().toLowerCase();
  if (!key) return false;
  return VIDEO_ID_PATTERNS.some((pattern) => pattern.test(key));
}

export function modelIdLooksThinkingCapable(modelId: string): boolean {
  const key = modelId.trim().toLowerCase();
  if (!key) return false;
  return THINKING_ID_PATTERNS.some((pattern) => pattern.test(key));
}

export function badgeLooksThinkingCapable(badge?: string | null): boolean {
  if (!badge) return false;
  return /reason|think/i.test(badge);
}

export function badgeLooksVisionCapable(badge?: string | null): boolean {
  if (!badge) return false;
  return /vision|vlm|image/i.test(badge);
}

export function modelSupportsThinking(
  modelId: string,
  _catalog: Iterable<LMModel> = [],
  _modelType?: string | null,
  badge?: string | null
): boolean {
  return badgeLooksThinkingCapable(badge) || modelIdLooksThinkingCapable(modelId);
}

export function modelHasVisionCapability(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null,
  badge?: string | null
): boolean {
  if (badgeLooksVisionCapable(badge)) return true;
  return resolveModelModalities(modelId, catalog, modelType).includes("image");
}

/** True when the model can accept image input (LM Studio type vlm, or strong id match). */
export function modelSupportsVision(
  modelId: string,
  catalog: Iterable<LMModel> = []
): boolean {
  const id = modelId.trim();
  if (!id) return false;

  for (const entry of catalog) {
    if (!isSameModelId(entry.id, id)) continue;
    if (entry.type === "vlm") return true;
    if (
      entry.type === "llm" ||
      entry.type === "embeddings" ||
      entry.type === "embedding"
    ) {
      return false;
    }
    break;
  }

  return modelIdLooksVisionCapable(id);
}

export function resolveModelModalities(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null
): ModelModality[] {
  const type = modelType?.toLowerCase();
  if (type === "embeddings" || type === "embedding") {
    return ["text"];
  }

  const hasVideo = modelIdLooksVideoCapable(modelId);
  const hasImage = type === "vlm" || modelSupportsVision(modelId, catalog);
  const modalities: ModelModality[] = ["text"];

  if (hasImage) modalities.push("image");
  if (hasVideo) {
    modalities.push("video");
    if (!hasImage) modalities.push("image");
  }

  return modalities;
}

/** @deprecated Prefer resolveModelModalities — returns the highest non-text capability, if any. */
export function resolveModelModality(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null
): ModelModality {
  const modalities = resolveModelModalities(modelId, catalog, modelType);
  if (modalities.includes("video")) return "video";
  if (modalities.includes("image")) return "image";
  return "text";
}

export function resolveModelModalitiesFromModel(
  model: LMModel,
  catalog: Iterable<LMModel> = []
): ModelModality[] {
  return resolveModelModalities(model.id, catalog, model.type);
}

export function resolveModelModalityFromModel(
  model: LMModel,
  catalog: Iterable<LMModel> = []
): ModelModality {
  return resolveModelModality(model.id, catalog, model.type);
}

export function modelIsTextOnly(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null
): boolean {
  const modalities = resolveModelModalities(modelId, catalog, modelType);
  return modalities.length === 1 && modalities[0] === "text";
}

export function modelModalityLabel(modality: ModelModality): string {
  switch (modality) {
    case "video":
      return "Video";
    case "image":
      return "Images";
    default:
      return "Text";
  }
}

export function modelMatchesModalityFilter(
  modelId: string,
  filter: ModelModalityFilter,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null
): boolean {
  if (filter === "all") return true;
  const modalities = resolveModelModalities(modelId, catalog, modelType);
  if (filter === "text") {
    return modalities.length === 1 && modalities[0] === "text";
  }
  return modalities.includes(filter);
}

export function localVisionRequiredMessage(): string {
  return "On-device models can't view images. Switch to a vision model on your Mac to chat with photos.";
}

export function selectVisionModelMessage(): string {
  return "Select a vision model first — text-only models can't accept images.";
}

export function visionRequiredMessage(modelId: string): string {
  const label = modelId.split("/").pop() ?? modelId;
  return `${label} is a text-only model and can't view images. Choose a model with the Vision badge in the picker.`;
}
