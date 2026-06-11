import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
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
  fetchModels,
  formatDownloadError,
  isHubUrl,
  partitionLibraryModels,
  resolveManagementApiKey,
  resolveManagementBaseUrl,
} from "../lib/api";
import { isSameModelId } from "../lib/model-id";
import { parseModelName } from "../lib/model-name";
import { libraryHasMorePages, LIBRARY_PAGE_SIZE } from "../lib/library-pagination";
import { parseLibrarySearchQuery } from "../lib/library-search";
import { resolveFileSizeLabel } from "../lib/model-size";
import { isChatSelectableLmModel } from "../lib/lmstudio-downloadable";
import { LMModel } from "../lib/types";
import { useApp } from "../lib/context";
import { RemoteLibraryEntry } from "../lib/remote-model-library";
import { fetchLmStudioArtifactDownloadCount } from "../lib/lmstudio-hub-artifact";
import {
  buildDirectDownloadEntry,
  enrichRemoteLibraryEntryFromHf,
  fetchTrendingHuggingFaceModels,
  huggingFaceRepoIdFromString,
  concatDownloadableEntries,
  prefetchRemoteLibrarySizes,
  resolveRemoteLibrarySizeLabelWithHfCache,
  searchHuggingFaceModels,
} from "../lib/huggingface-model-search";
import { looksLikeLocalGgufDownloadQuery, resolveRemoteDownloadModelString } from "../lib/model-download-string";
import {
  dedupeCatalogEntries,
  fetchLmStudioCatalogPage,
  LM_STUDIO_CATALOG_PAGE_SIZE,
} from "../lib/lmstudio-catalog";
import {
  resolveEntryCatalogSource,
  resolveInstalledRemoteCatalogSource,
} from "../lib/library-filters";
import {
  normalizeModelKey,
  resolveRemoteEntryDownloadModel,
  resolveRemoteLibraryDisplayName,
} from "../lib/remote-model-library";
import { ErrorKind, errorFromUnknown, presentError } from "../lib/errors";
import {
  getLoadedOnDeviceModelKey,
  subscribeOnDeviceModelLoaded,
  IS_EXPO_GO,
  isModelDownloaded,
  LOCAL_MODEL_CATALOG,
  LOCAL_NATIVE_BUILD_MESSAGE,
} from "../lib/local-models";
import { localModelDownloadStore } from "../lib/local-model-download-store";
import { countDownloadedLocalModels } from "../lib/local-storage-usage";
import { createModalTheme } from "../lib/modal-theme";
import DismissAffordance from "./DismissAffordance";
import SwipeDismissSheet from "./SwipeDismissSheet";
import { ThemeColors, useAccentPalette } from "../lib/theme";
import { createModalStyles, createLibraryStyles } from "./ModelLibraryModal.styles";
import { LocalModelsManager } from "./LocalModelsSection";
import CatalogDownloadProgress from "./CatalogDownloadProgress";
import { useRemoteCatalogDownloads } from "../lib/use-remote-catalog-download";
import { modalPageTopPadding } from "../lib/safe-area-layout";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import {
  LibraryActiveFilterChips,
  LibraryBrowseFilterButton,
} from "./LibraryBrowseFilters";
import { LibraryFlowSection, LibraryPlatformSubtitle } from "./LibraryModelSections";
import { PlatformDownloadStat } from "./PlatformDownloadStat";
import {
  DEFAULT_LIBRARY_BROWSE_FILTERS,
  LibraryBrowseFilters,
} from "../lib/library-filters";
import {
  filterRemoteLibraryCatalog,
  getRemoteInstalledStatItems,
  getRemoteLibraryEntryStatItems,
  LIBRARY_DOWNLOAD_PAGE_SIZE,
  LIBRARY_INSTALLED_PAGE_SIZE,
  LibraryRowSizeLabel,
  LibrarySeeMoreButton,
  sizeLabelFromStatItems,
  ModelStatItem,
  ModelStatLine,
  ModelTraitBadge,
  resolveRemoteModelTrait,
  statItemsWithoutSize,
} from "./ModelPicker";
import {
  capabilityCatalogSearchHint,
  capabilityToModalityFilter,
} from "../lib/vision-models";
import ThemedError from "./ThemedError";
import HfModelAccessDialog from "./HfModelAccessDialog";
import ThemedConfirmDialog from "./ThemedConfirmDialog";
import ModelDownloadStringField from "./ModelDownloadStringField";
import PcDownloadConsentSheet from "./PcDownloadConsentSheet";
import { huggingFaceModelPageUrl } from "../lib/huggingface-gated";
import { usePcDownloadFromPhoneConsent } from "../lib/use-pc-download-consent";
export type ModelLibraryTab = "system" | "device";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** @deprecated Unified library ignores tab — kept for callers that open from chat picker. */
  initialTab?: ModelLibraryTab;
};

function getCatalogDownloadSizeLabel(entry: RemoteLibraryEntry): string | null {
  return resolveRemoteLibrarySizeLabelWithHfCache(entry);
}

function resolveDownloadStringLabel(entry: RemoteLibraryEntry): string {
  try {
    return resolveRemoteEntryDownloadModel(entry);
  } catch {
    return entry.id;
  }
}

