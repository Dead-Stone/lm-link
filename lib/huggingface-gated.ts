import {
  catalogIdToHuggingFaceRepoId,
  huggingFaceRepoRequiresAuth,
  modelStringNeedsHfAuth,
} from "./catalog-hf-repo";
import { huggingFaceRepoIdFromString } from "./huggingface-model-card";
import {
  huggingFaceAuthHeaders,
  huggingFaceApiFetchUrl,
  resolveHuggingFaceToken,
  type HuggingFaceAuthOptions,
} from "./huggingface-api";
import { LibraryDownloadSource, resolveRemoteEntryDownloadModel, resolveRemoteEntryDownloadSource } from "./remote-model-library";

export type HfDownloadIssueKind =
  | "token_missing"
  | "token_invalid"
  | "acceptance_required"
  | "access_pending";

export type HfDownloadIssue = {
  kind: HfDownloadIssueKind;
  repoId: string;
  message: string;
};

export type HfAccessPrompt = {
  modelId: string;
  downloadSource?: LibraryDownloadSource;
  issue: HfDownloadIssue;
};

export type DownloadErrorContext = {
  modelId?: string;
  downloadSource?: LibraryDownloadSource;
  resolvedModel?: string;
  hfToken?: string;
};

export function huggingFaceModelPageUrl(repoId: string): string {
  return `https://huggingface.co/${repoId.replace(/^\/+/, "")}`;
}

export function resolveHfRepoIdForDownload(context: DownloadErrorContext): string | null {
  if (context.resolvedModel) {
    const fromResolved = huggingFaceRepoIdFromString(context.resolvedModel);
    if (fromResolved) return fromResolved;
  }
  if (context.modelId) {
    return (
      huggingFaceRepoIdFromString(context.modelId) ??
      catalogIdToHuggingFaceRepoId(context.modelId)
    );
  }
  return null;
}

/** True when this download goes through Hugging Face (gated URLs / meta-llama), not plain LM Studio catalog. */
export function downloadUsesHuggingFaceAuth(context: DownloadErrorContext): boolean {
  const modelId = context.modelId?.trim();
  if (!modelId) return false;

  if (context.resolvedModel && modelStringNeedsHfAuth(context.resolvedModel)) {
    return true;
  }

  const downloadSource =
    context.downloadSource ??
    resolveRemoteEntryDownloadSource({ id: modelId, downloadSource: context.downloadSource });

  if (downloadSource !== "huggingface") {
    return false;
  }

  try {
    const resolved = context.resolvedModel ?? resolveRemoteEntryDownloadModel({
      id: modelId,
      downloadSource,
    });
    return modelStringNeedsHfAuth(resolved);
  } catch {
    return modelStringNeedsHfAuth(modelId);
  }
}

function isClearlyHfGatedMessage(lower: string): boolean {
  return (
    lower.includes("gated") ||
    lower.includes("ask for access") ||
    lower.includes("ask-access") ||
    lower.includes("not in the authorized") ||
    lower.includes("authorized list") ||
    lower.includes("access repository") ||
    lower.includes("accept the model") ||
    lower.includes("agree and") ||
    lower.includes("user access") ||
    lower.includes("missing permission") ||
    lower.includes("visit https://huggingface.co")
  );
}

function messageForKind(kind: HfDownloadIssueKind, repoId: string): string {
  switch (kind) {
    case "token_missing":
      return (
        `${repoId} requires a Hugging Face token. ` +
        "Add one under Settings → Connection → Advanced keys, then retry."
      );
    case "token_invalid":
      return (
        "Your Hugging Face token was rejected. " +
        "Check it under Settings → Connection → Advanced keys and make sure it has read access."
      );
    case "access_pending":
      return (
        `Access to ${repoId} is pending approval on Hugging Face. ` +
        "You'll be able to download after the model author approves your request."
      );
    case "acceptance_required":
      return (
        `${repoId} requires Hugging Face access approval before download. ` +
        "Accept the model agreement, then retry."
      );
  }
}

export function classifyHfDownloadError(
  message: string,
  options?: { repoId?: string | null; hasToken?: boolean }
): HfDownloadIssue | null {
  const lower = message.toLowerCase();
  const repoId =
    options?.repoId?.trim() ||
    huggingFaceRepoIdFromString(message) ||
    null;

  if (!repoId && !isClearlyHfGatedMessage(lower)) {
    return null;
  }

  const resolvedRepo = repoId ?? "this model";
  const hasToken = !!options?.hasToken;

  if (
    lower.includes("invalid") &&
    (lower.includes("token") || lower.includes("credential") || lower.includes("bearer"))
  ) {
    return {
      kind: "token_invalid",
      repoId: resolvedRepo,
      message: messageForKind("token_invalid", resolvedRepo),
    };
  }

  if (
    lower.includes("pending") ||
    lower.includes("awaiting approval") ||
    lower.includes("manual approval") ||
    lower.includes("request is being reviewed")
  ) {
    return {
      kind: "access_pending",
      repoId: resolvedRepo,
      message: messageForKind("access_pending", resolvedRepo),
    };
  }

  const gated = isClearlyHfGatedMessage(lower);

  if (!hasToken && (gated || lower.includes("401") || lower.includes("403"))) {
    return {
      kind: "token_missing",
      repoId: resolvedRepo,
      message: messageForKind("token_missing", resolvedRepo),
    };
  }

  if (gated || (hasToken && (lower.includes("401") || lower.includes("403")))) {
    return {
      kind: "acceptance_required",
      repoId: resolvedRepo,
      message: messageForKind("acceptance_required", resolvedRepo),
    };
  }

  return null;
}

