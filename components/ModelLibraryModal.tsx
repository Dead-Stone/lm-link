import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  downloadLmStudioModel,
  fetchModels,
  formatDownloadError,
  getLmStudioDownloadStatus,
  isDownloadSuccessStatus,
  isHubUrl,
  isRemoteModelLoaded,
  resolveManagementApiKey,
  resolveManagementBaseUrl,
} from "../lib/api";
import { parseModelName } from "../lib/model-name";
import { matchesLibrarySearch, parseLibrarySearchQuery } from "../lib/library-search";
import { resolveFileSizeLabel } from "../lib/model-size";
import { LMModel } from "../lib/types";
import { useApp } from "../lib/context";
import { RemoteLibraryEntry } from "../lib/remote-model-library";
import {
  buildDirectDownloadEntry,
  enrichRemoteLibraryEntryFromHf,
  huggingFaceRepoIdFromString,
  mergeDownloadableEntries,
  searchHuggingFaceModels,
} from "../lib/huggingface-model-search";
import {
  dedupeCatalogEntries,
  fetchLmStudioCatalogPage,
  LM_STUDIO_CATALOG_PAGE_SIZE,
} from "../lib/lmstudio-catalog";
import {
  getQuickAccessRemoteLibrary,
  normalizeModelKey,
  QUICK_ACCESS_REMOTE_MODEL_IDS,
  resolveRemoteLibraryDisplayName,
} from "../lib/remote-model-library";
import { resolveRemoteDownloadModelString } from "../lib/model-download-string";
import { ErrorKind, presentError } from "../lib/errors";
import { IS_EXPO_GO, LOCAL_NATIVE_BUILD_MESSAGE } from "../lib/local-models";
import { createModalTheme } from "../lib/modal-theme";
import DismissAffordance from "./DismissAffordance";
import SwipeDismissSheet from "./SwipeDismissSheet";
import { radii, ThemeColors, useAccentPalette } from "../lib/theme";
import { LocalModelsManager } from "./LocalModelsSection";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import SectionHintLines, { createSectionSubtitleStyle } from "./SectionHintLines";
import {
  filterRemoteLibraryCatalog,
  getRemoteInstalledStatItems,
  getRemoteLibraryEntryStatItems,
  LIBRARY_DOWNLOAD_PAGE_SIZE,
  LIBRARY_INSTALLED_PAGE_SIZE,
  LibrarySeeMoreButton,
  ModelStatItem,
  ModelStatLine,
  ModelTraitBadge,
  resolveRemoteModelTrait,
} from "./ModelPicker";
import ThemedError from "./ThemedError";

export type ModelLibraryTab = "system" | "device";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** @deprecated Unified library ignores tab — kept for callers that open from chat picker. */
  initialTab?: ModelLibraryTab;
};

function getCatalogDownloadSizeLabel(entry: RemoteLibraryEntry): string | null {
  return resolveFileSizeLabel(entry.sizeLabel, entry.id, entry.name);
}

function resolveDownloadStringLabel(entry: RemoteLibraryEntry): string {
  try {
    return resolveRemoteDownloadModelString(entry.id);
  } catch {
    return entry.id;
  }
}

function remoteSystemDownloadTitle(isSearching: boolean): string {
  return isSearching ? "Search results" : "Quick download";
}

function platformHintLine(): string {
  return "Tap any model for details · Laptop = Mac or PC · Phone = on this device";
}

