import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  displayNameFromGgufFilename,
  ggufFilenameFromUrl,
} from "./model-download-string";
import { isModelDownloaded, LocalModelInfo } from "./local-models";

const STORAGE_KEY = "lmlink:custom-local-models";

export type CustomLocalModelRecord = {
  key: string;
  filename: string;
  sourceUrl: string;
  name: string;
};

export function customModelKey(filename: string): string {
  return `custom:${filename}`;
}

export function toLocalModelInfo(record: CustomLocalModelRecord): LocalModelInfo {
  return {
    key: record.key,
    name: record.name,
    provider: "Custom",
    providerColor: "#888888",
    description: "Downloaded from the web.",
    sizeLabel: "—",
    ramLabel: "—",
    badge: "Custom",
    badgeColor: "#888888",
    downloadUrl: record.sourceUrl,
    filename: record.filename,
  };
}

async function readRecords(): Promise<CustomLocalModelRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomLocalModelRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records: CustomLocalModelRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function getAllCustomLocalModelRecords(): Promise<CustomLocalModelRecord[]> {
  return readRecords();
}

export async function getCustomLocalModelRecords(): Promise<CustomLocalModelRecord[]> {
  const records = await readRecords();
  return records.filter((record) => isModelDownloaded(record.filename));
}

export async function registerCustomLocalModel(sourceUrl: string): Promise<CustomLocalModelRecord> {
  const filename = ggufFilenameFromUrl(sourceUrl);
  const key = customModelKey(filename);
  const name = displayNameFromGgufFilename(filename);
  const record: CustomLocalModelRecord = { key, filename, sourceUrl, name };

  const records = await readRecords();
  const next = records.filter((item) => item.key !== key);
  next.push(record);
  await writeRecords(next);
  return record;
}

export async function removeCustomLocalModel(filename: string): Promise<void> {
  const records = await readRecords();
  await writeRecords(records.filter((item) => item.filename !== filename));
}

export async function getCustomLocalModels(): Promise<LocalModelInfo[]> {
  const records = await getCustomLocalModelRecords();
  return records.map(toLocalModelInfo);
}