/** User-facing HF message for failed downloads when classifyHfDownloadError did not match. */
export function formatHfDownloadFailureMessage(
  raw: string,
  source: string,
  hfToken?: string
): string | null {
  const repoId =
    huggingFaceRepoIdFromString(source) ??
    (source.includes("/") && !source.includes(" ") ? source.trim() : null);
  const isHf =
    /huggingface\.co/i.test(source) ||
    /hf\.co/i.test(source) ||
    !!repoId;
  if (!isHf) return null;

  const hasToken = !!resolveHuggingFaceToken({ hfToken });
  const issue = classifyHfDownloadError(raw, { repoId, hasToken });
  if (issue) return issue.message;

  const lower = raw.toLowerCase();
  if (
    lower.includes("no longer be found") ||
    lower.includes("use_policy") ||
    lower.includes("hf-proxy")
  ) {
    const label = repoId ?? "Meta Llama";
    return (
      `${label} couldn't load Meta's license file on Hugging Face. ` +
      "Retry the download — LM Link uses a community GGUF quant instead of the official repo."
    );
  }
  if (lower.includes("404") || (lower.includes("not found") && !lower.includes("model not found"))) {
    const label = repoId ?? "This file";
    return `${label} wasn't found on Hugging Face. Check the link or try another quant.`;
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Hugging Face rate limit reached. Wait a minute and try again.";
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    return hasToken
      ? `${repoId ?? "This model"} requires Hugging Face access. Accept the model agreement on Hugging Face, then retry.`
      : "Add your Hugging Face token under Settings → Connection → Advanced keys, then retry.";
  }
  return null;
}

/** Repos on the HF org that require license acceptance (not community GGUF mirrors). */
export function hfRepoRequiresUserAcceptance(repoId: string): boolean {
  return huggingFaceRepoRequiresAuth(repoId);
}

export function classifyLocalHfDownloadError(
  message: string,
  downloadUrl: string,
  hfToken?: string
): HfDownloadIssue | null {
  const repoId = huggingFaceRepoIdFromString(downloadUrl);
  if (!repoId) return null;
  const issue = classifyHfDownloadError(message, {
    repoId,
    hasToken: !!resolveHuggingFaceToken({ hfToken }),
  });
  if (!issue) return null;
  if (!hfRepoRequiresUserAcceptance(repoId)) {
    const lower = message.toLowerCase();
    const clearlyGated = isClearlyHfGatedMessage(lower);
    if (issue.kind === "acceptance_required" || issue.kind === "access_pending") {
      if (!clearlyGated) return null;
    }
    if (issue.kind === "token_missing" && !clearlyGated && !lower.includes("401") && !lower.includes("403")) {
      return null;
    }
  }
  return issue;
}

/** Request access to a gated HF model (instant-approval repos). */
export async function requestHfModelAccess(
  repoId: string,
  auth?: HuggingFaceAuthOptions
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = resolveHuggingFaceToken(auth);
  if (!token) {
    return {
      ok: false,
      message: "Add your Hugging Face token under Settings → Connection → Advanced keys.",
    };
  }

  const headers = {
    ...huggingFaceAuthHeaders(auth),
    Accept: "application/json",
  };

  const attempts = [
    `https://huggingface.co/api/models/${repoId}/ask-access`,
    `https://huggingface.co/models/${repoId}/ask-access`,
  ];

  let lastDetail = "Could not request access on Hugging Face.";
  for (const url of attempts) {
    try {
      const response = await huggingFaceApiFetchUrl(
        url,
        { method: "POST", headers },
        auth
      );
      if (response.ok) {
        return { ok: true };
      }
      const detail = await response.text();
      if (detail.trim()) lastDetail = detail.trim().slice(0, 240);
      if (response.status === 200 || response.status === 201 || response.status === 204) {
        return { ok: true };
      }
    } catch (e: unknown) {
      lastDetail = e instanceof Error ? e.message : lastDetail;
    }
  }

  return {
    ok: false,
    message:
      lastDetail.includes("form") || lastDetail.includes("field")
        ? "This model needs approval on the Hugging Face website (custom form). Open it in your browser to continue."
        : "Could not accept access automatically. Open the model on Hugging Face to approve it, then retry.",
  };
}
