import { matchesModelSearchQuery } from "./model-name";

export type ParsedLibrarySearch = {
  /** Org prefix when the user types e.g. `qwen/` or `meta/llama`. */
  providerPrefix: string | null;
  /** Text after the org slash, or the full query when no org prefix. */
  searchText: string;
  raw: string;
};

export function parseLibrarySearchQuery(raw: string): ParsedLibrarySearch {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { providerPrefix: null, searchText: "", raw: "" };
  }
  if (/^https?:\/\//i.test(trimmed) || /huggingface\.co/i.test(trimmed)) {
    return { providerPrefix: null, searchText: trimmed, raw: trimmed };
  }

  const slashIdx = trimmed.indexOf("/");
  if (slashIdx > 0) {
    const org = trimmed.slice(0, slashIdx).trim();
    const rest = trimmed.slice(slashIdx + 1).trim();
    if (/^[a-z0-9][a-z0-9._-]*$/i.test(org)) {
      return {
        providerPrefix: org.toLowerCase(),
        searchText: rest,
        raw: trimmed,
      };
    }
  }

  return { providerPrefix: null, searchText: trimmed, raw: trimmed };
}

export function modelOrgFromId(id: string): string {
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash).toLowerCase() : "";
}

function normalizeProviderToken(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, "");
}

export function matchesLibraryProviderPrefix(
  idOrOrg: string,
  prefix: string | null,
  publisher?: string | null
): boolean {
  if (!prefix) return true;

  const p = normalizeProviderToken(prefix);
  if (!p) return true;

  if (idOrOrg.includes("/")) {
    const org = normalizeProviderToken(modelOrgFromId(idOrOrg));
    if (org === p || org.startsWith(p) || p.startsWith(org)) return true;
  } else if (idOrOrg) {
    const token = normalizeProviderToken(idOrOrg);
    if (token === p || token.startsWith(p) || p.startsWith(token)) return true;
  }

  if (publisher) {
    const pub = normalizeProviderToken(publisher);
    if (pub === p || pub.startsWith(p) || p.startsWith(pub)) return true;
  }

  return false;
}

/** Match catalog rows against free text and optional `org/` provider prefix. */
export function matchesLibrarySearch(
  haystackParts: (string | null | undefined)[],
  query: string,
  options?: { id?: string; publisher?: string | null }
): boolean {
  const parsed = parseLibrarySearchQuery(query);

  if (
    parsed.providerPrefix &&
    !matchesLibraryProviderPrefix(
      options?.id ?? "",
      parsed.providerPrefix,
      options?.publisher
    )
  ) {
    return false;
  }

  const text = parsed.searchText.trim();
  if (!text) return true;

  const hay = haystackParts.filter(Boolean).join(" ");
  return matchesModelSearchQuery(hay, text);
}

export function librarySearchApiTerm(query: string): string {
  const parsed = parseLibrarySearchQuery(query);
  if (parsed.searchText.trim()) return parsed.searchText.trim();
  if (parsed.providerPrefix) return parsed.providerPrefix;
  return query.trim();
}
