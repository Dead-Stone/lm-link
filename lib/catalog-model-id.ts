const NON_MODEL_ORG_PREFIXES = new Set([
  "image",
  "text",
  "application",
  "audio",
  "video",
  "font",
  "multipart",
]);

/** Reject MIME types and other org/model-shaped noise scraped from hub HTML. */
export function isPlausibleCatalogModelId(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed.includes("/")) return false;

  const slash = trimmed.indexOf("/");
  const org = trimmed.slice(0, slash).trim().toLowerCase();
  const model = trimmed.slice(slash + 1).trim();
  if (!org || !model || org.length > 64 || model.length > 128) return false;
  if (NON_MODEL_ORG_PREFIXES.has(org)) return false;
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(org)) return false;
  if (!/^[a-z0-9][a-z0-9._@+-]*$/i.test(model)) return false;
  return true;
}