const LIBRARY_INSTALLED_TITLE = "Installed";
const LIBRARY_BROWSE_TITLE = "Library";
const LIBRARY_ON_MAC_LABEL = "On Mac";
const LIBRARY_ON_DEVICE_LABEL = "On device";

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
  const { settings } = useApp();
  const hfAuth = useMemo(() => ({ hfToken: settings.hfToken }), [settings.hfToken]);
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const [resolvedEntry, setResolvedEntry] = useState<RemoteLibraryEntry | null>(entry);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadRevision, setDownloadRevision] = useState(0);

  useEffect(() => {
    if (!visible || !entry) {
      setResolvedEntry(entry);
      setDetailsLoading(false);
      return;
    }

    setResolvedEntry(entry);
    let cancelled = false;
    setDetailsLoading(true);

    void Promise.all([
      enrichRemoteLibraryEntryFromHf(entry, hfAuth),
      fetchLmStudioArtifactDownloadCount(entry.id),
    ])
      .then(([enriched]) => {
        if (!cancelled) setResolvedEntry(enriched);
      })
      .finally(() => {
        if (!cancelled) {
          setDetailsLoading(false);
          setDownloadRevision((revision) => revision + 1);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, entry?.id, entry, hfAuth]);

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
                  modelId={activeEntry.id}
                  provider={activeEntry.publisher}
                  label={displayName}
                  size={28}
                  color={colors.primaryLight}
                  colorfulLogo
                  catalogSource={resolveEntryCatalogSource(activeEntry)}
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
              {trait ? <ModelTraitBadge trait={trait} muted={false} colors={colors} /> : null}
            </View>

            {stats.length > 0 ? (
              <ModelStatLine
                items={stats}
                colors={colors}
                textStyle={styles.libraryStats}
                muted
              />
            ) : null}

            <PlatformDownloadStat
              entry={activeEntry}
              colors={colors}
              textStyle={styles.libraryStats}
              loading={detailsLoading}
              cacheRevision={downloadRevision}
            />

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

function InstalledModelRow({
  model,
  catalog,
  loaded = false,
  styles,
  colors,
}: {
  model: LMModel;
  catalog: LMModel[];
  loaded?: boolean;
  styles: ReturnType<typeof createLibraryStyles>;
  colors: ThemeColors;
}) {
  const parsed = parseModelName(model.id);
  const publisher = model.publisher ?? model.owned_by ?? parsed.family;
  const catalogSource = resolveInstalledRemoteCatalogSource(model.id);
  const stats = getRemoteInstalledStatItems(model, catalog);
  const onDiskSize =
    resolveFileSizeLabel(model.size_bytes, model.id, parsed.displayName) ??
    sizeLabelFromStatItems(stats) ??
    resolveRemoteLibrarySizeLabelWithHfCache({
      id: model.id,
      name: parsed.displayName,
    });
  const loadedAccent = colors.primaryLight;

  return (
    <View style={styles.libraryRowWrap}>
      <View style={styles.libraryRow}>
        <View style={styles.libraryIcon}>
          <ModelModeBadgeIcon
            platform="pc"
            modelId={model.id}
            provider={publisher}
            label={parsed.displayName}
            size={26}
            color={loaded ? loadedAccent : colors.textMuted}
            colorfulLogo={loaded}
            catalogSource={catalogSource}
          />
        </View>
        <View style={styles.libraryBody}>
          <View style={styles.libraryTitleRow}>
            <Text
              style={[styles.libraryName, loaded && styles.libraryNameLoaded]}
              numberOfLines={1}
            >
              {parsed.displayName}
            </Text>
            {loaded ? (
              <ModelTraitBadge trait={{ label: "Loaded", color: loadedAccent }} colors={colors} />
            ) : null}
          </View>
          <ModelStatLine
            items={statItemsWithoutSize(stats)}
            colors={colors}
            textStyle={[styles.libraryStats, loaded && styles.libraryStatsLoaded]}
            muted={!loaded}
          />
        </View>
        <LibraryRowSizeLabel
          label={onDiskSize}
          colors={colors}
          style={loaded ? styles.libraryStatsLoaded : undefined}
        />
      </View>
    </View>
  );
}

function getLibraryStatItems(entry: RemoteLibraryEntry): ModelStatItem[] {
  return getRemoteLibraryEntryStatItems(entry);
}

function LibraryDownloadRow({
  entry,
  downloading,
  progress,
  downloadError,
  onPress,
  onDownload,
  onClearError,
  disabled,
  styles,
  colors,
}: {
  entry: RemoteLibraryEntry;
  downloading: boolean;
  progress: number | null;
  downloadError?: string | null;
  onPress: () => void;
  onDownload: () => void;
  onClearError?: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createLibraryStyles>;
  colors: ThemeColors;
}) {
  const displayName = resolveRemoteLibraryDisplayName(entry);
  const stats = getLibraryStatItems(entry);
  const downloadSize = getCatalogDownloadSizeLabel(entry);

  return (
    <View style={styles.libraryRowWrap}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.libraryRow, pressed && styles.libraryRowPressed]}
    >
      <View style={styles.libraryIcon}>
        <ModelModeBadgeIcon
          platform="pc"
          modelId={entry.id}
          provider={entry.publisher}
          label={displayName}
          size={26}
          color={colors.textMuted}
          colorfulLogo
          catalogSource={resolveEntryCatalogSource(entry)}
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
        <ModelStatLine
          items={statItemsWithoutSize(stats)}
          colors={colors}
          textStyle={styles.libraryStats}
          muted
        />
        {downloading ? (
          <CatalogDownloadProgress
            progress={progress}
            colors={colors}
            trackStyle={styles.progressTrack}
          />
        ) : null}
      </View>
      <LibraryRowSizeLabel label={downloadSize} colors={colors} />
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (!downloading) onDownload();
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
    </Pressable>
    {downloadError ? (
      <ThemedError
        variant="inline"
        message={downloadError}
        kind="network"
        onDismiss={onClearError ?? (() => {})}
        style={styles.libraryRowError}
      />
    ) : null}
    </View>
  );
}

function UnifiedModelLibrary({
  active,
  bottomInset,
}: {
  active: boolean;
  bottomInset: number;
}) {
  const { settings, account, isLoading: settingsLoading } = useApp();
  const hfAuth = useMemo(() => ({ hfToken: settings.hfToken }), [settings.hfToken]);
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
  const { enabled: pcDownloadsEnabled, enable: enablePcDownloads, disable: disablePcDownloads } =
    usePcDownloadFromPhoneConsent();
  const [pcConsentSheetOpen, setPcConsentSheetOpen] = useState(false);
  const [pcDisableConfirmOpen, setPcDisableConfirmOpen] = useState(false);
  const showPcDownloadOptions = pcDownloadsEnabled;
  const showApiTokenNote = !managementApiKey && !!managementUrl;

  const [installedModels, setInstalledModels] = useState<LMModel[]>([]);
  const [trendingEntries, setTrendingEntries] = useState<RemoteLibraryEntry[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<RemoteLibraryEntry[]>([]);
  const [webEntries, setWebEntries] = useState<RemoteLibraryEntry[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [trendingLmPage, setTrendingLmPage] = useState(0);
  const [trendingHasMore, setTrendingHasMore] = useState(false);
  const [hfBrowseNextUrl, setHfBrowseNextUrl] = useState<string | null>(null);
  const [hfBrowseStarted, setHfBrowseStarted] = useState(false);
  const [webNextUrl, setWebNextUrl] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailEntry, setDetailEntry] = useState<RemoteLibraryEntry | null>(null);
  const [downloadVisibleCount, setDownloadVisibleCount] = useState(LIBRARY_DOWNLOAD_PAGE_SIZE);
  const [installedVisibleCount, setInstalledVisibleCount] = useState(LIBRARY_INSTALLED_PAGE_SIZE);
  const [installedExpanded, setInstalledExpanded] = useState(false);
  const [deviceLoadedKey, setDeviceLoadedKey] = useState<string | null>(null);
  const [hfSizeRevision, setHfSizeRevision] = useState(0);
  const [browseFilters, setBrowseFilters] = useState<LibraryBrowseFilters>(
    DEFAULT_LIBRARY_BROWSE_FILTERS
  );
  const [linkDownloadOpen, setLinkDownloadOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDownloading, setLinkDownloading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkDownloadRef = useRef<(url: string) => Promise<void>>(async () => {});
  const catalogModalityFilter = useMemo(
    () => capabilityToModalityFilter(browseFilters.capability),
    [browseFilters.capability]
  );

  const effectiveCatalogSearch = useMemo(() => {
    const query = search.trim();
    if (query) return query;
    return capabilityCatalogSearchHint(browseFilters.capability);
  }, [search, browseFilters.capability]);

  const installedIds = useMemo(() => installedModels.map((model) => model.id), [installedModels]);

  const {
    downloads,
    errors: remoteDownloadErrors,
    hfAccessPrompt,
    startDownload,
    clearError: clearRemoteDownloadError,
    clearHfAccessPrompt,
    acceptHfAccessAndRetry,
    isActive: isRemoteDownloadActive,
  } = useRemoteCatalogDownloads(settings);
  const [hfAcceptLoading, setHfAcceptLoading] = useState(false);
  const catalogRequestRef = useRef(0);
  const trendingRequestRef = useRef(0);
  const webRequestRef = useRef(0);
  const hfBrowseLoadingRef = useRef(false);

  const isSearching = search.trim().length > 0;

  const curatedDownloadEntries = useMemo(
    () => filterRemoteLibraryCatalog(installedIds, search, browseFilters.capability),
    [installedIds, search, browseFilters.capability]
  );

  const directRemoteDownloadEntry = useMemo(
    () => (isSearching ? buildDirectDownloadEntry(search) : null),
    [isSearching, search]
  );

  const downloadableEntries = useMemo(() => {
    if (!showPcDownloadOptions) return [];

    if (!isSearching) {
      const curated = filterRemoteLibraryCatalog(installedIds, "");
      return concatDownloadableEntries([curated, trendingEntries]);
    }

    const searched = concatDownloadableEntries([
      curatedDownloadEntries,
      catalogEntries,
      webEntries,
    ]);
    if (directRemoteDownloadEntry) {
      return concatDownloadableEntries([[directRemoteDownloadEntry], searched]);
    }
    return searched;
  }, [
    isSearching,
    installedIds,
    trendingEntries,
    curatedDownloadEntries,
    catalogEntries,
    webEntries,
    directRemoteDownloadEntry,
    showPcDownloadOptions,
  ]);

  const downloadSectionInitialLoading =
    showPcDownloadOptions &&
    (isSearching
      ? (catalogLoading || webSearchLoading) &&
        catalogEntries.length === 0 &&
        webEntries.length === 0
      : trendingLoading && trendingEntries.length === 0);

  const downloadSectionLoadingMore = isSearching
    ? catalogLoadingMore || (webSearchLoading && webEntries.length > 0)
    : catalogLoadingMore;

  const remoteCatalogHasMore = isSearching
    ? catalogHasMore || !!webNextUrl
    : trendingHasMore ||
      !!hfBrowseNextUrl ||
      (!hfBrowseStarted && trendingEntries.length >= LIBRARY_PAGE_SIZE);

  const hasMoreDownloadable = libraryHasMorePages(
    downloadVisibleCount,
    downloadableEntries.length,
    remoteCatalogHasMore
  );

  useEffect(() => {
    if (!active || downloadableEntries.length === 0) return;
    let cancelled = false;
    const visible = downloadableEntries.slice(0, downloadVisibleCount);
    void prefetchRemoteLibrarySizes(visible, hfAuth).then(() => {
      if (!cancelled) setHfSizeRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [active, downloadableEntries, downloadVisibleCount, hfAuth]);

  const refreshInstalledModels = useCallback(async () => {
    if (!active) return;
    const listUrl = managementUrl ?? settings.baseUrl;
    try {
      const models = await fetchModels(listUrl, managementApiKey);
      setInstalledModels(models);
      setError((prev) =>
        prev?.startsWith("Can't reach LM Studio") ? null : prev
      );
    } catch (e: unknown) {
      setInstalledModels([]);
      setError(
        e instanceof Error ? e.message : "Can't reach LM Studio for installed models."
      );
    }
  }, [active, managementUrl, managementApiKey, settings.baseUrl]);

  const libraryInstalledModels = useMemo(
    () =>
      installedModels
        .filter((model) => isChatSelectableLmModel(model))
        .sort((a, b) =>
          parseModelName(a.id).displayName.localeCompare(parseModelName(b.id).displayName)
        ),
    [installedModels]
  );

  const activeRemoteModelId = settings.defaultModel?.trim() || null;
  const { loaded: remoteLoadedModels, installed: remoteInstalledModels } = useMemo(
    () =>
      partitionLibraryModels(libraryInstalledModels, {
        activeModelId: activeRemoteModelId,
        singleModelMode: settings.singleModelMode !== false,
      }),
    [libraryInstalledModels, activeRemoteModelId, settings.singleModelMode]
  );

  const remoteLoadedModel = remoteLoadedModels[0] ?? null;

  const visibleRemoteInstalledModels = useMemo(
    () => remoteInstalledModels.slice(0, installedVisibleCount),
    [remoteInstalledModels, installedVisibleCount]
  );

  const hasMoreRemoteInstalled = libraryHasMorePages(
    installedVisibleCount,
    remoteInstalledModels.length
  );

  const localDownloadRevision = useSyncExternalStore(
    localModelDownloadStore.subscribe,
    () => localModelDownloadStore.getSnapshot().revision,
    () => localModelDownloadStore.getSnapshot().revision
  );

  const hasDeviceLoaded = !IS_EXPO_GO && deviceLoadedKey != null;

  const [deviceIdleInstalledCount, setDeviceIdleInstalledCount] = useState(0);

  useEffect(() => {
    if (!active || IS_EXPO_GO) {
      setDeviceIdleInstalledCount(0);
      return;
    }
    void countDownloadedLocalModels(deviceLoadedKey).then(setDeviceIdleInstalledCount);
  }, [active, deviceLoadedKey, localDownloadRevision]);

  const showInstalledSection =
    remoteLoadedModel != null ||
    remoteInstalledModels.length > 0 ||
    hasDeviceLoaded ||
    deviceIdleInstalledCount > 0;

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
          search: effectiveCatalogSearch,
          modalityFilter: catalogModalityFilter,
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
    [managementUrl, managementApiKey, effectiveCatalogSearch, installedIds, catalogModalityFilter]
  );

  const loadTrendingPage = useCallback(
    async (page: number, reset: boolean) => {
      const requestId = ++trendingRequestRef.current;
      const pageSize = LM_STUDIO_CATALOG_PAGE_SIZE;

      if (page === 0 && reset) {
        setTrendingLoading(true);
        setTrendingEntries([]);
        setTrendingHasMore(false);
        setTrendingLmPage(0);
        setHfBrowseNextUrl(null);
        setHfBrowseStarted(false);

        try {
          const lmPage = await fetchLmStudioCatalogPage({
            managementUrl,
            apiKey: managementApiKey,
            search: effectiveCatalogSearch,
            modalityFilter: catalogModalityFilter,
            page: 0,
            pageSize,
            installedIds,
          });

          let hfPage = { entries: [] as RemoteLibraryEntry[], nextUrl: null as string | null };
          let hfError: string | null = null;
          try {
            hfPage = await fetchTrendingHuggingFaceModels({
              installedIds,
              modalityFilter: catalogModalityFilter,
              capabilityFilter: browseFilters.capability,
              limit: pageSize,
              ...hfAuth,
            });
          } catch (e: unknown) {
            hfError = e instanceof Error ? e.message : "Could not load Hugging Face models";
          }

          if (requestId !== trendingRequestRef.current) return;

          setTrendingEntries(
            dedupeCatalogEntries(concatDownloadableEntries([lmPage.entries, hfPage.entries]))
          );
          setTrendingLmPage(0);
          setTrendingHasMore(lmPage.hasMore || !!hfPage.nextUrl);
          setHfBrowseNextUrl(hfPage.nextUrl);
          setHfBrowseStarted(hfPage.entries.length > 0 || !!hfPage.nextUrl);
          setError(hfError);
        } catch (e: unknown) {
          if (requestId !== trendingRequestRef.current) return;
          setTrendingEntries([]);
          setTrendingHasMore(false);
          setHfBrowseNextUrl(null);
          setHfBrowseStarted(false);
          setError(e instanceof Error ? e.message : "Could not load model library");
        } finally {
          if (requestId === trendingRequestRef.current) {
            setTrendingLoading(false);
          }
        }
        return;
      }

      if (reset) {
        setTrendingLoading(true);
        setTrendingEntries([]);
        setTrendingHasMore(false);
        setTrendingLmPage(0);
        setHfBrowseNextUrl(null);
        setHfBrowseStarted(false);
      } else {
        setCatalogLoadingMore(true);
      }

      try {
        const lmPage = await fetchLmStudioCatalogPage({
          managementUrl,
          apiKey: managementApiKey,
          search: effectiveCatalogSearch,
          modalityFilter: catalogModalityFilter,
          page,
          pageSize,
          installedIds,
        });
        if (requestId !== trendingRequestRef.current) return;

        setTrendingEntries((prev) =>
          dedupeCatalogEntries(reset ? lmPage.entries : [...prev, ...lmPage.entries])
        );
        setTrendingLmPage(page);
        setTrendingHasMore(lmPage.hasMore);
      } catch (e: unknown) {
        if (requestId !== trendingRequestRef.current) return;
        if (reset) {
          setTrendingEntries([]);
          setTrendingHasMore(false);
        }
        setError(e instanceof Error ? e.message : "Could not load model library");
      } finally {
        if (requestId === trendingRequestRef.current) {
          setTrendingLoading(false);
          setCatalogLoadingMore(false);
        }
      }
    },
    [
      managementUrl,
      managementApiKey,
      installedIds,
      catalogModalityFilter,
      effectiveCatalogSearch,
      browseFilters.capability,
      hfAuth,
    ]
  );

  useEffect(() => {
    if (active) {
      setSearch("");
      setBrowseFilters(DEFAULT_LIBRARY_BROWSE_FILTERS);
      setDownloadVisibleCount(LIBRARY_DOWNLOAD_PAGE_SIZE);
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
      setInstalledExpanded(false);
      setDeviceLoadedKey(getLoadedOnDeviceModelKey());
      setTrendingEntries([]);
      setCatalogEntries([]);
      setWebEntries([]);
      setWebNextUrl(null);
      setHfBrowseNextUrl(null);
      setHfBrowseStarted(false);
      setTrendingLmPage(0);
      setTrendingLoading(true);
      setCatalogLoading(false);
      setWebSearchLoading(false);
      refreshInstalledModels();
    }
  }, [active, refreshInstalledModels]);

  useEffect(() => {
    if (!active) return;
    setDeviceLoadedKey(getLoadedOnDeviceModelKey());
    return subscribeOnDeviceModelLoaded((key) => setDeviceLoadedKey(key));
  }, [active]);

  useEffect(() => {
    if (active) {
      setDownloadVisibleCount(LIBRARY_DOWNLOAD_PAGE_SIZE);
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
    }
  }, [active, search, browseFilters]);

  useEffect(() => {
    if (!active || settingsLoading || !showPcDownloadOptions) {
      if (!showPcDownloadOptions) {
        setTrendingLoading(false);
        setCatalogLoading(false);
        setWebSearchLoading(false);
      }
      return;
    }
    if (search.trim()) {
      setTrendingEntries([]);
      setTrendingHasMore(false);
      setCatalogEntries([]);
      setCatalogHasMore(false);
      setCatalogLoading(true);
      const timer = setTimeout(() => {
        void loadCatalogPage(0, true);
      }, 300);
      return () => clearTimeout(timer);
    }

    setCatalogEntries([]);
    setCatalogHasMore(false);
    setWebEntries([]);
    setWebNextUrl(null);
    setWebSearchLoading(false);
    setTrendingEntries([]);
    setTrendingHasMore(false);
    setHfBrowseNextUrl(null);
    setHfBrowseStarted(false);
    setTrendingLmPage(0);
    setTrendingLoading(true);
    const timer = setTimeout(() => {
      void loadTrendingPage(0, true);
    }, 150);
    return () => clearTimeout(timer);
  }, [
    active,
    settingsLoading,
    search,
    installedIds,
    catalogModalityFilter,
    browseFilters.capability,
    effectiveCatalogSearch,
    hfAuth,
    loadCatalogPage,
    loadTrendingPage,
    showPcDownloadOptions,
  ]);

  useEffect(() => {
    if (!active || settingsLoading || !showPcDownloadOptions) return;
    const query = search.trim();
    if (looksLikeLocalGgufDownloadQuery(query)) {
      setWebEntries([]);
      setWebNextUrl(null);
      setWebSearchLoading(false);
      return;
    }
    const parsed = parseLibrarySearchQuery(query);
    if (!parsed.providerPrefix && query.length < 2) {
      setWebEntries([]);
      setWebNextUrl(null);
      setWebSearchLoading(false);
      return;
    }

    const requestId = ++webRequestRef.current;
    setWebSearchLoading(true);
    setWebNextUrl(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = await searchHuggingFaceModels(query, {
            installedIds,
            capabilityFilter: browseFilters.capability,
            limit: LM_STUDIO_CATALOG_PAGE_SIZE,
            ...hfAuth,
          });
          if (requestId !== webRequestRef.current) return;
          setWebEntries(page.entries);
          setWebNextUrl(page.nextUrl);
        } catch (e: unknown) {
          if (requestId !== webRequestRef.current) return;
          setWebEntries([]);
          setError(e instanceof Error ? e.message : "Could not search Hugging Face");
        } finally {
          if (requestId === webRequestRef.current) {
            setWebSearchLoading(false);
          }
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [active, settingsLoading, search, installedIds, browseFilters.capability, hfAuth, showPcDownloadOptions]);

  const loadHfBrowsePage = useCallback(
    async (cursor: string | null) => {
      if (hfBrowseLoadingRef.current) return;
      if (cursor == null && hfBrowseStarted) return;
      hfBrowseLoadingRef.current = true;
      setCatalogLoadingMore(true);
      try {
        const page = await fetchTrendingHuggingFaceModels({
          installedIds,
          capabilityFilter: browseFilters.capability,
          limit: LM_STUDIO_CATALOG_PAGE_SIZE,
          ...(cursor ? { nextUrl: cursor } : {}),
          ...hfAuth,
        });
        setHfBrowseStarted(true);
        setTrendingEntries((prev) =>
          dedupeCatalogEntries(concatDownloadableEntries([prev, page.entries]))
        );
        setHfBrowseNextUrl(page.nextUrl);
      } catch (e: unknown) {
        setHfBrowseStarted(true);
        setHfBrowseNextUrl(null);
        setError(e instanceof Error ? e.message : "Could not load Hugging Face models");
      } finally {
        hfBrowseLoadingRef.current = false;
        setCatalogLoadingMore(false);
      }
    },
    [hfBrowseStarted, installedIds, browseFilters.capability, catalogModalityFilter, hfAuth]
  );

  const loadMoreWebEntries = useCallback(async () => {
    if (!webNextUrl) return;
    setWebSearchLoading(true);
    try {
      const page = await searchHuggingFaceModels(search, {
        installedIds,
        capabilityFilter: browseFilters.capability,
        limit: LM_STUDIO_CATALOG_PAGE_SIZE,
        nextUrl: webNextUrl,
        ...hfAuth,
      });
      setWebEntries((prev) => dedupeCatalogEntries([...prev, ...page.entries]));
      setWebNextUrl(page.nextUrl);
    } catch {
      setWebNextUrl(null);
    } finally {
      setWebSearchLoading(false);
    }
  }, [webNextUrl, search, installedIds, browseFilters.capability, hfAuth]);

  const handleSeeMoreDownloadable = useCallback(() => {
    const nextCount = downloadVisibleCount + LIBRARY_DOWNLOAD_PAGE_SIZE;
    setDownloadVisibleCount(nextCount);
    if (nextCount <= downloadableEntries.length) return;
    if (isSearching) {
      if (catalogHasMore && !catalogLoading && !catalogLoadingMore && !webSearchLoading) {
        void loadCatalogPage(catalogPage + 1, false);
        return;
      }
      if (webNextUrl && !webSearchLoading) {
        void loadMoreWebEntries();
      }
      return;
    }
    if (trendingHasMore && !trendingLoading && !catalogLoadingMore) {
      void loadTrendingPage(trendingLmPage + 1, false);
      return;
    }
    if (!hfBrowseStarted && !catalogLoadingMore) {
      void loadHfBrowsePage(null);
      return;
    }
    if (hfBrowseNextUrl && !catalogLoadingMore) {
      void loadHfBrowsePage(hfBrowseNextUrl);
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
    webNextUrl,
    webSearchLoading,
    loadMoreWebEntries,
    trendingHasMore,
    trendingLoading,
    trendingLmPage,
    loadTrendingPage,
    hfBrowseStarted,
    hfBrowseNextUrl,
    loadHfBrowsePage,
  ]);

  const handleDownload = useCallback(
    (modelId: string, downloadSource?: RemoteLibraryEntry["downloadSource"]) => {
      if (!pcDownloadsEnabled) {
        setPcConsentSheetOpen(true);
        return;
      }
      if (!managementUrl) {
        setError(formatDownloadError(new Error("no local url"), settings));
        return;
      }
      setError(null);
      void startDownload(modelId, {
        managementUrl,
        apiKey: managementApiKey,
        downloadSource,
        onComplete: refreshInstalledModels,
      });
    },
    [
      pcDownloadsEnabled,
      managementUrl,
      managementApiKey,
      settings,
      startDownload,
      refreshInstalledModels,
    ]
  );

  const registerLinkDownload = useCallback((download: (url: string) => Promise<void>) => {
    linkDownloadRef.current = download;
  }, []);

  const submitLinkDownload = useCallback(async () => {
    const raw = linkUrl.trim();
    if (!raw || linkDownloading) return;
    setLinkError(null);
    setLinkDownloading(true);
    try {
      const preferLocal = !IS_EXPO_GO && looksLikeLocalGgufDownloadQuery(raw);
      if (preferLocal) {
        await linkDownloadRef.current(raw);
      } else if (managementUrl && pcDownloadsEnabled) {
        const modelString = resolveRemoteDownloadModelString(raw);
        const repoId = huggingFaceRepoIdFromString(raw);
        handleDownload(modelString, repoId ? "huggingface" : undefined);
      } else if (!pcDownloadsEnabled && !preferLocal) {
        setPcConsentSheetOpen(true);
      } else if (!IS_EXPO_GO) {
        await linkDownloadRef.current(raw);
      } else {
        throw new Error(
          "Connect to LM Studio to download remote models, or use a dev build to download GGUF on this device."
        );
      }
      setLinkUrl("");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      setLinkError(errorFromUnknown(e));
    } finally {
      setLinkDownloading(false);
    }
  }, [handleDownload, linkDownloading, linkUrl, managementUrl, pcDownloadsEnabled]);

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

  return (
    <View style={styles.libraryRoot}>
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

        {showInstalledSection ? (
          <LibraryFlowSection
            title={LIBRARY_INSTALLED_TITLE}
            colors={colors}
            first={!listHeader}
            collapsible
            expanded={installedExpanded}
            onToggle={() => setInstalledExpanded((value) => !value)}
          >
            {remoteLoadedModel || visibleRemoteInstalledModels.length > 0 ? (
              <LibraryPlatformSubtitle label={LIBRARY_ON_MAC_LABEL} colors={colors}>
                {remoteLoadedModel ? (
                  <InstalledModelRow
                    model={remoteLoadedModel}
                    catalog={installedModels}
                    loaded
                    styles={styles}
                    colors={colors}
                  />
                ) : null}
                {visibleRemoteInstalledModels.map((model) => (
                  <InstalledModelRow
                    key={model.id}
                    model={model}
                    catalog={installedModels}
                    styles={styles}
                    colors={colors}
                  />
                ))}
                {hasMoreRemoteInstalled ? (
                  <LibrarySeeMoreButton
                    colors={colors}
                    onPress={() =>
                      setInstalledVisibleCount((count) => count + LIBRARY_INSTALLED_PAGE_SIZE)
                    }
                  />
                ) : null}
              </LibraryPlatformSubtitle>
            ) : null}
            {hasDeviceLoaded || deviceIdleInstalledCount > 0 ? (
              <LibraryPlatformSubtitle
                label={LIBRARY_ON_DEVICE_LABEL}
                colors={colors}
                style={
                  remoteLoadedModel || visibleRemoteInstalledModels.length > 0
                    ? styles.platformGroupSpaced
                    : undefined
                }
              >
                <LocalModelsManager
                  searchQuery=""
                  libraryLayout
                  librarySection="installed"
                  hideSectionTitles
                  hideModalityFilters
                  hideLinkDownload
                  suppressFootnote
                  downloadOnly
                  blocked={IS_EXPO_GO}
                  libraryActive={active}
                />
              </LibraryPlatformSubtitle>
            ) : null}
          </LibraryFlowSection>
        ) : null}

        <LibraryFlowSection
          title={LIBRARY_BROWSE_TITLE}
          colors={colors}
          first={!showInstalledSection && !listHeader}
          contentStyle={styles.librarySectionContent}
        >
          <View style={styles.librarySearchShell}>
            <View style={styles.librarySearchRow}>
              <Ionicons name="search" size={16} color={colors.textDim} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search models, names, or text…"
                placeholderTextColor={colors.placeholder}
                style={styles.searchInput}
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              <LibraryBrowseFilterButton
                filters={browseFilters}
                onChange={setBrowseFilters}
                colors={colors}
              />
              {showPcDownloadOptions ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLinkDownloadOpen((open) => !open);
                  if (linkDownloadOpen) setLinkError(null);
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.searchActionBtn,
                  linkDownloadOpen && styles.searchActionBtnActive,
                  pressed && styles.searchActionBtnPressed,
                ]}
                accessibilityLabel={linkDownloadOpen ? "Hide download link" : "Download from link"}
                accessibilityState={{ expanded: linkDownloadOpen }}
              >
                <Ionicons
                  name="link"
                  size={18}
                  color={linkDownloadOpen ? colors.primaryLight : colors.textDim}
                />
              </Pressable>
              ) : null}
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textDim} />
                </Pressable>
              ) : null}
            </View>
            {linkDownloadOpen ? (
              <>
                <View style={styles.librarySearchDivider} />
                <View style={styles.librarySearchRow}>
                  <ModelDownloadStringField
                    variant="compact"
                    embedded
                    value={linkUrl}
                    onChangeText={(text) => {
                      setLinkUrl(text);
                      if (linkError) setLinkError(null);
                    }}
                    onDownload={() => void submitLinkDownload()}
                    placeholder="Paste model link or org/model id…"
                    colors={colors}
                    downloading={linkDownloading}
                    disabled={IS_EXPO_GO && !managementUrl}
                  />
                </View>
              </>
            ) : null}
          </View>
          {linkDownloadOpen && linkError ? (
            <Text style={styles.linkDownloadError}>{linkError}</Text>
          ) : null}
          <LibraryActiveFilterChips
            filters={browseFilters}
            onChange={setBrowseFilters}
            colors={colors}
          />
          {!showPcDownloadOptions ? (
            <Pressable
              onPress={() => setPcConsentSheetOpen(true)}
              style={({ pressed }) => [styles.pcConsentBanner, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="desktop-outline" size={20} color={colors.primaryLight} />
              <View style={styles.pcConsentBannerBody}>
                <Text style={styles.pcConsentBannerTitle}>Mac/PC downloads are off</Text>
                <Text style={styles.pcConsentBannerText}>
                  Enable to download models to your computer from this phone. On-device downloads
                  below still work. Deleting Mac/PC models must be done in LM Studio on the desktop.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Pressable>
          ) : null}
          <LocalModelsManager
            searchQuery={search}
            libraryLayout
            librarySection="discover"
            hideSectionTitles
            hideModalityFilters
            hideLinkDownload
            suppressFootnote
            downloadOnly
            blocked={IS_EXPO_GO}
            libraryActive={active}
            registerLinkDownload={registerLinkDownload}
            unifiedDiscover={{
              remoteEntries: downloadableEntries,
              browseFilters,
              groupBySource: false,
              renderRemoteRow: (entry) => (
                <LibraryDownloadRow
                  key={`${entry.id}-${hfSizeRevision}`}
                  entry={entry}
                  downloading={isRemoteDownloadActive(entry.id)}
                  progress={downloads[entry.id]?.progress ?? null}
                  downloadError={remoteDownloadErrors[entry.id] ?? null}
                  onPress={() => setDetailEntry(entry)}
                  onDownload={() => handleDownload(entry.id, entry.downloadSource)}
                  onClearError={() => clearRemoteDownloadError(entry.id)}
                  disabled={downloadsBlocked || !showPcDownloadOptions}
                  styles={styles}
                  colors={colors}
                />
              ),
              remoteSortName: resolveRemoteLibraryDisplayName,
              visibleCount: downloadVisibleCount,
              hasMoreRemote: hasMoreDownloadable,
              onSeeMoreRemote: handleSeeMoreDownloadable,
              loadingMoreRemote: downloadSectionLoadingMore,
              loading: downloadSectionInitialLoading,
            }}
          />
        </LibraryFlowSection>
        {apiTokenNote}
      </ScrollView>

      <RemoteModelDetailSheet
        entry={detailEntry}
        visible={detailEntry !== null}
        onClose={() => {
          setDetailEntry(null);
          setHfSizeRevision((revision) => revision + 1);
        }}
        onDownload={() => {
          if (!detailEntry) return;
          void handleDownload(detailEntry.id, detailEntry.downloadSource);
        }}
        downloading={detailEntry ? isRemoteDownloadActive(detailEntry.id) : false}
        downloadDisabled={downloadsBlocked || !showPcDownloadOptions}
        colors={colors}
        styles={styles}
      />

      <HfModelAccessDialog
        visible={hfAccessPrompt !== null}
        issue={hfAccessPrompt?.issue ?? null}
        acceptLoading={hfAcceptLoading}
        onAccept={
          hfAccessPrompt?.issue.kind === "acceptance_required"
            ? () => {
                setHfAcceptLoading(true);
                void acceptHfAccessAndRetry()
                  .then((result) => {
                    if (!result.ok) setError(result.message);
                  })
                  .finally(() => setHfAcceptLoading(false));
              }
            : undefined
        }
        onOpenBrowser={() => {
          if (!hfAccessPrompt) return;
          void Linking.openURL(huggingFaceModelPageUrl(hfAccessPrompt.issue.repoId));
        }}
        onCancel={clearHfAccessPrompt}
      />

      <PcDownloadConsentSheet
        visible={pcConsentSheetOpen}
        mode={pcDownloadsEnabled ? "manage" : "enable"}
        enabled={pcDownloadsEnabled}
        onEnable={() => {
          void enablePcDownloads().then(() => setPcConsentSheetOpen(false));
        }}
        onDisable={() => {
          setPcConsentSheetOpen(false);
          setPcDisableConfirmOpen(true);
        }}
        onClose={() => setPcConsentSheetOpen(false)}
      />

      <ThemedConfirmDialog
        visible={pcDisableConfirmOpen}
        title="Disable Mac/PC downloads?"
        message="Download buttons for computer models will be hidden in Model Library. Downloads already running on your Mac or PC are not stopped — cancel those in LM Studio on the desktop."
        confirmLabel="Disable"
        cancelLabel="Keep enabled"
        destructive
        onConfirm={() => {
          void disablePcDownloads();
          setPcDisableConfirmOpen(false);
        }}
        onCancel={() => setPcDisableConfirmOpen(false)}
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
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={modalStyles.sheetOverlayRoot}>
      <SwipeDismissSheet
        direction="down"
        overlayPeel
        backdropColor={colors.overlayLight}
        onDismiss={onClose}
        style={styles.sheetRoot}
      >
      <View style={[modalStyles.pageContainer, { paddingTop: modalPageTopPadding(insets.top) }]}>
        <View style={modalStyles.pageHeader}>
          <DismissAffordance kind="down" colors={colors} />
          <Text style={modalStyles.pageTitle}>Model Library</Text>
          <View style={modalStyles.pageHeaderBtn} />
        </View>

        <View style={styles.body}>
          <UnifiedModelLibrary active={visible} bottomInset={insets.bottom + 24} />
        </View>
      </View>
      </SwipeDismissSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

