import { isSameModelId } from "./model-id";
import { LMModel } from "./types";

export type ModelModality = "text" | "image" | "video";
export type ModelModalityFilter = "all" | ModelModality;

/** Modality plus reasoning/thinking models. */
export type ModelCapabilityFilter = ModelModalityFilter | "thinking";

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
  /gemma-4/i,
  /glm-4\.6v/i,
  /qwen3-vl/i,
  /deepseek-vl/i,
  /fuyu/i,
  /bakllava/i,
  /paligemma/i,
  /phi[-_]?(3|4)[._-]?(vision|multimodal)/i,
  /[-_]vision[-_]/i,
  /nano[-_]?vl/i,
  /nemotron[-_].*vl/i,
  /uform/i,
  /kosmos/i,
  /florence/i,
  /instructblip/i,
  /blip2/i,
  /mllm/i,
  /multimodal/i,
  /multi-modal/i,
];

const VISION_HAYSTACK_PATTERNS: RegExp[] = [
  ...VISION_ID_PATTERNS,
  /\bvision\b/i,
  /image-text-to-text/i,
  /image-to-text/i,
  /visual-question/i,
  /visual question/i,
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

export function modelHaystackLooksVisionCapable(haystack: string): boolean {
  const key = haystack.trim().toLowerCase();
  if (!key) return false;
  if (badgeLooksVisionCapable(haystack)) return true;
  return VISION_HAYSTACK_PATTERNS.some((pattern) => pattern.test(key));
}

export function remoteLibraryEntryHaystack(entry: {
  id: string;
  name?: string;
  publisher?: string;
  description?: string;
  badge?: string;
  params?: string;
}): string {
  return [entry.id, entry.name, entry.publisher, entry.description, entry.badge, entry.params]
    .filter(Boolean)
    .join(" ");
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
    if (entry.type === "embeddings" || entry.type === "embedding") {
      return false;
    }
    if (entry.type === "llm") {
      return modelIdLooksVisionCapable(id);
    }
    break;
  }

  return modelIdLooksVisionCapable(id);
}

function modalityHaystack(modelId: string, haystack?: string | null): string {
  return haystack ? `${modelId} ${haystack}`.trim() : modelId;
}

export function resolveModelModalities(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null,
  haystack?: string | null
): ModelModality[] {
  const type = modelType?.toLowerCase();
  if (type === "embeddings" || type === "embedding") {
    return ["text"];
  }

  const combined = modalityHaystack(modelId, haystack);
  const hasVideo = modelIdLooksVideoCapable(combined);
  const hasImage =
    type === "vlm" ||
    modelHaystackLooksVisionCapable(combined) ||
    modelSupportsVision(modelId, catalog);
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
  modelType?: string | null,
  haystack?: string | null
): boolean {
  if (filter === "all") return true;
  const modalities = resolveModelModalities(modelId, catalog, modelType, haystack);
  if (filter === "text") {
    return modalities.length === 1 && modalities[0] === "text";
  }
  return modalities.includes(filter);
}

export function capabilityToModalityFilter(
  filter: ModelCapabilityFilter
): ModelModalityFilter {
  // Fetch a broad catalog, then filter client-side with name/description metadata.
  if (filter === "thinking" || filter === "image" || filter === "video") return "all";
  return filter;
}

/** Primary LM Studio catalog search term for a capability browse (no user query). */
export function capabilityCatalogSearchHint(filter: ModelCapabilityFilter): string {
  const terms = capabilityCatalogSearchTerms(filter);
  return terms[0] ?? "";
}

/** Hugging Face search terms to run when browsing by capability. */
export function capabilityCatalogSearchTerms(filter: ModelCapabilityFilter): string[] {
  switch (filter) {
    case "image":
      return ["vlm", "llava", "vision"];
    case "video":
      return ["video", "omni"];
    case "thinking":
      return ["r1", "reasoning"];
    default:
      return [];
  }
}

/** True when `search` is an auto-generated capability browse term (not user-typed). */
export function isCapabilityCatalogSearchQuery(
  search: string,
  capabilityFilter: ModelCapabilityFilter = "all"
): boolean {
  const trimmed = search.trim().toLowerCase();
  if (!trimmed) return false;
  if (capabilityFilter !== "all") {
    return capabilityCatalogSearchTerms(capabilityFilter).some((term) => term === trimmed);
  }
  return (["image", "video", "thinking"] as const).some((filter) =>
    capabilityCatalogSearchTerms(filter).some((term) => term === trimmed)
  );
}

export function modelMatchesCapabilityFilter(
  modelId: string,
  filter: ModelCapabilityFilter,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null,
  badge?: string | null,
  haystack?: string | null
): boolean {
  if (filter === "all") return true;

  const combined = `${modelId} ${haystack ?? ""}`.trim();

  if (filter === "thinking") {
    return (
      modelSupportsThinking(modelId, catalog, modelType, badge) ||
      modelIdLooksThinkingCapable(combined)
    );
  }

  if (filter === "image") {
    if (badgeLooksVisionCapable(badge)) return true;
    if (modelHaystackLooksVisionCapable(combined)) return true;
    return modelMatchesModalityFilter(modelId, filter, catalog, modelType);
  }

  if (filter === "video") {
    if (modelIdLooksVideoCapable(combined)) return true;
    return modelMatchesModalityFilter(modelId, filter, catalog, modelType);
  }

  return modelMatchesModalityFilter(modelId, filter, catalog, modelType, haystack);
}

export function capabilityFilterLabel(filter: ModelCapabilityFilter): string {
  switch (filter) {
    case "text":
      return "text-only";
    case "image":
      return "vision";
    case "video":
      return "video";
    case "thinking":
      return "thinking";
    default:
      return "";
  }
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