function resolveEntryDescription(entry: RemoteLibraryEntry): string | null {
  const trimmed = entry.description?.trim();
  if (trimmed && !trimmed.startsWith("Loading details from Hugging Face")) {
    return trimmed;
  }
  const size = getCatalogDownloadSizeLabel(entry);
  const parts = [
    entry.params ? `${entry.params} parameter model` : null,
    entry.publisher ? `from ${entry.publisher}` : null,
    size ? `${size} download` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

type DetailSpec = { label: string; value: string };

function DetailSpecGrid({
  items,
  styles,
}: {
  items: DetailSpec[];
  styles: ReturnType<typeof createLibraryStyles>;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.detailSpecGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.detailSpecCell}>
          <Text style={styles.detailSpecLabel}>{item.label}</Text>
          <Text style={styles.detailSpecValue} numberOfLines={2}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DetailCopyPill({
  label,
  value,
  onCopy,
  colors,
  styles,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createLibraryStyles>;
}) {
  return (
    <View style={styles.detailCopyBlock}>
      <Text style={styles.detailFieldLabel}>{label}</Text>
      <Pressable
        onPress={onCopy}
        style={({ pressed }) => [styles.detailCopyPill, pressed && { opacity: 0.78 }]}
      >
        <Text style={styles.detailCopyPillText} selectable numberOfLines={2}>
          {value}
        </Text>
        <Ionicons name="copy-outline" size={14} color={colors.primaryLight} />
      </Pressable>
    </View>
  );
}

function InstalledModelDetailSheet({
  model,
  catalog,
  visible,
  onClose,
  colors,
  styles,
}: {
  model: LMModel | null;
  catalog: LMModel[];
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createLibraryStyles>;
}) {
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);

  const copyString = async (value: string) => {
    await Clipboard.setStringAsync(value);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!model) return null;

  const parsed = parseModelName(model.id);
  const stats = getRemoteInstalledStatItems(model, catalog);
  const onDiskSize = resolveFileSizeLabel(model.size_bytes, model.id, parsed.displayName);
  const loaded = isRemoteModelLoaded(model);
  const trait = resolveRemoteModelTrait(model.id);
  const publisher = model.publisher ?? model.owned_by ?? parsed.family;

  const specItems: DetailSpec[] = [
    ...(publisher ? [{ label: "Publisher", value: publisher }] : []),
    ...(model.params_string ? [{ label: "Parameters", value: model.params_string }] : []),
    ...(onDiskSize ? [{ label: "On disk", value: onDiskSize }] : []),
    ...(model.quantization ? [{ label: "Quant", value: model.quantization }] : []),
    ...(model.state ? [{ label: "State", value: model.state }] : []),
    ...(model.type ? [{ label: "Type", value: model.type }] : []),
    ...(model.arch ? [{ label: "Arch", value: model.arch }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={[modalStyles.card, styles.detailCard]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.detailHandle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.detailHero}>
              <View style={styles.detailHeroIcon}>
                <ModelModeBadgeIcon
                  platform="pc"
                  provider={publisher}
                  label={parsed.displayName}
                  size={28}
                  color={colors.textMuted}
                  monochrome
                />
              </View>
              <View style={styles.detailHeroBody}>
                <Text style={styles.detailTitle} numberOfLines={2}>
                  {parsed.displayName}
                </Text>
                {publisher ? (
                  <Text style={styles.detailPublisher} numberOfLines={1}>
                    {publisher}
                  </Text>
                ) : null}
              </View>
              {loaded ? (
                <ModelTraitBadge
                  trait={{ label: "Loaded", color: colors.primaryLight }}
                  muted
                  colors={colors}
                />
              ) : trait ? (
                <ModelTraitBadge trait={trait} muted colors={colors} />
              ) : null}
            </View>

            {stats.length > 0 ? (
              <ModelStatLine
                items={stats}
                colors={colors}
                textStyle={styles.libraryStats}
                muted
              />
            ) : null}

            <DetailSpecGrid items={specItems} styles={styles} />

            <DetailCopyPill
              label="Model ID"
              value={model.id}
              onCopy={() => void copyString(model.id)}
              colors={colors}
              styles={styles}
            />
          </ScrollView>

          <View style={styles.detailActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                modalStyles.primaryBtn,
                styles.detailCloseBtn,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={modalStyles.primaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InstalledModelRow({
  model,
  selected,
  onPress,
  styles,
  colors,
}: {
  model: LMModel;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createLibraryStyles>;
  colors: ThemeColors;
}) {
  const parsed = parseModelName(model.id);
  const onDiskSize = resolveFileSizeLabel(model.size_bytes, model.id, parsed.displayName);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.libraryRow,
        styles.libraryRowSelectable,
        selected && styles.libraryRowSelected,
        pressed && styles.libraryRowPressed,
      ]}
    >
      <View style={styles.libraryIcon}>
        <ModelModeBadgeIcon
          platform="pc"
          provider={model.publisher ?? model.owned_by ?? parsed.family}
          label={parsed.displayName}
          size={20}
          color={selected ? colors.primaryLight : colors.textMuted}
          monochrome={!selected}
        />
      </View>
      <View style={styles.libraryBody}>
        <Text
          style={[styles.libraryName, selected && styles.libraryNameSelected]}
          numberOfLines={1}
        >
          {parsed.displayName}
        </Text>
        <Text style={styles.libraryModelId} numberOfLines={1}>
          {model.id}
        </Text>
        {onDiskSize ? <Text style={styles.libraryDownloadSize}>{onDiskSize}</Text> : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={selected ? colors.primaryLight : colors.textDim}
        style={styles.libraryRowChevron}
      />
    </Pressable>
  );
}

function RemoteModelDetailSheet({
  entry,
  visible,
  onClose,
  onDownload,
  downloading,
  downloadDisabled,
  colors,
  styles,
}: {
  entry: RemoteLibraryEntry | null;
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
  downloadDisabled?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createLibraryStyles>;
}) {
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const [resolvedEntry, setResolvedEntry] = useState<RemoteLibraryEntry | null>(entry);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !entry) {
      setResolvedEntry(entry);
      setDetailsLoading(false);
      return;
    }

    setResolvedEntry(entry);
    let cancelled = false;
    setDetailsLoading(true);

    void enrichRemoteLibraryEntryFromHf(entry)
      .then((enriched) => {
        if (!cancelled) setResolvedEntry(enriched);
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, entry?.id, entry]);

  const activeEntry = resolvedEntry ?? entry;
  const downloadString = activeEntry ? resolveDownloadStringLabel(activeEntry) : "";
  const stats = activeEntry ? getLibraryStatItems(activeEntry) : [];
  const repoId = activeEntry ? huggingFaceRepoIdFromString(activeEntry.id) : null;

  const copyString = async (value: string) => {
    await Clipboard.setStringAsync(value);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!activeEntry) return null;

  const displayName = resolveRemoteLibraryDisplayName(activeEntry);
  const description = resolveEntryDescription(activeEntry);
  const trait =
    activeEntry.badge != null
      ? { label: activeEntry.badge, color: activeEntry.badgeColor }
      : resolveRemoteModelTrait(activeEntry.id);
  const downloadSize = getCatalogDownloadSizeLabel(activeEntry);
  const specItems: DetailSpec[] = [
    { label: "Publisher", value: activeEntry.publisher },
    ...(activeEntry.params ? [{ label: "Parameters", value: activeEntry.params }] : []),
    ...(downloadSize ? [{ label: "Download", value: downloadSize }] : []),
    ...(repoId && repoId !== activeEntry.id ? [{ label: "HF repo", value: repoId }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={[modalStyles.card, styles.detailCard]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.detailHandle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.detailHero}>
              <View style={styles.detailHeroIcon}>
                <ModelModeBadgeIcon
                  platform="pc"
                  provider={activeEntry.publisher}
                  label={displayName}
                  size={28}
                  color={colors.textMuted}
                  monochrome
                />
              </View>
              <View style={styles.detailHeroBody}>
                <Text style={styles.detailTitle} numberOfLines={2}>
                  {displayName}
                </Text>
                <Text style={styles.detailPublisher} numberOfLines={1}>
                  {activeEntry.publisher}
                </Text>
              </View>
              {trait ? <ModelTraitBadge trait={trait} muted colors={colors} /> : null}
            </View>

            {stats.length > 0 ? (
              <ModelStatLine
                items={stats}
                colors={colors}
                textStyle={styles.libraryStats}
                muted
              />
            ) : null}

            {detailsLoading ? (
              <View style={styles.detailBlurb}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.detailDescription, { marginTop: 8 }]}>
                  Loading Hugging Face details…
                </Text>
              </View>
            ) : description ? (
              <View style={styles.detailBlurb}>
                <Text style={styles.detailDescription}>{description}</Text>
              </View>
            ) : null}

            <DetailSpecGrid items={specItems} styles={styles} />

            <DetailCopyPill
              label="Model ID"
              value={activeEntry.id}
              onCopy={() => void copyString(activeEntry.id)}
              colors={colors}
              styles={styles}
            />
            {downloadString !== activeEntry.id ? (
              <DetailCopyPill
                label="Download string"
                value={downloadString}
                onCopy={() => void copyString(downloadString)}
                colors={colors}
                styles={styles}
              />
            ) : null}
          </ScrollView>

          <View style={styles.detailActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [modalStyles.secondaryBtn, pressed && { opacity: 0.72 }]}
            >
              <Text style={modalStyles.secondaryBtnText}>Close</Text>
            </Pressable>
            <Pressable
              onPress={onDownload}
              disabled={downloading || downloadDisabled}
              style={({ pressed }) => [
                modalStyles.primaryBtn,
                styles.detailDownloadBtn,
                (downloading || downloadDisabled) && { opacity: 0.55 },
                pressed && !downloading && !downloadDisabled && { opacity: 0.88 },
              ]}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.primaryLight} />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={16} color={colors.primaryLight} />
                  <Text style={modalStyles.primaryBtnText}>Download</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getLibraryStatItems(entry: RemoteLibraryEntry): ModelStatItem[] {
  return getRemoteLibraryEntryStatItems(entry);
}

function LibraryDownloadRow({
  entry,
  downloading,
  progress,
  onPress,
  onDownload,
  disabled,
  styles,
  colors,
}: {
  entry: RemoteLibraryEntry;
  downloading: boolean;
  progress: number | null;
  onPress: () => void;
  onDownload: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createLibraryStyles>;
  colors: ThemeColors;
}) {
  const displayName = resolveRemoteLibraryDisplayName(entry);
  const stats = getLibraryStatItems(entry);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.libraryRow, pressed && styles.libraryRowPressed]}
    >
      <View style={styles.libraryIcon}>
        <ModelModeBadgeIcon
          platform="pc"
          provider={entry.publisher}
          label={displayName}
          size={20}
          color={colors.textMuted}
          monochrome
        />
      </View>
      <View style={styles.libraryBody}>
        <View style={styles.libraryTitleRow}>
          <Text style={styles.libraryName} numberOfLines={1}>
            {displayName}
          </Text>
          {entry.badge ? (
            <ModelTraitBadge
              trait={{ label: entry.badge, color: entry.badgeColor }}
              muted
              colors={colors}
            />
          ) : null}
        </View>
        <ModelStatLine items={stats} colors={colors} textStyle={styles.libraryStats} muted />
        {downloading ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((progress ?? 0) * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onDownload();
        }}
        disabled={downloading || disabled}
        style={({ pressed }) => [
          styles.downloadBtn,
          downloading && styles.downloadBtnActive,
          (downloading || disabled) && styles.downloadBtnDisabled,
          pressed && !downloading && !disabled && styles.downloadBtnPressed,
        ]}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={colors.primaryLight} />
        ) : (
          <Ionicons name="cloud-download-outline" size={18} color={colors.primaryLight} />
        )}
      </Pressable>
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} style={styles.libraryRowChevron} />
    </Pressable>
  );
}

