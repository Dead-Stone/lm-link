import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  formatLibraryDownloadCount,
  resolveLibraryEntryDownloadCount,
  resolveLibraryEntryDownloadSource,
} from "../lib/library-entry-downloads";
import { RemoteLibraryEntry } from "../lib/remote-model-library";
import { ThemeColors } from "../lib/theme";
import ModelProviderIcon from "./ModelProviderIcon";

type DownloadEntry = Pick<
  RemoteLibraryEntry,
  "id" | "description" | "downloads" | "downloadSource"
>;

export function PlatformDownloadStat({
  entry,
  colors,
  textStyle,
  loading = false,
  cacheRevision = 0,
}: {
  entry: DownloadEntry;
  colors: ThemeColors;
  textStyle?: object;
  loading?: boolean;
  /** Bump when background download-count prefetch finishes. */
  cacheRevision?: number;
}) {
  void cacheRevision;

  const count = resolveLibraryEntryDownloadCount(entry);
  const source = resolveLibraryEntryDownloadSource(entry);

  if (!loading && count <= 0) return null;

  const brand = source === "lmstudio" ? "lmstudio" : "huggingface";
  const platformLabel = source === "lmstudio" ? "LM Studio" : "Hugging Face";

  return (
    <View style={styles.row}>
      <ModelProviderIcon brand={brand} size={14} monochrome={false} />
      {loading && count <= 0 ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Text style={[styles.label, textStyle, { color: colors.textMuted }]}>
          {formatLibraryDownloadCount(count)} downloads on {platformLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    flexShrink: 1,
  },
});
