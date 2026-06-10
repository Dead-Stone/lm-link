import { resolveLibraryEntryDownloadCount } from "./library-entry-downloads";
import { LocalModelInfo } from "./local-models";
import {
  libraryLocalModelDetailScore,
  libraryRemoteEntryDetailScore,
} from "./library-entry-rank";
import { RemoteLibraryEntry } from "./remote-model-library";

export type LibraryBrowseItem =
  | { kind: "remote"; key: string; entry: RemoteLibraryEntry }
  | { kind: "local"; key: string; model: LocalModelInfo };

export function libraryBrowseItemDetailScore(item: LibraryBrowseItem): number {
  if (item.kind === "remote") {
    return libraryRemoteEntryDetailScore(item.entry);
  }
  const downloadScore = resolveLibraryEntryDownloadCount({
    id: item.model.downloadUrl,
    description: item.model.description,
  });
  if (downloadScore > 0) return downloadScore;
  return libraryLocalModelDetailScore(item.model);
}

function toRemoteBrowseItems(entries: RemoteLibraryEntry[]): LibraryBrowseItem[] {
  return entries.map((entry) => ({
    kind: "remote" as const,
    key: `remote:${entry.id}`,
    entry,
  }));
}

function toLocalBrowseItems(models: LocalModelInfo[]): LibraryBrowseItem[] {
  return models.map((model) => ({
    kind: "local" as const,
    key: `local:${model.key}`,
    model,
  }));
}

function sortKeysByScore(keys: string[], byKey: Map<string, LibraryBrowseItem>): string[] {
  return [...keys].sort((a, b) => {
    const left = byKey.get(a);
    const right = byKey.get(b);
    if (!left || !right) return 0;
    return libraryBrowseItemDetailScore(right) - libraryBrowseItemDetailScore(left);
  });
}

/** Mac/PC and on-device models in one list. Initial load sorts by popularity; pagination keeps order. */
export function mergeStableLibraryBrowseItems(
  remoteEntries: RemoteLibraryEntry[],
  localModels: LocalModelInfo[],
  previousKeys?: readonly string[]
): LibraryBrowseItem[] {
  const remoteItems = toRemoteBrowseItems(remoteEntries);
  const localItems = toLocalBrowseItems(localModels);

  const byKey = new Map<string, LibraryBrowseItem>();
  for (const item of [...remoteItems, ...localItems]) {
    byKey.set(item.key, item);
  }

  if (previousKeys?.length) {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const key of previousKeys) {
      if (byKey.has(key)) {
        order.push(key);
        seen.add(key);
      }
    }
    for (const item of remoteItems) {
      if (!seen.has(item.key)) {
        order.push(item.key);
        seen.add(item.key);
      }
    }
    for (const item of localItems) {
      if (!seen.has(item.key)) {
        order.push(item.key);
        seen.add(item.key);
      }
    }
    return order
      .map((key) => byKey.get(key))
      .filter((item): item is LibraryBrowseItem => item != null);
  }

  const nextOrder = sortKeysByScore(
    [...byKey.keys()],
    byKey
  );

  return nextOrder
    .map((key) => byKey.get(key))
    .filter((item): item is LibraryBrowseItem => item != null);
}