function UnifiedModelLibrary({
  active,
  bottomInset,
}: {
  active: boolean;
  bottomInset: number;
}) {
  const { settings, account } = useApp();
  const colors = useAccentPalette();
  const styles = useMemo(() => createLibraryStyles(colors), [colors]);

  const managementUrl = useMemo(
    () => resolveManagementBaseUrl(settings),
    [settings.baseUrl, settings.localServerUrl]
  );
  const managementApiKey = useMemo(
    () => resolveManagementApiKey(settings, account),
    [settings.baseUrl, settings.localServerUrl, settings.apiKey, account?.token]
  );
  const usingHub = isHubUrl(settings.baseUrl);
  const downloadsBlocked = !managementUrl;
  const showApiTokenNote = !managementApiKey && !!managementUrl;

  const [installedModels, setInstalledModels] = useState<LMModel[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);
  const [catalogEntries, setCatalogEntries] = useState<RemoteLibraryEntry[]>([]);
  const [webEntries, setWebEntries] = useState<RemoteLibraryEntry[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailEntry, setDetailEntry] = useState<RemoteLibraryEntry | null>(null);
  const [selectedInstalled, setSelectedInstalled] = useState<LMModel | null>(null);
  const [downloads, setDownloads] = useState<
    Record<string, { jobId: string; progress: number | null }>
  >({});
  const [downloadVisibleCount, setDownloadVisibleCount] = useState(LIBRARY_DOWNLOAD_PAGE_SIZE);
  const [installedVisibleCount, setInstalledVisibleCount] = useState(LIBRARY_INSTALLED_PAGE_SIZE);

  const installedIds = useMemo(() => installedModels.map((model) => model.id), [installedModels]);

  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const catalogRequestRef = useRef(0);
  const webRequestRef = useRef(0);

  const directDownloadEntry = useMemo(
    () => (search.trim() ? buildDirectDownloadEntry(search) : null),
    [search]
  );

  const isSearching = search.trim().length > 0;

  const curatedDownloadEntries = useMemo(
    () => filterRemoteLibraryCatalog(installedIds, search),
    [installedIds, search]
  );

  const downloadableEntries = useMemo(() => {
    if (!isSearching) {
      return curatedDownloadEntries;
    }

    const merged = mergeDownloadableEntries(
      dedupeCatalogEntries(catalogEntries),
      dedupeCatalogEntries(webEntries)
    );
    const combined = mergeDownloadableEntries(curatedDownloadEntries, merged);
    if (!directDownloadEntry) return combined;
    const directKey = normalizeModelKey(directDownloadEntry.id);
    if (combined.some((entry) => normalizeModelKey(entry.id) === directKey)) {
      return combined;
    }
    return [directDownloadEntry, ...combined];
  }, [
    isSearching,
    curatedDownloadEntries,
    catalogEntries,
    webEntries,
    directDownloadEntry,
  ]);

  const downloadSectionLoading = isSearching && (catalogLoading || webSearchLoading);

  const quickRemoteEntries = useMemo(
    () => getQuickAccessRemoteLibrary(installedIds),
    [installedIds]
  );

  const quickRemoteKeySet = useMemo(
    () => new Set(QUICK_ACCESS_REMOTE_MODEL_IDS.map((id) => normalizeModelKey(id))),
    []
  );

  const browseDownloadableEntries = useMemo(() => {
    if (isSearching) return downloadableEntries;
    return downloadableEntries.filter(
      (entry) => !quickRemoteKeySet.has(normalizeModelKey(entry.id))
    );
  }, [downloadableEntries, isSearching, quickRemoteKeySet]);

  const visibleDownloadableEntries = useMemo(
    () => browseDownloadableEntries.slice(0, downloadVisibleCount),
    [browseDownloadableEntries, downloadVisibleCount]
  );

  const hasMoreDownloadable = isSearching
    ? downloadableEntries.length > downloadVisibleCount || catalogHasMore
    : browseDownloadableEntries.length > downloadVisibleCount;

  const filteredInstalledModels = useMemo(() => {
    return installedModels
      .filter((model) =>
        matchesLibrarySearch(
          [
            model.id,
            parseModelName(model.id).displayName,
            parseModelName(model.id).family,
            model.arch,
            model.type,
            model.publisher,
            model.owned_by,
            model.quantization,
            model.state,
            model.params_string,
            model.size_bytes ? resolveFileSizeLabel(model.size_bytes) : null,
          ],
          search,
          { id: model.id, publisher: model.publisher ?? model.owned_by }
        )
      )
      .sort((a, b) =>
        parseModelName(a.id).displayName.localeCompare(parseModelName(b.id).displayName)
      );
  }, [installedModels, search]);

  const visibleInstalledModels = useMemo(
    () => filteredInstalledModels.slice(0, installedVisibleCount),
    [filteredInstalledModels, installedVisibleCount]
  );

  const hasMoreInstalled = filteredInstalledModels.length > installedVisibleCount;

  const refreshInstalledModels = useCallback(async () => {
    if (!active) return;
    const listUrl = managementUrl ?? settings.baseUrl;
    setInstalledLoading(true);
    try {
      const models = await fetchModels(listUrl, managementApiKey);
      setInstalledModels(models);
    } catch {
      setInstalledModels([]);
    } finally {
      setInstalledLoading(false);
    }
  }, [active, managementUrl, managementApiKey, settings.baseUrl]);

  const loadCatalogPage = useCallback(
    async (page: number, reset: boolean) => {
      const requestId = ++catalogRequestRef.current;
      if (reset) {
        setCatalogLoading(true);
        setCatalogEntries([]);
        setCatalogPage(0);
        setCatalogHasMore(false);
      } else {
        setCatalogLoadingMore(true);
      }

      try {
        const { entries, hasMore } = await fetchLmStudioCatalogPage({
          managementUrl,
          apiKey: managementApiKey,
          search,
          modalityFilter: "all",
          page,
          pageSize: LM_STUDIO_CATALOG_PAGE_SIZE,
          installedIds,
        });
        if (requestId !== catalogRequestRef.current) return;

        setCatalogEntries((prev) =>
          dedupeCatalogEntries(reset ? entries : [...prev, ...entries])
        );
        setCatalogPage(page);
        setCatalogHasMore(hasMore);
      } catch (e: unknown) {
        if (requestId !== catalogRequestRef.current) return;
        if (reset) {
          setCatalogEntries([]);
          setCatalogHasMore(false);
        }
        setError(e instanceof Error ? e.message : "Could not load model catalog");
      } finally {
        if (requestId === catalogRequestRef.current) {
          setCatalogLoading(false);
          setCatalogLoadingMore(false);
        }
      }
    },
    [managementUrl, managementApiKey, search, installedIds]
  );

  useEffect(() => {
    if (active) {
      setSearch("");
      setDownloadVisibleCount(LIBRARY_DOWNLOAD_PAGE_SIZE);
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
      setSelectedInstalled(null);
      refreshInstalledModels();
    }
    return () => {
      for (const interval of pollRefs.current.values()) {
        clearInterval(interval);
      }
      pollRefs.current.clear();
    };
  }, [active, refreshInstalledModels]);

  useEffect(() => {
    if (active) {
      setDownloadVisibleCount(LIBRARY_DOWNLOAD_PAGE_SIZE);
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
    }
  }, [active, search]);

  useEffect(() => {
    if (!active) return;
    if (!search.trim()) {
      setCatalogEntries([]);
      setCatalogHasMore(false);
      setCatalogLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void loadCatalogPage(0, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [active, search, installedIds, loadCatalogPage]);

  useEffect(() => {
    if (!active) return;
    const query = search.trim();
    const parsed = parseLibrarySearchQuery(query);
    if (!parsed.providerPrefix && query.length < 2) {
      setWebEntries([]);
      setWebSearchLoading(false);
      return;
    }

    const requestId = ++webRequestRef.current;
    setWebSearchLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const entries = await searchHuggingFaceModels(query, {
            installedIds,
          });
          if (requestId !== webRequestRef.current) return;
          setWebEntries(entries);
        } catch {
          if (requestId !== webRequestRef.current) return;
          setWebEntries([]);
        } finally {
          if (requestId === webRequestRef.current) {
            setWebSearchLoading(false);
          }
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [active, search, installedIds]);

  const finishDownload = useCallback(
    async (modelId: string) => {
      const interval = pollRefs.current.get(modelId);
      if (interval) {
        clearInterval(interval);
        pollRefs.current.delete(modelId);
      }
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      await refreshInstalledModels();
    },
    [refreshInstalledModels]
  );

  const handleSeeMoreDownloadable = useCallback(() => {
    const nextCount = downloadVisibleCount + LIBRARY_DOWNLOAD_PAGE_SIZE;
    setDownloadVisibleCount(nextCount);
    if (
      isSearching &&
      nextCount > downloadableEntries.length &&
      catalogHasMore &&
      !catalogLoading &&
      !catalogLoadingMore
    ) {
      void loadCatalogPage(catalogPage + 1, false);
    }
  }, [
    isSearching,
    downloadVisibleCount,
    downloadableEntries.length,
    catalogHasMore,
    catalogLoading,
    catalogLoadingMore,
    catalogPage,
    loadCatalogPage,
  ]);

  const pollDownload = useCallback(
    (modelId: string, jobId: string) => {
      const existing = pollRefs.current.get(modelId);
      if (existing) clearInterval(existing);

      const interval = setInterval(async () => {
        try {
          const status = await getLmStudioDownloadStatus(
            managementUrl!,
            jobId,
            managementApiKey
          );
          const total = status.total_size_bytes ?? 0;
          const done = status.downloaded_bytes ?? 0;
          const progress = total > 0 ? done / total : null;

          setDownloads((prev) => ({
            ...prev,
            [modelId]: { jobId, progress },
          }));

          if (isDownloadSuccessStatus(status.status)) {
            await finishDownload(modelId);
          } else if (status.status === "failed" || status.status === "error") {
            const prevInterval = pollRefs.current.get(modelId);
            if (prevInterval) clearInterval(prevInterval);
            pollRefs.current.delete(modelId);
            setDownloads((prev) => {
              const next = { ...prev };
              delete next[modelId];
              return next;
            });
            setError(status.error ?? `Download failed for ${modelId}`);
          }
        } catch (e: unknown) {
          const prevInterval = pollRefs.current.get(modelId);
          if (prevInterval) clearInterval(prevInterval);
          pollRefs.current.delete(modelId);
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          setError(e instanceof Error ? e.message : "Download status check failed");
        }
      }, 1500);
      pollRefs.current.set(modelId, interval);
    },
    [managementUrl, managementApiKey, finishDownload]
  );

  const handleDownload = useCallback(
    async (modelId: string) => {
      if (!managementUrl) {
        setError(formatDownloadError(new Error("no local url"), settings));
        return;
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setError(null);
      setDownloads((prev) => ({ ...prev, [modelId]: { jobId: "", progress: 0 } }));
      try {
        const job = await downloadLmStudioModel(managementUrl, modelId, managementApiKey);
        if (isDownloadSuccessStatus(job.status)) {
          await finishDownload(modelId);
          return;
        }
        if (!job.job_id) {
          throw new Error("Download started but no job ID was returned from LM Studio");
        }
        setDownloads((prev) => ({
          ...prev,
          [modelId]: { jobId: job.job_id, progress: 0 },
        }));
        pollDownload(modelId, job.job_id);
      } catch (e: unknown) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        setError(formatDownloadError(e, settings));
      }
    },
    [managementUrl, managementApiKey, pollDownload, settings, finishDownload]
  );

  const listHeader =
    downloadsBlocked && usingHub ? (
      <View style={styles.hubBanner}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primaryLight} />
        <View style={styles.hubBannerBody}>
          <Text style={styles.hubBannerTitle}>Direct Mac connection required</Text>
          <Text style={styles.hubBannerText}>
            Hub lets you chat remotely, but downloads install on your Mac over local Wi‑Fi.
            Add your Mac's server URL in Settings → Connection → Local.
          </Text>
        </View>
      </View>
    ) : null;

  const apiTokenNote = showApiTokenNote ? (
    <View style={styles.apiFootnote}>
      <Ionicons name="information-circle-outline" size={15} color={colors.textDim} />
      <View style={styles.apiFootnoteBody}>
        <Text style={styles.apiFootnoteText}>
          API tokens are optional — only needed if authentication is enabled on your Mac. You can
          try downloading without one, or add a token later under Connection → Local → Advanced.
        </Text>
      </View>
    </View>
  ) : null;

  const showDownloadedSection =
    installedLoading || filteredInstalledModels.length > 0 || !IS_EXPO_GO;

  const showDiscoverSection = true;

  return (
    <View style={styles.libraryRoot}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search models, org/model, or qwen/…"
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ThemedError
            variant="inline"
            message={error}
            kind="network"
            onDismiss={() => setError(null)}
          />
        </View>
      ) : null}

      {IS_EXPO_GO ? (
        <View style={styles.libraryBlockWrap}>
          <LibraryBlockBanner
            message={LOCAL_NATIVE_BUILD_MESSAGE}
            kind="local"
            styles={styles}
            colors={colors}
          />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: bottomInset + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {listHeader}
        {showDownloadedSection ? (
          <View style={styles.installedSection}>
            <Text style={styles.sectionTitle}>Downloaded</Text>
            <SectionHintLines colors={colors} line={platformHintLine()} />
            {installedLoading && filteredInstalledModels.length === 0 ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
            ) : null}
            {!installedLoading && filteredInstalledModels.length === 0 && IS_EXPO_GO ? (
              <Text style={styles.sectionEmptyText}>No models downloaded on your Mac or PC yet.</Text>
            ) : null}
            {visibleInstalledModels.map((model) => (
              <InstalledModelRow
                key={model.id}
                model={model}
                selected={selectedInstalled?.id === model.id}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedInstalled(model);
                }}
                styles={styles}
                colors={colors}
              />
            ))}
            {hasMoreInstalled ? (
              <LibrarySeeMoreButton
                colors={colors}
                onPress={() =>
                  setInstalledVisibleCount((count) => count + LIBRARY_INSTALLED_PAGE_SIZE)
                }
              />
            ) : null}
            <LocalModelsManager
              searchQuery={search}
              libraryLayout
              librarySection="downloaded"
              hideSectionTitles
              suppressFootnote
              downloadOnly
              blocked={IS_EXPO_GO}
            />
          </View>
        ) : null}
        {showDiscoverSection ? (
          <View style={styles.downloadSection}>
            <Text style={styles.sectionTitle}>{remoteSystemDownloadTitle(isSearching)}</Text>
            <SectionHintLines colors={colors} line={platformHintLine()} />
            {!isSearching && quickRemoteEntries.length > 0 ? (
              <View style={styles.quickDownloadBlock}>
                <Text style={styles.quickDownloadPlatformTitle}>Mac or PC</Text>
                {quickRemoteEntries.map((entry) => (
                  <LibraryDownloadRow
                    key={entry.id}
                    entry={entry}
                    downloading={!!downloads[entry.id]}
                    progress={downloads[entry.id]?.progress ?? null}
                    onPress={() => setDetailEntry(entry)}
                    onDownload={() => handleDownload(entry.id)}
                    disabled={downloadsBlocked}
                    styles={styles}
                    colors={colors}
                  />
                ))}
              </View>
            ) : null}
            <LocalModelsManager
              searchQuery={search}
              libraryLayout
              librarySection="discover"
              hideSectionTitles
              suppressFootnote
              downloadOnly
              blocked={IS_EXPO_GO}
              showQuickDownloadLocal={!isSearching}
              unifiedDiscover={{
                remoteEntries: visibleDownloadableEntries,
                renderRemoteRow: (entry) => (
                  <LibraryDownloadRow
                    entry={entry}
                    downloading={!!downloads[entry.id]}
                    progress={downloads[entry.id]?.progress ?? null}
                    onPress={() => setDetailEntry(entry)}
                    onDownload={() => handleDownload(entry.id)}
                    disabled={downloadsBlocked}
                    styles={styles}
                    colors={colors}
                  />
                ),
                remoteSortName: resolveRemoteLibraryDisplayName,
                hasMoreRemote: hasMoreDownloadable,
                onSeeMoreRemote: handleSeeMoreDownloadable,
                loadingMoreRemote: catalogLoadingMore,
                loading: downloadSectionLoading,
                moreDiscoverTitle: !isSearching ? "More to discover" : undefined,
              }}
            />
          </View>
        ) : null}
        {apiTokenNote}
      </ScrollView>

      <InstalledModelDetailSheet
        model={selectedInstalled}
        catalog={installedModels}
        visible={selectedInstalled !== null}
        onClose={() => setSelectedInstalled(null)}
        colors={colors}
        styles={styles}
      />

      <RemoteModelDetailSheet
        entry={detailEntry}
        visible={detailEntry !== null}
        onClose={() => setDetailEntry(null)}
        onDownload={() => {
          if (!detailEntry) return;
          void handleDownload(detailEntry.id);
        }}
        downloading={detailEntry ? !!downloads[detailEntry.id] : false}
        downloadDisabled={downloadsBlocked}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

function LibraryBlockBanner({
  message,
  kind = "local",
  styles,
  colors,
}: {
  message: string;
  kind?: ErrorKind;
  styles: ReturnType<typeof createLibraryStyles>;
  colors: ThemeColors;
}) {
  const pres = presentError(message, kind);
  const accent = kind === "local" ? "#f59e0b" : colors.error;

  return (
    <View
      style={[
        styles.libraryBlockBanner,
        kind === "local" ? styles.libraryBlockBannerWarning : styles.libraryBlockBannerError,
      ]}
    >
      <Ionicons name={pres.icon} size={18} color={accent} />
      <View style={styles.hubBannerBody}>
        <Text style={[styles.libraryBlockTitle, { color: accent }]}>{pres.title}</Text>
        <Text style={styles.hubBannerText}>{message}</Text>
        {pres.hint ? <Text style={styles.libraryBlockHint}>{pres.hint}</Text> : null}
      </View>
    </View>
  );
}

function LibraryFooter({
  bottomInset,
  styles,
  colors,
}: {
  bottomInset: number;
  styles: ReturnType<typeof createModalStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + 12, gap: 4 }]}>
      <Pressable
        onPress={() => void Linking.openURL("https://lmstudio.ai/trending/models")}
        style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}
      >
        <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        <Text style={styles.footerLinkText}>Browse LM Studio Hub</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
      </Pressable>
      <Pressable
        onPress={() =>
          void Linking.openURL("https://huggingface.co/models?library=gguf&sort=downloads")
        }
        style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}
      >
        <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
        <Text style={styles.footerLinkText}>Browse GGUF on Hugging Face</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

