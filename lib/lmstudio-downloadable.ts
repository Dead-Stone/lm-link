/** Models LM Studio can download and run as chat LLMs on Mac/PC (not video/diffusion/embeddings). */

const NON_CHAT_MODEL_ID_PATTERNS: RegExp[] = [
  /hunyuan/i,
  /hyvid/i,
  /\bvideo\b/i,
  /text-to-video/i,
  /text2video/i,
  /image-to-video/i,
  /img2vid/i,
  /-t2v(?:[/_-]|$)/i,
  /-i2v(?:[/_-]|$)/i,
  /\bt2v\b/i,
  /\bi2v\b/i,
  /wan2/i,
  /stable-diffusion/i,
  /\bsdxl\b/i,
  /\bflux(?:[/_-]|$)/i,
  /\bdiffusion\b/i,
  /\bembed(?:ding)?\b/i,
  /\bbge-/i,
  /\be5-/i,
  /whisper/i,
  /musicgen/i,
  /audiogen/i,
  /comfyui/i,
];

const CHAT_PIPELINE_TAGS = new Set([
  "text-generation",
  "text2text-generation",
  "conversational",
  "question-answering",
]);

const LM_STUDIO_GGUF_LLM_ARCHITECTURES = [
  "llama",
  "qwen",
  "gemma",
  "phi",
  "mistral",
  "mixtral",
  "granite",
  "deepseek",
  "deci",
  "falcon",
  "starcoder",
  "gpt2",
  "mamba",
  "olm",
  "exaone",
  "glm",
  "internlm",
  "command",
  "llava",
  "smol",
  "openelm",
  "arcee",
  "nemotron",
  "solar",
  "yi",
  "tinyllama",
];

export function modelIdLooksNonChatLmStudioModel(modelId: string): boolean {
  const key = modelId.trim().toLowerCase();
  if (!key) return true;
  return NON_CHAT_MODEL_ID_PATTERNS.some((pattern) => pattern.test(key));
}

export function hfMetadataLooksNonChatLmStudioModel(options: {
  pipelineTag?: string | null;
  ggufArchitecture?: string | null;
  tags?: string[] | null;
}): boolean {
  const pipelineTag = (options.pipelineTag ?? "").trim().toLowerCase();
  if (pipelineTag && !CHAT_PIPELINE_TAGS.has(pipelineTag)) {
    if (
      /video|image|audio|visual|depth|segmentation|embedding|feature-extraction|text-to-image/i.test(
        pipelineTag
      )
    ) {
      return true;
    }
  }

  const arch = (options.ggufArchitecture ?? "").trim().toLowerCase();
  if (arch) {
    const isChatArch = LM_STUDIO_GGUF_LLM_ARCHITECTURES.some((token) => arch.includes(token));
    if (!isChatArch) return true;
  }

  for (const tag of options.tags ?? []) {
    const lower = tag.toLowerCase();
    if (/text-to-video|image-to-video|text-to-image|diffusers-only|comfyui/i.test(lower)) {
      return true;
    }
  }

  return false;
}

export function isLmStudioMacDownloadModel(
  modelId: string,
  hfMeta?: {
    pipelineTag?: string | null;
    ggufArchitecture?: string | null;
    tags?: string[] | null;
  }
): boolean {
  if (modelIdLooksNonChatLmStudioModel(modelId)) return false;
  if (hfMeta && hfMetadataLooksNonChatLmStudioModel(hfMeta)) return false;
  return true;
}

export function lmStudioMacDownloadBlockedMessage(modelId: string): string {
  const key = modelId.toLowerCase();
  if (/hunyuan|hyvid|video|t2v|i2v|wan2/i.test(key)) {
    return (
      "This is a video-generation model, not a chat LLM. LM Studio can't download or run it. " +
      "Try a chat model like qwen/qwen3-4b-2507 or google/gemma-3-1b."
    );
  }
  if (/embed|bge-|e5-|whisper/i.test(key)) {
    return (
      "This looks like an embedding or speech model. LM Studio downloads are for chat LLMs only."
    );
  }
  if (/stable-diffusion|sdxl|flux|diffusion/i.test(key)) {
    return "Image-generation models aren't supported for LM Studio chat downloads.";
  }
  return (
    "LM Studio only downloads chat LLMs for Mac/PC — not video, image, or embedding models. " +
    "Try a catalog model like qwen/qwen3-4b-2507."
  );
}

export function formatLmStudioRuntimeDownloadError(
  message: string,
  modelId?: string
): string | null {
  const lower = message.toLowerCase();
  if (!lower.includes("no lm runtime")) return null;

  if (
    modelId &&
    (modelIdLooksNonChatLmStudioModel(modelId) ||
      /video|hunyuan|hyvid|youtube/i.test(lower))
  ) {
    return lmStudioMacDownloadBlockedMessage(modelId);
  }

  if (/video|hunyuan|hyvid|youtube/i.test(lower)) {
    return (
      "LM Studio can't run this model — it's a video or specialty model, not a chat LLM. " +
      "Pick a text model like qwen/qwen3-4b-2507."
    );
  }

  return (
    "LM Studio needs a chat runtime on your Mac. Open LM Studio → Settings → Runtime and install " +
    "Metal llama.cpp (Apple Silicon) or llama.cpp CPU/CUDA. Then try a GGUF chat model."
  );
}
