import { catalogIdToCommunityGgufDownloadUrl } from "./catalog-hf-repo";
import { buildPendingLocalModelFromGgufUrl } from "./custom-local-models";
import {
  buildHfDescription,
  huggingFaceRepoIdFromString,
  type HuggingFaceModel,
} from "./huggingface-model-card";
import {
  HuggingFaceApiError,
  huggingFaceApiFetch,
  huggingFaceApiFetchUrl,
  parseHuggingFaceLinkNextUrl,
  type HuggingFaceAuthOptions,
} from "./huggingface-api";
import { LIBRARY_PAGE_SIZE } from "./library-pagination";
import { librarySearchApiTerm, matchesLibrarySearch } from "./library-search";
import { parseModelName } from "./model-name";
import { resolveFileSizeLabel } from "./model-size";
import { LocalModelInfo } from "./local-models";
import {
  ModelCapabilityFilter,
  modelMatchesCapabilityFilter,
} from "./vision-models";

const HF_SEARCH_LIMIT = LIBRARY_PAGE_SIZE;
const HF_BADGE_COLOR = "#FFD21E";
const MAX_PHONE_GGUF_BYTES = 8_000_000_000;

const PREFERRED_QUANT_MARKERS = ["q4_k_m", "q4_k_s", "q4_0", "iq4_xs", "q5_k_m"];

type HfSibling = { rfilename?: string };

export type HuggingFaceLocalSearchPage = {
  models: LocalModelInfo[];
  nextUrl: string | null;
};

function publisherFromModelId(modelId: string): string {
  const org = modelId.split("/")[0] ?? "";
  if (!org) return "Hugging Face";
  return org.charAt(0).toUpperCase() + org.slice(1);
}

function pickGgufFilename(files: string[]): string | null {
  const ggufs = files.filter((file) => /\.gguf$/i.test(file));
  if (ggufs.length === 0) return null;
  for (const marker of PREFERRED_QUANT_MARKERS) {
    const hit = ggufs.find((file) => file.toLowerCase().includes(marker));
    if (hit) return hit;
  }
  return ggufs[0] ?? null;
}

function localModelLooksDownloadable(model: HuggingFaceModel, repoId: string): boolean {
  const ggufBytes = model.gguf?.total;
  if (typeof ggufBytes === "number" && ggufBytes > MAX_PHONE_GGUF_BYTES) return false;

  if (typeof ggufBytes === "number" && ggufBytes > 0) return true;

  const haystack = `${repoId} ${(model.tags ?? []).join(" ")} ${(model.library ?? []).join(" ")}`.toLowerCase();
  if (haystack.includes("gguf")) return true;
  if (/-gguf/i.test(repoId)) return true;
  return false;
}

async function resolveGgufDownloadUrl(
  repoId: string,
  auth?: HuggingFaceAuthOptions
): Promise<string | null> {
  const community = catalogIdToCommunityGgufDownloadUrl(repoId.toLowerCase());
  if (community) return community;

  const slash = repoId.indexOf("/");
  if (slash <= 0) return null;
  const org = repoId.slice(0, slash);
  const model = repoId.slice(slash + 1);
  const response = await huggingFaceApiFetch(
    `/${encodeURIComponent(org)}/${encodeURIComponent(model)}`,
    undefined,
    auth
  );
  if (!response.ok) return null;

  const data = (await response.json()) as HuggingFaceModel & { siblings?: HfSibling[] };
  const filenames = (data.siblings ?? [])
    .map((item) => item.rfilename?.trim())
    .filter((name): name is string => !!name);
  const filename = pickGgufFilename(filenames);
  if (!filename) return null;
  return `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(filename)}`;
}

function toLocalSearchModel(
  model: HuggingFaceModel,
  repoId: string,
  downloadUrl: string
): LocalModelInfo {
  const pending = buildPendingLocalModelFromGgufUrl(downloadUrl);
  const { displayName } = parseModelName(repoId);
  const ggufBytes = model.gguf?.total;
  const sizeLabel =
    ggufBytes && ggufBytes > 0 ? resolveFileSizeLabel(ggufBytes) ?? pending.sizeLabel : pending.sizeLabel;

  return {
    ...pending,
    name: displayName || pending.name,
    provider: publisherFromModelId(repoId),
    providerColor: HF_BADGE_COLOR,
    description: buildHfDescription(model),
    sizeLabel,
    badge: "HF",
    badgeColor: HF_BADGE_COLOR,
  };
}

