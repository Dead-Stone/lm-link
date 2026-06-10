import { resolveLibraryEntryDownloadCount } from "./library-entry-downloads";
import { LocalModelInfo } from "./local-models";
import { findCuratedRemoteLibraryEntry, RemoteLibraryEntry } from "./remote-model-library";

/** Higher score = more popular / richer metadata — show earlier in the library. */
export function libraryRemoteEntryDetailScore(
  entry: Pick<
    RemoteLibraryEntry,
    "id" | "description" | "downloads" | "downloadSource" | "badge" | "sizeLabel" | "params"
  >
): number {
  let score = resolveLibraryEntryDownloadCount(entry);

  if (findCuratedRemoteLibraryEntry(entry.id)) score += 10;

  if (entry.badge === "Recomm") score += 5;
  else if (entry.badge && entry.badge !== "HF" && entry.badge !== "Direct") score += 2;

  if (entry.sizeLabel?.trim()) score += 1;
  if (entry.params?.trim()) score += 1;

  const description = entry.description?.trim();
  if (
    description &&
    !description.startsWith("Found on Hugging Face") &&
    !description.startsWith("Loading details from Hugging Face")
  ) {
    score += 1;
  }

  return score;
}

export function libraryLocalModelDetailScore(model: LocalModelInfo): number {
  let score = 0;
  if (model.badge === "Recommended") score += 2_000;
  else if (model.badge && model.badge !== "Custom") score += 400;
  if (model.sizeLabel?.trim() && model.sizeLabel !== "—") score += 800;
  if (model.description?.trim()) score += 300;
  if (model.ramLabel?.trim() && model.ramLabel !== "—") score += 100;
  return score;
}