export default function ModelLibraryModal({
  visible,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useAccentPalette();
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={[modalStyles.pageContainer, { flex: 1 }]}>
      <SwipeDismissSheet direction="down" onDismiss={onClose} style={modalStyles.pageContainer}>
      <View style={[modalStyles.pageContainer, { paddingTop: insets.top }]}>
        <View style={modalStyles.pageHeader}>
          <DismissAffordance kind="down" colors={colors} />
          <Text style={modalStyles.pageTitle}>Model Library</Text>
          <View style={modalStyles.pageHeaderBtn} />
        </View>

        <View style={styles.body}>
          <UnifiedModelLibrary active={visible} bottomInset={insets.bottom + 88} />
        </View>

        <LibraryFooter bottomInset={insets.bottom} styles={styles} colors={colors} />
      </View>
      </SwipeDismissSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1 },
    tabsWrap: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    footerLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    footerLinkPressed: { opacity: 0.75 },
    footerLinkText: { color: colors.textMuted, fontSize: 14, fontWeight: "600", flex: 1 },
  });
}

function createLibraryStyles(colors: ThemeColors) {
  return StyleSheet.create({
    libraryRoot: {
      flex: 1,
      width: "100%",
      alignSelf: "stretch",
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, color: colors.inputText, fontSize: 15, padding: 0 },
    errorWrap: { paddingHorizontal: 16, marginBottom: 8 },
    installedSection: { paddingTop: 8, paddingBottom: 4 },
    downloadSection: { marginTop: 20, paddingTop: 8, paddingBottom: 4 },
    quickDownloadBlock: { marginBottom: 4 },
    quickDownloadPlatformTitle: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginTop: 4,
      marginBottom: 2,
    },
    sectionEmptyText: {
      color: colors.textDim,
      fontSize: 14,
      lineHeight: 20,
      marginVertical: 8,
    },
    hubBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      marginBottom: 12,
      borderRadius: radii.md,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    hubBannerBody: { flex: 1, minWidth: 0 },
    hubBannerTitle: {
      color: colors.primaryLight,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 4,
    },
    hubBannerText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    hubBannerLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 8,
      alignSelf: "flex-start",
    },
    hubBannerLinkPressed: { opacity: 0.65 },
    hubBannerLinkText: {
      color: colors.primaryLight,
      fontSize: 13,
      fontWeight: "600",
    },
    libraryBlockWrap: {
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    libraryBlockBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: radii.md,
      borderWidth: 1,
    },
    libraryBlockBannerWarning: {
      backgroundColor: "rgba(245,158,11,0.08)",
      borderColor: "rgba(245,158,11,0.28)",
    },
    libraryBlockBannerError: {
      backgroundColor: colors.errorBg,
      borderColor: colors.errorBorder,
    },
    libraryBlockTitle: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 4,
    },
    libraryBlockHint: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    installedHeader: { paddingTop: 8, marginBottom: 8 },
    sectionTitle: createSectionSubtitleStyle(colors),
    libraryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    libraryRowPressed: { opacity: 0.82 },
    libraryRowSelectable: {
      borderRadius: radii.sm,
      marginHorizontal: -4,
      paddingHorizontal: 4,
    },
    libraryRowSelected: {
      backgroundColor: colors.primaryGlow,
    },
    libraryRowChevron: {
      marginTop: 4,
      flexShrink: 0,
    },
    libraryIcon: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    libraryBody: { flex: 1, minWidth: 0 },
    libraryTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    libraryName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 22,
      flexShrink: 1,
    },
    libraryNameSelected: {
      color: colors.primaryLight,
    },
    libraryModelId: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      marginTop: 2,
    },
    libraryDownloadSize: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    libraryStats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    libraryDesc: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 4 },
    progressTrack: {
      height: 3,
      backgroundColor: colors.borderStrong,
      borderRadius: 2,
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: { height: 3, backgroundColor: colors.primary },
    downloadBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      marginTop: 2,
      flexShrink: 0,
    },
    downloadBtnActive: {},
    downloadBtnDisabled: { opacity: 0.6 },
    downloadBtnPressed: { opacity: 0.8 },
    apiFootnote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    apiFootnoteBody: { flex: 1, minWidth: 0 },
    apiFootnoteText: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 17,
    },
    loadMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryGlow,
    },
    loadMoreBtnPressed: { opacity: 0.8 },
    loadMoreBtnDisabled: { opacity: 0.5 },
    loadMoreBtnText: {
      color: colors.primaryLight,
      fontSize: 14,
      fontWeight: "600",
    },
    detailCard: {
      maxHeight: "82%",
      paddingBottom: 12,
      paddingTop: 8,
    },
    detailHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: 14,
    },
    detailHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    },
    detailHeroIcon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexShrink: 0,
    },
    detailHeroBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    detailTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 23,
    },
    detailPublisher: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 17,
    },
    detailBlurb: {
      marginTop: 10,
      padding: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    detailDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    detailSpecGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    detailSpecCell: {
      width: "47%",
      flexGrow: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 2,
    },
    detailSpecLabel: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    detailSpecValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 17,
    },
    detailCopyBlock: {
      marginTop: 12,
      gap: 4,
    },
    detailFieldLabel: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    detailCopyPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceHover,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    detailCopyPillText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    },
    detailActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    detailCloseBtn: {
      flex: 1,
    },
    detailDownloadBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
  });
}