async function huggingFaceModelToLocalModel(
  model: HuggingFaceModel,
  auth?: HuggingFaceAuthOptions
): Promise<LocalModelInfo | null> {
  const repoId = (model.modelId ?? model.id ?? "").trim();
  if (!huggingFaceRepoIdFromString(repoId)) return null;
  if (!localModelLooksDownloadable(model, repoId)) return null;

  const downloadUrl = await resolveGgufDownloadUrl(repoId, auth);
  if (!downloadUrl) return null;
  return toLocalSearchModel(model, repoId, downloadUrl);
}

async function parseHuggingFaceModelListResponse(
  response: Response
): Promise<{ models: HuggingFaceModel[]; nextUrl: string | null }> {
  if (response.status === 401 || response.status === 403) {
    throw new HuggingFaceApiError(
      "Hugging Face rejected the token — check Settings → Connection → Advanced keys.",
      response.status
    );
  }
  if (!response.ok) return { models: [], nextUrl: null };
  const models = (await response.json()) as HuggingFaceModel[] | { error?: string };
  return {
    models: Array.isArray(models) ? models : [],
    nextUrl: parseHuggingFaceLinkNextUrl(response.headers.get("Link")),
  };
}

async function modelsToLocalEntries(
  models: HuggingFaceModel[],
  options: {
    query: string;
    capabilityFilter?: ModelCapabilityFilter;
  } & HuggingFaceAuthOptions
): Promise<LocalModelInfo[]> {
  const query = options.query.trim();
  const capabilityFilter = options.capabilityFilter ?? "text";
  const entries: LocalModelInfo[] = [];

  for (const model of models) {
    const repoId = (model.modelId ?? model.id ?? "").trim();
    if (
      query &&
      !matchesLibrarySearch(
        [repoId, buildHfDescription(model), ...(model.tags ?? [])],
        query,
        { id: repoId, publisher: publisherFromModelId(repoId) }
      )
    ) {
      continue;
    }
    if (!modelMatchesCapabilityFilter(
      repoId,
      capabilityFilter,
      [],
      model.pipeline_tag,
      undefined,
      `${repoId} ${buildHfDescription(model)} ${(model.tags ?? []).join(" ")}`
    )) {
      continue;
    }
    const entry = await huggingFaceModelToLocalModel(model, options);
    if (entry) entries.push(entry);
  }

  return entries;
}

export async function searchHuggingFaceLocalModels(
  query: string,
  options?: {
    capabilityFilter?: ModelCapabilityFilter;
    limit?: number;
  } & HuggingFaceAuthOptions
): Promise<HuggingFaceLocalSearchPage> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { models: [], nextUrl: null };

  const apiTerm = librarySearchApiTerm(trimmed);
  const params = new URLSearchParams({
    search: apiTerm,
    limit: String(options?.limit ?? HF_SEARCH_LIMIT),
    sort: "downloads",
    direction: "-1",
    filter: "gguf",
  });

  const response = await huggingFaceApiFetch(`?${params.toString()}`, undefined, options);
  const { models, nextUrl } = await parseHuggingFaceModelListResponse(response);
  const entries = await modelsToLocalEntries(models, {
    query: trimmed,
    capabilityFilter: options?.capabilityFilter ?? "text",
    hfToken: options?.hfToken,
  });

  return { models: entries, nextUrl };
}

export async function fetchHuggingFaceLocalModelsPage(
  nextUrl: string,
  query: string,
  options?: {
    capabilityFilter?: ModelCapabilityFilter;
  } & HuggingFaceAuthOptions
): Promise<HuggingFaceLocalSearchPage> {
  const response = await huggingFaceApiFetchUrl(nextUrl, undefined, options);
  const { models, nextUrl: next } = await parseHuggingFaceModelListResponse(response);
  const entries = await modelsToLocalEntries(models, {
    query,
    capabilityFilter: options?.capabilityFilter ?? "text",
    hfToken: options?.hfToken,
  });
  return { models: entries, nextUrl: next };
}
