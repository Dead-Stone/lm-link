import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import { useHubNavigation } from "../lib/hub-navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import ModelEjectProgressFill from "./ModelEjectProgressFill";
import ModelLoadProgressFill from "./ModelLoadProgressFill";
import ModelRowActionMute from "./ModelRowActionMute";
import {
  MODEL_ROW_ACTION_FADE_OUT_MS,
  MODEL_ROW_ACTION_MIN_MS,
} from "../lib/model-row-action";
import { useIndeterminateLoadProgress } from "../lib/use-indeterminate-load-progress";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import { AnimatedLibraryRow } from "./LibraryModelSections";
import SectionHintLines from "./SectionHintLines";
import CatalogDownloadProgress from "./CatalogDownloadProgress";
import DownloadIconCancelOverlay from "./DownloadIconCancelOverlay";
import { useLocalModelDownloads } from "../lib/use-local-model-download";
import { localModelDownloadStore } from "../lib/local-model-download-store";
import ThemedConfirmDialog from "./ThemedConfirmDialog";
import HfModelAccessDialog from "./HfModelAccessDialog";
import { huggingFaceModelPageUrl } from "../lib/huggingface-gated";
import * as Linking from "expo-linking";
import ThemedError from "./ThemedError";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import ModelProviderIcon from "./ModelProviderIcon";
import { PlatformDownloadStat } from "./PlatformDownloadStat";
import { useApp } from "../lib/context";
import { errorFromUnknown } from "../lib/errors";
import { createModalTheme } from "../lib/modal-theme";
import {
  estimateDownloadSizeFromParams,
  formatFileSize,
  resolveFileSizeLabel,
} from "../lib/model-size";
import { extractModelParamLabel, parseModelName } from "../lib/model-name";
import {
  fetchHuggingFaceModelEntry,
  getCachedHfLibrarySizeLabel,
  prefetchRemoteLibrarySizes,
} from "../lib/huggingface-model-search";
import { searchHuggingFaceLocalModels } from "../lib/huggingface-local-search";
import { fetchLmStudioArtifactDownloadCount } from "../lib/lmstudio-hub-artifact";
import { libraryHasMorePages } from "../lib/library-pagination";
import {
  libraryBrowseItemDetailScore,
  mergeStableLibraryBrowseItems,
} from "../lib/library-browse-list";
import {
  filterLibraryBrowseItems,
  groupLibraryBrowseItems,
  LibraryBrowseFilters,
  sliceGroupedBrowseItems,
} from "../lib/library-filters";
import { matchesLibrarySearch } from "../lib/library-search";
import type { RemoteLibraryEntry } from "../lib/remote-model-library";
import {
  getAllCustomLocalModelRecords,
  buildPendingLocalModelFromGgufUrl,
  registerCustomLocalModel,
  removeCustomLocalModel,
  toLocalModelInfo,
} from "../lib/custom-local-models";
import {
  resolveLocalGgufDownloadUrl,
  tryResolveLocalGgufDownloadUrl,
} from "../lib/model-download-string";
import {
  getQuickAccessLocalModels,
  IS_EXPO_GO,
  LOCAL_MODEL_CATALOG,
  LOCAL_NATIVE_BUILD_MESSAGE,
  localModelIdHaystack,
  LocalModelInfo,
  QUICK_ACCESS_LOCAL_MODEL_KEYS,
  ejectOnDeviceModel,
  getLoadedOnDeviceModelKey,
  isModelDownloaded,
  modelFile,
  modelFileSize,
} from "../lib/local-models";
import ModelDownloadStringField from "./ModelDownloadStringField";
import { ThemeColors, useAccentPalette, useTheme } from "../lib/theme";
import {
  createStorageStyles,
  createCardStyles,
  createBannerStyles,
  createLocalDetailStyles,
  createCatalogRowStyles,
  createInstalledRowStyles,
  createLocalModelsStyles,
} from "./LocalModelsSection.styles";
import {
  catalogSourceStatItem,
  getModelCapabilityStatItems,
  ModelModalityFilters,
  ModelStatItem,
  ModelStatLine,
  ModelTraitBadge,
  SPEED_STAT_ICON,
  SPEED_STAT_ICON_SIZE,
  trimModelStats,
  LIBRARY_DOWNLOAD_PAGE_SIZE,
  LIBRARY_INSTALLED_PAGE_SIZE,
  LibraryRowSizeLabel,
  LibrarySeeMoreButton,
  sizeLabelFromStatItems,
  statItemsWithoutSize,
} from "./ModelPicker";
import {
  modelMatchesCapabilityFilter,
  ModelCapabilityFilter,
} from "../lib/vision-models";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelStatus = "idle" | "checking" | "downloading" | "paused" | "ready" | "error";

interface ModelState {
  status: ModelStatus;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  speedMBs: number;
  etaSecs: number;
  error?: string;
}

type ModelStateMap = Record<string, ModelState>;

function defaultState(): ModelState {
  return { status: "checking", progress: 0, bytesWritten: 0, totalBytes: 0, speedMBs: 0, etaSecs: 0 };
}

function resolveLocalDownloadStoreKey(
  key: string,
  model: LocalModelInfo | undefined,
  catalogModels: LocalModelInfo[],
  readState: (storeKey: string) => ModelState
): string {
  const direct = readState(key);
  if (
    direct.status === "downloading" ||
    direct.status === "paused" ||
    direct.status === "error"
  ) {
    return key;
  }
  if (!model) return key;
  for (const entry of catalogModels) {
    if (entry.key === key) continue;
    if (entry.filename !== model.filename && entry.downloadUrl !== model.downloadUrl) continue;
    const alternate = readState(entry.key);
    if (
      alternate.status === "downloading" ||
      alternate.status === "paused" ||
      alternate.status === "error"
    ) {
      return entry.key;
    }
  }
  return key;
}

function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  return formatFileSize(bytes);
}

function formatETA(secs: number): string {
  if (!isFinite(secs) || secs > 86400 || secs <= 0) return "";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function filterLocalModels(
  models: LocalModelInfo[],
  query: string,
  capabilityFilter: ModelCapabilityFilter = "all"
): LocalModelInfo[] {
  return models.filter((model) => {
    if (
      !modelMatchesCapabilityFilter(
        localModelIdHaystack(model),
        capabilityFilter,
        [],
        undefined,
        model.badge
      )
    ) {
      return false;
    }
    return matchesLibrarySearch(
      [
        model.key,
        model.name,
        model.provider,
        model.description,
        model.badge,
        model.sizeLabel,
        model.ramLabel,
      ],
      query,
      { id: model.key, publisher: model.provider }
    );
  });
}

function resolveLocalModelSizeLabel(
  model: LocalModelInfo,
  options?: { useActualFileSize?: boolean }
): string | null {
  if (options?.useActualFileSize) {
    const bytes = modelFileSize(model.filename);
    if (bytes > 0) {
      const formatted = formatFileSize(bytes);
      if (formatted) return formatted;
    }
  }
  const fromLabel = resolveFileSizeLabel(
    model.sizeLabel && model.sizeLabel !== "—" ? model.sizeLabel : undefined,
    model.filename,
    model.key,
    model.name
  );
  if (fromLabel) return fromLabel;

  const param =
    extractModelParamLabel(model.name, model.filename, model.key) ??
    parseModelName(model.filename).sizeTag;
  if (!param) return null;

  const estimate = estimateDownloadSizeFromParams(param);
  return estimate ? estimate.replace(/^~\s*/, "") : null;
}

function resolveLocalCatalogDisplaySize(model: LocalModelInfo): string | null {
  return (
    resolveLocalModelSizeLabel(model) ?? getCachedHfLibrarySizeLabel(model.downloadUrl)
  );
}

export function getLocalModelStatItems(
  model: LocalModelInfo,
  options?: { useActualFileSize?: boolean }
): ModelStatItem[] {
  const paramLabel = extractModelParamLabel(model.name, model.filename, model.key);
  const sizeLabel = resolveLocalModelSizeLabel(model, options);
  const capabilityItems = getModelCapabilityStatItems(localModelIdHaystack(model), {
    badge: model.badge,
  });
  return [
    ...trimModelStats([
      ...capabilityItems,
      ...(paramLabel
        ? [{ icon: "hardware-chip-outline" as const, label: paramLabel, role: "param" as const }]
        : []),
      { icon: "hardware-chip-outline", label: model.ramLabel },
      { icon: "business-outline", label: model.provider },
      catalogSourceStatItem("huggingface"),
    ]),
    ...(sizeLabel
      ? [{ icon: "document-outline" as const, label: sizeLabel, role: "size" as const }]
      : []),
  ];
}

export function getLocalModelCardStatItems(
  model: LocalModelInfo,
  status: ModelStatus
): ModelStatItem[] {
  return getLocalModelStatItems(model, { useActualFileSize: status === "ready" });
}

function ModelStatusIcon({
  status,
  isSelected,
  colors,
}: {
  status: ModelStatus;
  isSelected?: boolean;
  colors: ThemeColors;
}) {
  if (isSelected) {
    return <Ionicons name="checkmark" size={22} color={colors.primaryLight} />;
  }
  switch (status) {
    case "ready":
      return <Ionicons name="phone-portrait-outline" size={22} color={colors.primaryLight} />;
    case "downloading":
      return <ActivityIndicator size="small" color={colors.primaryLight} />;
    case "paused":
      return <Ionicons name="pause-circle" size={22} color={colors.primaryLight} />;
    case "error":
      return <Ionicons name="alert-circle" size={22} color={colors.error} />;
    case "checking":
      return <ActivityIndicator size="small" color={colors.textDim} />;
    default:
      return <Ionicons name="cloud-download-outline" size={22} color={colors.textDim} />;
  }
}

import { computeLocalModelsUsedBytes } from "../lib/local-storage-usage";

export { computeLocalModelsUsedBytes };

// ─── Storage bar (Settings only) ─────────────────────────────────────────────

export function LocalDeviceStorageBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const { colors } = useTheme();
  const storageStyles = useMemo(() => createStorageStyles(colors), [colors]);
  const [usedBytes, setUsedBytes] = useState(0);

  useEffect(() => {
    void computeLocalModelsUsedBytes().then(setUsedBytes);
  }, [refreshKey]);

  let freeBytes = 0;
  try {
    freeBytes = Paths.availableDiskSpace;
  } catch {
    /* web / Expo Go */
  }

  const total = usedBytes + freeBytes;
  const pct = total > 0 ? Math.min((usedBytes / total) * 100, 100) : 0;

  return (
    <View style={storageStyles.container}>
      <View style={storageStyles.row}>
        <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
        <Text style={storageStyles.label}>{formatStorageBytes(usedBytes)} used by on-device models</Text>
        <Ionicons name="save-outline" size={12} color={colors.textDim} />
        <Text style={storageStyles.free}>{formatStorageBytes(freeBytes)} free on phone</Text>
      </View>
      <View style={storageStyles.track}>
        <View style={[storageStyles.fill, { width: `${pct}%` as `${number}%` }]} />
      </View>
    </View>
  );
}


// ─── Model card ───────────────────────────────────────────────────────────────

function ModelCard({
  model,
  state,
  isSelected,
  onDownload,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onSelect,
  onChat,
  onClearError,
}: {
  model: LocalModelInfo;
  state: ModelState;
  isSelected?: boolean;
  onDownload: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  onChat?: () => void;
  onClearError: () => void;
}) {
  const colors = useAccentPalette();
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const isReady = state.status === "ready";
  const isPaused = state.status === "paused";
  const isDownloading = state.status === "downloading";
  const transferActive = isDownloading || isPaused;
  const isError = state.status === "error";

  const card = (
    <View style={[
      cardStyles.container,
      isReady && cardStyles.containerReady,
      isSelected && cardStyles.containerSelected,
    ]}>
      <View style={cardStyles.topRow}>
        <View style={cardStyles.modelIcon}>
          <ModelModeBadgeIcon
            platform="phone"
            modelId={model.downloadUrl}
            provider={model.provider}
            label={model.name}
            size={28}
            color={isSelected ? colors.primaryLight : colors.textMuted}
            catalogSource="huggingface"
          />
        </View>

        <View style={cardStyles.topBody}>
          <View style={cardStyles.nameRow}>
            <Text
              style={[cardStyles.name, isSelected && { color: colors.primaryLight }]}
              numberOfLines={isSelected ? 2 : 1}
            >
              {model.name}
            </Text>
            <ModelTraitBadge
              trait={{ label: model.badge, color: model.badgeColor }}
              muted={!isSelected}
              colors={colors}
            />
          </View>
          <Text style={cardStyles.desc}>{model.description}</Text>
          <ModelStatLine
            items={getLocalModelCardStatItems(model, state.status)}
            colors={colors}
            textStyle={cardStyles.detailStats}
            muted={!isSelected}
          />
        </View>

        <ModelStatusIcon status={state.status} isSelected={isSelected} colors={colors} />
      </View>

      {transferActive && (
        <View style={cardStyles.progressWrap}>
          <View style={cardStyles.progressHeader}>
            <Ionicons
              name={isPaused ? "pause-circle-outline" : "cloud-download-outline"}
              size={14}
              color={colors.primaryLight}
            />
            <Text style={cardStyles.progressTitle}>
              {isPaused ? "Download paused" : "Downloading model"}
            </Text>
            <Text style={cardStyles.progressPct}>{Math.round(state.progress * 100)}%</Text>
          </View>
          <View style={cardStyles.track}>
            <View style={[cardStyles.fill, { width: `${Math.round(state.progress * 100)}%` as `${number}%` }]} />
          </View>
          <View style={cardStyles.progressMeta}>
            <View style={cardStyles.progressMetaItem}>
              <Ionicons name="archive-outline" size={12} color={colors.textDim} />
              <Text style={cardStyles.progressBytes}>
                {formatStorageBytes(state.bytesWritten)} / {formatStorageBytes(state.totalBytes)}
              </Text>
            </View>
            {state.speedMBs > 0 ? (
              <View style={cardStyles.progressMetaItem}>
                <Ionicons name={SPEED_STAT_ICON} size={SPEED_STAT_ICON_SIZE} color={colors.textMuted} />
                <Text style={cardStyles.progressSpeed}>{state.speedMBs.toFixed(1)} MB/s</Text>
              </View>
            ) : null}
            {state.etaSecs > 0 ? (
              <View style={cardStyles.progressMetaItem}>
                <Ionicons name="time-outline" size={12} color={colors.textDim} />
                <Text style={cardStyles.progressSpeed}>{formatETA(state.etaSecs)} left</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Error */}
      <ThemedError
        variant="inline"
        message={isError ? state.error ?? null : null}
        kind="local"
        onDismiss={onClearError}
      />

      {/* Actions */}
      <View style={cardStyles.actions}>
        {(state.status === "idle" || isError) && (
          <Pressable
            style={[cardStyles.btn, cardStyles.btnPrimary, IS_EXPO_GO && cardStyles.btnDisabled]}
            onPress={IS_EXPO_GO ? undefined : onDownload}
          >
            <Ionicons name="arrow-down-circle-outline" size={16} color={IS_EXPO_GO ? colors.textDim : "#fff"} />
            <Text style={[cardStyles.btnText, IS_EXPO_GO && { color: colors.textDim }]}>
              {IS_EXPO_GO ? "Requires Dev Build" : `Download ${model.sizeLabel}`}
            </Text>
          </Pressable>
        )}

        {transferActive && (
          <View style={cardStyles.transferActions}>
            <Pressable
              style={[cardStyles.btn, cardStyles.btnSecondary, { flex: 1 }]}
              onPress={isPaused ? onResume : onPause}
            >
              <Ionicons
                name={isPaused ? "play-circle-outline" : "pause-circle-outline"}
                size={16}
                color={colors.primaryLight}
              />
              <Text style={cardStyles.btnTextSecondary}>
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
            <Pressable style={[cardStyles.btn, cardStyles.btnDanger, { flex: 1 }]} onPress={onCancel}>
              <Ionicons name="close-circle-outline" size={16} color={colors.error} />
              <Text style={cardStyles.btnTextDanger}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {isReady && (
          <View style={cardStyles.readyRow}>
            {onSelect && (
              <Pressable style={[cardStyles.btn, cardStyles.btnChat, { flex: 1 }]} onPress={onSelect}>
                <Ionicons name="phone-portrait-outline" size={15} color="#fff" />
                <Text style={cardStyles.btnText}>Use model</Text>
              </Pressable>
            )}
            {onChat && (
              <Pressable style={[cardStyles.btn, cardStyles.btnChat, { flex: 1 }]} onPress={onChat}>
                <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                <Text style={cardStyles.btnText}>Chat now</Text>
              </Pressable>
            )}
            <Pressable style={[cardStyles.btn, cardStyles.btnDangerIcon]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  if (isReady) {
    return (
      <SwipeToDeleteRow onDelete={onDelete} backgroundColor={colors.bg}>
        {card}
      </SwipeToDeleteRow>
    );
  }

  return card;
}


// ─── Dev-build banner ─────────────────────────────────────────────────────────

function DevBuildBanner() {
  const { colors } = useTheme();
  const bannerStyles = useMemo(() => createBannerStyles(colors), [colors]);
  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name="construct-outline" size={22} color="#f59e0b" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bannerStyles.title}>Native Build Required</Text>
        <Text style={bannerStyles.body}>
          On-device inference uses llama.cpp native modules not available in Expo Go.
          Build with EAS or run locally:
        </Text>
        <View style={bannerStyles.codeRow}>
          <Text style={bannerStyles.code}>eas build --platform android --profile preview</Text>
        </View>
        <Text style={bannerStyles.body}>or for local development:</Text>
        <View style={bannerStyles.codeRow}>
          <Text style={bannerStyles.code}>npx expo run:android</Text>
        </View>
      </View>
    </View>
  );
}


// ─── Compact downloaded row (unified library) ───────────────────────────────

function LocalDownloadedLibraryRow({
  model,
  onPress,
  onDelete,
  loaded = false,
  colorfulLogo = false,
  rowStyles,
  colors,
}: {
  model: LocalModelInfo;
  onPress: () => void;
  onDelete?: () => void;
  loaded?: boolean;
  colorfulLogo?: boolean;
  rowStyles: ReturnType<typeof createInstalledRowStyles>;
  colors: ThemeColors;
}) {
  const stats = getLocalModelStatItems(model, { useActualFileSize: true });
  const sizeLabel =
    resolveLocalModelSizeLabel(model, { useActualFileSize: true }) ??
    sizeLabelFromStatItems(stats);
  const loadedAccent = colors.primaryLight;

  const row = (
    <View style={rowStyles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [rowStyles.row, rowStyles.rowBrowse, pressed && rowStyles.rowPressed]}
      >
      <View style={rowStyles.icon}>
        <ModelModeBadgeIcon
          platform="phone"
          modelId={model.downloadUrl}
          provider={model.provider}
          label={model.name}
          size={26}
          color={loaded ? loadedAccent : colors.textMuted}
          colorfulLogo={loaded || colorfulLogo}
          catalogSource="huggingface"
        />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.titleRow}>
          <Text
            style={[rowStyles.name, loaded && rowStyles.nameSelected]}
            numberOfLines={1}
          >
            {model.name}
          </Text>
          {loaded ? (
            <ModelTraitBadge
              trait={{ label: "Loaded", color: loadedAccent }}
              colors={colors}
            />
          ) : (
            <ModelTraitBadge
              trait={{ label: model.badge, color: model.badgeColor }}
              muted
              colors={colors}
            />
          )}
        </View>
        <ModelStatLine
          items={statItemsWithoutSize(stats)}
          colors={colors}
          textStyle={[rowStyles.stats, loaded && rowStyles.statsSelected]}
          muted={!loaded}
        />
      </View>
      <LibraryRowSizeLabel
        label={sizeLabel}
        colors={colors}
        style={loaded ? rowStyles.statsSelected : undefined}
      />
      </Pressable>
    </View>
  );

  if (!onDelete) return row;

  return (
    <SwipeToDeleteRow onDelete={onDelete} backgroundColor={colors.bgElevated}>
      {row}
    </SwipeToDeleteRow>
  );
}

// ─── Compact catalog row (library layout) ─────────────────────────────────────

function formatLocalDownloadError(err: unknown): string {
  const raw = errorFromUnknown(
    err,
    "Download didn't finish. Check your connection and try again."
  );
  if (/network|fetch|timeout|offline/i.test(raw)) {
    return "Couldn't reach the download server. Check your internet connection and try again.";
  }
  if (/storage|space|disk|enospc/i.test(raw)) {
    return "Not enough free storage on this device. Free up space, then try again.";
  }
  return raw;
}

function LocalModelDetailSheet({
  model,
  visible,
  onClose,
  onDownload,
  onDelete,
  downloading,
  deleting,
  installed,
  disabled,
  colors,
  hfToken,
}: {
  model: LocalModelInfo | null;
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  downloading?: boolean;
  deleting?: boolean;
  installed?: boolean;
  disabled?: boolean;
  colors: ThemeColors;
  hfToken?: string;
}) {
  const hfAuth = useMemo(() => ({ hfToken }), [hfToken]);
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const detailStyles = useMemo(() => createLocalDetailStyles(colors), [colors]);
  const stats = model ? getLocalModelStatItems(model) : [];
  const [hfDescription, setHfDescription] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadRevision, setDownloadRevision] = useState(0);

  useEffect(() => {
    if (!visible || !model) {
      setHfDescription(null);
      setDetailsLoading(false);
      return;
    }

    setHfDescription(null);
    let cancelled = false;
    setDetailsLoading(true);

    void Promise.all([
      fetchHuggingFaceModelEntry(model.downloadUrl, hfAuth),
      fetchLmStudioArtifactDownloadCount(model.downloadUrl),
    ])
      .then(([entry]) => {
        if (!cancelled) setHfDescription(entry?.description ?? null);
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
  }, [visible, model?.key, model?.downloadUrl, hfAuth]);

  const copyString = async (value: string) => {
    await Clipboard.setStringAsync(value);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!model) return null;

  const description = hfDescription ?? model.description;
  const downloadEntry = {
    id: model.downloadUrl,
    description: hfDescription ?? undefined,
    publisher: model.provider,
    badgeColor: model.badgeColor,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={[modalStyles.card, detailStyles.card]} onPress={(e) => e.stopPropagation()}>
          <View style={detailStyles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={detailStyles.header}>
              <View style={detailStyles.icon}>
                <ModelModeBadgeIcon
                  platform="phone"
                  modelId={model.downloadUrl}
                  provider={model.provider}
                  label={model.name}
                  size={24}
                  color={colors.primaryLight}
                  colorfulLogo
                  catalogSource="huggingface"
                />
              </View>
              <View style={detailStyles.headerBody}>
                <Text style={detailStyles.title}>{model.name}</Text>
                <Text style={detailStyles.publisher}>{model.provider}</Text>
              </View>
              <ModelTraitBadge
                trait={{ label: model.badge, color: model.badgeColor }}
                muted={false}
                colors={colors}
              />
            </View>

            <ModelStatLine items={stats} colors={colors} textStyle={detailStyles.stats} muted />
            <PlatformDownloadStat
              entry={downloadEntry}
              colors={colors}
              textStyle={detailStyles.stats}
              loading={detailsLoading}
              cacheRevision={downloadRevision}
            />
            {detailsLoading ? (
              <View style={detailStyles.descriptionWrap}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[detailStyles.description, { marginTop: 8 }]}>
                  Loading Hugging Face details…
                </Text>
              </View>
            ) : description ? (
              <View style={detailStyles.descriptionWrap}>
                <Text style={detailStyles.description}>{description}</Text>
              </View>
            ) : null}

            <View style={detailStyles.fields}>
              <LocalDetailField label="Provider" value={model.provider} colors={colors} styles={detailStyles} />
              <LocalDetailField label="Catalog key" value={model.key} mono colors={colors} styles={detailStyles} />
              <LocalDetailField
                label="Filename"
                value={model.filename}
                mono
                copyable
                onCopy={() => void copyString(model.filename)}
                colors={colors}
                styles={detailStyles}
              />
              <LocalDetailField
                label="Download URL"
                value={model.downloadUrl}
                mono
                copyable
                onCopy={() => void copyString(model.downloadUrl)}
                colors={colors}
                styles={detailStyles}
              />
            </View>
          </ScrollView>

          <View style={detailStyles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [modalStyles.secondaryBtn, pressed && { opacity: 0.72 }]}
            >
              <Text style={modalStyles.secondaryBtnText}>Close</Text>
            </Pressable>
            {installed && onDelete ? (
              <Pressable
                onPress={onDelete}
                disabled={deleting || disabled}
                style={({ pressed }) => [
                  modalStyles.destructiveBtn,
                  (deleting || disabled) && { opacity: 0.55 },
                  pressed && !deleting && !disabled && { opacity: 0.88 },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={modalStyles.destructiveBtnText}>Delete</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={onDownload}
                disabled={downloading || disabled}
                style={({ pressed }) => [
                  modalStyles.primaryBtn,
                  (downloading || disabled) && { opacity: 0.55 },
                  pressed && !downloading && !disabled && { opacity: 0.88 },
                ]}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={colors.primaryLight} />
                ) : (
                  <Text style={modalStyles.primaryBtnText}>Download</Text>
                )}
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LocalDetailField({
  label,
  value,
  mono,
  copyable,
  onCopy,
  colors,
  styles,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createLocalDetailStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text
          style={[styles.fieldValue, mono && styles.fieldMono]}
          selectable
          numberOfLines={mono ? 8 : 2}
        >
          {value}
        </Text>
        {copyable && onCopy ? (
          <Pressable onPress={onCopy} hitSlop={8} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={16} color={colors.primaryLight} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}


function LocalCatalogRow({
  model,
  state,
  onPress,
  onDownload,
  onPause,
  onResume,
  onCancel,
  onClearError,
  disabled,
  colorfulLogo = false,
  rowStyles,
  colors,
}: {
  model: LocalModelInfo;
  state: ModelState;
  onPress?: () => void;
  onDownload: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onClearError?: () => void;
  disabled?: boolean;
  colorfulLogo?: boolean;
  rowStyles: ReturnType<typeof createCatalogRowStyles>;
  colors: ThemeColors;
}) {
  const stats = getLocalModelStatItems(model);
  const sizeLabel = resolveLocalCatalogDisplaySize(model) ?? sizeLabelFromStatItems(stats);
  const paused = state.status === "paused";
  const downloading = state.status === "downloading";
  const transferActive = downloading || paused;
  const hasError = state.status === "error" && !!state.error;

  return (
    <View style={rowStyles.rowWrap}>
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        rowStyles.row,
        onPress && rowStyles.rowBrowse,
        onPress && pressed && rowStyles.rowPressed,
      ]}
    >
      <View style={rowStyles.icon}>
        <ModelModeBadgeIcon
          platform="phone"
          modelId={model.downloadUrl}
          provider={model.provider}
          label={model.name}
          size={26}
          color={colors.textDim}
          colorfulLogo={colorfulLogo}
          catalogSource="huggingface"
        />
        {transferActive && onCancel ? (
          <DownloadIconCancelOverlay onPress={onCancel} />
        ) : null}
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.titleRow}>
          <Text style={rowStyles.name} numberOfLines={1}>
            {model.name}
          </Text>
          <ModelTraitBadge
            trait={{ label: model.badge, color: model.badgeColor }}
            muted
            colors={colors}
          />
        </View>
        <ModelStatLine
          items={statItemsWithoutSize(stats)}
          colors={colors}
          textStyle={rowStyles.stats}
          muted
        />
        {transferActive ? (
          <CatalogDownloadProgress
            progress={state.progress}
            colors={colors}
            trackStyle={rowStyles.progressTrack}
          />
        ) : null}
      </View>
      <LibraryRowSizeLabel label={sizeLabel} colors={colors} />
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (paused) {
            onResume?.();
            return;
          }
          if (downloading) {
            onPause?.();
            return;
          }
          onDownload();
        }}
        disabled={disabled}
        style={({ pressed }) => [
          rowStyles.downloadBtn,
          transferActive && rowStyles.downloadBtnActive,
          disabled && rowStyles.downloadBtnDisabled,
          pressed && !disabled && rowStyles.downloadBtnPressed,
        ]}
      >
        {paused ? (
          <Ionicons name="play" size={16} color={colors.primaryLight} />
        ) : downloading ? (
          <Ionicons name="pause" size={16} color={colors.primaryLight} />
        ) : (
          <Ionicons name="cloud-download-outline" size={18} color={colors.primaryLight} />
        )}
      </Pressable>
    </Pressable>
    {hasError ? (
      <ThemedError
        variant="inline"
        message={state.error ?? null}
        kind="local"
        onDismiss={onClearError ?? (() => {})}
        style={rowStyles.rowError}
      />
    ) : null}
    </View>
  );
}


// ─── Compact installed row (library layout) ───────────────────────────────────

function LocalInstalledRow({
  model,
  isSelected,
  isLoadedInMemory = false,
  onSelect,
  onClearSelection,
  onDelete,
  ejecting = false,
  loading = false,
  browseOnly = false,
  colorfulLogo = false,
  rowStyles,
  colors,
}: {
  model: LocalModelInfo;
  isSelected?: boolean;
  isLoadedInMemory?: boolean;
  ejecting?: boolean;
  loading?: boolean;
  onSelect?: () => void;
  onClearSelection?: () => void;
  onDelete?: () => void;
  browseOnly?: boolean;
  colorfulLogo?: boolean;
  rowStyles: ReturnType<typeof createInstalledRowStyles>;
  colors: ThemeColors;
}) {
  const stats = getLocalModelStatItems(model, { useActualFileSize: true });
  const actionActive = !!(loading || ejecting);
  const loadProgress = useIndeterminateLoadProgress(loading);

  const row = (
    <View style={rowStyles.wrap}>
      <View style={[rowStyles.row, isSelected && rowStyles.rowSelected]}>
        {ejecting ? <ModelEjectProgressFill active /> : null}
        {loading ? <ModelLoadProgressFill progress={loadProgress} colors={colors} /> : null}
        <ModelRowActionMute
          active={actionActive}
          mode={ejecting ? "eject" : "load"}
          progress={loadProgress}
          style={rowStyles.rowMuteWrap}
        >
          <View style={rowStyles.icon}>
            <ModelModeBadgeIcon
              platform="phone"
              modelId={model.downloadUrl}
              provider={model.provider}
              label={model.name}
              size={26}
              color={isSelected ? colors.primaryLight : colors.textDim}
              colorfulLogo={colorfulLogo}
              catalogSource="huggingface"
            />
          </View>
          <Pressable
            style={rowStyles.body}
            onPress={onSelect}
            disabled={!onSelect || actionActive}
          >
            <View style={rowStyles.titleRow}>
              <Text
                style={[rowStyles.name, isSelected && rowStyles.nameSelected]}
                numberOfLines={isSelected ? 2 : 1}
              >
                {model.name}
              </Text>
              <ModelTraitBadge
                trait={{ label: model.badge, color: model.badgeColor }}
                muted={!isSelected}
                colors={colors}
              />
            </View>
            <ModelStatLine
              items={stats}
              colors={colors}
              textStyle={rowStyles.stats}
              muted={!isSelected}
            />
          </Pressable>
        </ModelRowActionMute>
      </View>
    </View>
  );

  if (browseOnly && !onDelete) {
    return row;
  }

  return (
    <SwipeToDeleteRow
      onLoad={!browseOnly && !isLoadedInMemory && onSelect ? onSelect : undefined}
      onEject={!browseOnly && (isLoadedInMemory || isSelected) ? onClearSelection : undefined}
      onDelete={onDelete}
      ejectDisabled={ejecting || loading}
      loadDisabled={loading}
      backgroundColor={colors.bgElevated}
    >
      {row}
    </SwipeToDeleteRow>
  );
}


// ─── Model manager (modal content) ────────────────────────────────────────────

export type UnifiedDiscoverConfig = {
  remoteEntries: RemoteLibraryEntry[];
  renderRemoteRow: (entry: RemoteLibraryEntry) => React.ReactNode;
  remoteSortName: (entry: RemoteLibraryEntry) => string;
  /** Parent-owned visible row count for stable pagination. */
  visibleCount?: number;
  hasMoreRemote?: boolean;
  onSeeMoreRemote?: () => void;
  loadingMoreRemote?: boolean;
  loading?: boolean;
  moreDiscoverTitle?: string;
  browseFilters?: LibraryBrowseFilters;
  /** LM Studio → Hugging Face → phone section headers in browse. */
  groupBySource?: boolean;
};

export function LocalModelsManager({
  selectedKey,
  onSelect,
  showChatAction = false,
  monochromeIcons = false,
  searchQuery = "",
  modalityFilter: controlledModalityFilter,
  onModalityFilterChange,
  hideModalityFilters = false,
  hideLinkDownload = false,
  libraryLayout = false,
  browseOnly = false,
  downloadOnly = false,
  librarySection = "all",
  hideSectionTitles = false,
  suppressFootnote = false,
  blocked = false,
  showQuickDownloadLocal = false,
  unifiedDiscover,
  libraryActive = true,
  registerLinkDownload,
}: {
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  showChatAction?: boolean;
  monochromeIcons?: boolean;
  searchQuery?: string;
  modalityFilter?: ModelCapabilityFilter;
  onModalityFilterChange?: (filter: ModelCapabilityFilter) => void;
  hideModalityFilters?: boolean;
  /** Hide paste-link download field (Model Library uses a single search bar). */
  hideLinkDownload?: boolean;
  /** Installed rows + download cards, matching the System library tab. */
  libraryLayout?: boolean;
  /** View and download only — no load/eject swipes. */
  browseOnly?: boolean;
  /** Download catalog only — hide installed/loaded rows (Model Library). */
  downloadOnly?: boolean;
  /** Render only downloaded or discover rows in unified library. */
  librarySection?: "all" | "downloaded" | "installed" | "loaded" | "discover";
  hideSectionTitles?: boolean;
  suppressFootnote?: boolean;
  /** Downloads and selection disabled (e.g. Expo Go) — list still visible. */
  blocked?: boolean;
  /** Model library: pinned on-device quick picks above the merged discover list. */
  showQuickDownloadLocal?: boolean;
  /** Merge Mac/PC catalog rows with on-device discover rows in one list. */
  unifiedDiscover?: UnifiedDiscoverConfig;
  /** Model library modal visibility — resets browse ordering when reopened. */
  libraryActive?: boolean;
  /** Expose on-device GGUF download from an external link field (Model Library header). */
  registerLinkDownload?: (download: (url: string) => Promise<void>) => void;
}) {
  const router = useRouter();
  const { settings } = useApp();
  const hfAuth = useMemo(() => ({ hfToken: settings.hfToken }), [settings.hfToken]);
  const colors = useAccentPalette();
  const styles = useMemo(() => createLocalModelsStyles(colors), [colors]);
  const installedRowStyles = useMemo(() => createInstalledRowStyles(colors), [colors]);
  const catalogRowStyles = useMemo(() => createCatalogRowStyles(colors), [colors]);

  const [states, setStates] = useState<ModelStateMap>(() =>
    Object.fromEntries(LOCAL_MODEL_CATALOG.map((m) => [m.key, defaultState()]))
  );
  const [deleteTarget, setDeleteTarget] = useState<LocalModelInfo | null>(null);
  const [ejectingKey, setEjectingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [internalModalityFilter, setInternalModalityFilter] =
    useState<ModelCapabilityFilter>("all");
  const [installedVisibleCount, setInstalledVisibleCount] = useState(LIBRARY_INSTALLED_PAGE_SIZE);
  const [downloadVisibleCount, setDownloadVisibleCount] = useState(LIBRARY_DOWNLOAD_PAGE_SIZE);
  const [detailModel, setDetailModel] = useState<LocalModelInfo | null>(null);
  const [hfSizeRevision, setHfSizeRevision] = useState(0);
  const [customUrl, setCustomUrl] = useState("");
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [customDownloading, setCustomDownloading] = useState(false);
  const [customModels, setCustomModels] = useState<LocalModelInfo[]>([]);
  const modalityFilter = controlledModalityFilter ?? internalModalityFilter;
  const setModalityFilter = onModalityFilterChange ?? setInternalModalityFilter;
  const effectiveCapabilityFilter =
    unifiedDiscover?.browseFilters?.capability ?? modalityFilter;
  const discoverVisibleCount = unifiedDiscover?.visibleCount ?? downloadVisibleCount;
  const discoverOrderResetKey = `${searchQuery}\0${effectiveCapabilityFilter}\0${libraryActive ? "1" : "0"}`;
  const discoverOrderResetRef = useRef(discoverOrderResetKey);
  const discoverStableOrderRef = useRef<string[]>([]);
  if (discoverOrderResetRef.current !== discoverOrderResetKey) {
    discoverOrderResetRef.current = discoverOrderResetKey;
    discoverStableOrderRef.current = [];
  }

  function patchState(key: string, patch: Partial<ModelState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const refreshStatus = useCallback(() => {
    for (const model of LOCAL_MODEL_CATALOG) {
      if (localModelDownloadStore.isActive(model.key)) continue;
      const exists = model.filename ? isModelDownloaded(model.filename) : false;

      if (exists) {
        patchState(model.key, { status: "ready" });
      } else {
        setStates((prev) => {
          const cur = prev[model.key];
          if (cur.status === "checking") {
            return { ...prev, [model.key]: { ...cur, status: "idle" } };
          }
          return prev;
        });
      }
    }
  }, []);

  const refreshCustomModels = useCallback(async () => {
    const records = await getAllCustomLocalModelRecords();
    const models = records.map(toLocalModelInfo);
    setCustomModels(models);
    for (const record of records) {
      if (isModelDownloaded(record.filename)) {
        patchState(record.key, { status: "ready" });
      }
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    void refreshCustomModels();
  }, [refreshStatus, refreshCustomModels]);

  const catalogModels = useMemo(() => {
    const builtInKeys = new Set(LOCAL_MODEL_CATALOG.map((model) => model.key));
    const extras = customModels.filter((model) => !builtInKeys.has(model.key));
    return [...LOCAL_MODEL_CATALOG, ...extras];
  }, [customModels]);

  const {
    getState: getDownloadState,
    handleDownload,
    handlePause,
    handleResume,
    handleCancel,
    clearError: clearDownloadError,
    hfAccessPrompt,
    clearHfAccessPrompt,
    acceptHfAccessAndRetry,
    revision: downloadRevision,
  } = useLocalModelDownloads(catalogModels, {
    blocked,
    active: libraryActive,
    hfToken: settings.hfToken,
  });
  const [hfAcceptLoading, setHfAcceptLoading] = useState(false);

  const displayState = useCallback(
    (key: string): ModelState => {
      const model = catalogModels.find((entry) => entry.key === key);
      const storeKey = resolveLocalDownloadStoreKey(key, model, catalogModels, getDownloadState);
      const fromStore = getDownloadState(storeKey);
      const transferActive =
        fromStore.status === "downloading" || fromStore.status === "paused";
      const onDisk =
        !!model?.filename &&
        !transferActive &&
        isModelDownloaded(model.filename);

      if (onDisk) {
        return {
          ...(fromStore.status === "ready" ? fromStore : states[storeKey] ?? fromStore),
          status: "ready",
          progress: 1,
          error: undefined,
        };
      }
      if (transferActive || fromStore.status === "error") {
        return fromStore;
      }
      return fromStore;
    },
    [getDownloadState, states, catalogModels, downloadRevision]
  );

  const handleCustomUrlDownload = useCallback(async () => {
    if (IS_EXPO_GO || blocked) return;
    setCustomUrlError(null);
    try {
      const url = resolveLocalGgufDownloadUrl(customUrl);
      setCustomDownloading(true);
      const record = await registerCustomLocalModel(url);
      const model = toLocalModelInfo(record);
      setCustomModels((prev) => {
        if (prev.some((item) => item.key === model.key)) return prev;
        return [...prev, model];
      });
      handleDownload(model);
      setCustomUrl("");
    } catch (e) {
      setCustomUrlError(errorFromUnknown(e));
    } finally {
      setCustomDownloading(false);
      void refreshCustomModels();
    }
  }, [blocked, customUrl, handleDownload, refreshCustomModels]);

  const downloadFromLink = useCallback(
    async (raw: string) => {
      if (IS_EXPO_GO || blocked) {
        throw new Error(LOCAL_NATIVE_BUILD_MESSAGE);
      }
      const url = resolveLocalGgufDownloadUrl(raw);
      const record = await registerCustomLocalModel(url);
      const model = toLocalModelInfo(record);
      setCustomModels((prev) => {
        if (prev.some((item) => item.key === model.key)) return prev;
        return [...prev, model];
      });
      handleDownload(model);
      void refreshCustomModels();
    },
    [blocked, handleDownload, refreshCustomModels]
  );

  useEffect(() => {
    registerLinkDownload?.(downloadFromLink);
  }, [registerLinkDownload, downloadFromLink]);

  useEffect(() => {
    if (downloadRevision > 0) {
      refreshStatus();
      void refreshCustomModels();
    }
  }, [downloadRevision, refreshStatus, refreshCustomModels]);

  const performLoad = useCallback(
    async (model: LocalModelInfo) => {
      setLoadingKey(model.key);
      const started = Date.now();
      try {
        await Promise.resolve(onSelect?.(model.key));
      } finally {
        const remaining = MODEL_ROW_ACTION_MIN_MS - (Date.now() - started);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setLoadingKey(null);
      }
    },
    [onSelect]
  );

  const performEject = useCallback(
    async (model: LocalModelInfo) => {
      setEjectingKey(model.key);
      try {
        await Promise.all([
          ejectOnDeviceModel(model.key),
          new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
        ]);
        if (selectedKey === model.key) {
          await Promise.resolve(onSelect?.(null));
        }
      } finally {
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setEjectingKey(null);
      }
    },
    [selectedKey, onSelect]
  );

  const handleDelete = useCallback((model: LocalModelInfo) => {
    setDeleteTarget(model);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const model = deleteTarget;
    setDeleteTarget(null);
    if (getLoadedOnDeviceModelKey() === model.key) {
      await ejectOnDeviceModel(model.key);
    }
    if (selectedKey === model.key) {
      await Promise.resolve(onSelect?.(null));
    }
    await localModelDownloadStore.removeInstalled(model);
    if (model.key.startsWith("custom:")) {
      void removeCustomLocalModel(model.filename);
      setCustomModels((prev) => prev.filter((entry) => entry.key !== model.key));
    }
    patchState(model.key, { status: "idle", progress: 0, bytesWritten: 0, totalBytes: 0 });
    refreshStatus();
    setDetailModel((current) => (current?.key === model.key ? null : current));
  }, [deleteTarget, refreshStatus, selectedKey, onSelect]);

  const { openChat } = useHubNavigation();
  const handleChat = useCallback(
    (model: LocalModelInfo) => {
      openChat();
      router.replace(`/chat/new?localModel=${model.key}` as `/chat/${string}`);
    },
    [openChat, router]
  );

  const readyCount = catalogModels.filter(
    (model) => displayState(model.key).status === "ready"
  ).length;

  const filteredCatalog = useMemo(
    () => filterLocalModels(catalogModels, searchQuery, effectiveCapabilityFilter),
    [catalogModels, searchQuery, effectiveCapabilityFilter]
  );

  const [hfSearchModels, setHfSearchModels] = useState<LocalModelInfo[]>([]);
  const [hfSearchLoading, setHfSearchLoading] = useState(false);
  const [hfSearchError, setHfSearchError] = useState<string | null>(null);
  const hfSearchRequestRef = useRef(0);

  useEffect(() => {
    if (blocked || IS_EXPO_GO || !libraryActive) {
      setHfSearchModels([]);
      setHfSearchLoading(false);
      return;
    }
    const query = searchQuery.trim();
    const discoverMode = librarySection === "discover" || librarySection === "all";
    if (!discoverMode || query.length < 2 || tryResolveLocalGgufDownloadUrl(query)) {
      setHfSearchModels([]);
      setHfSearchLoading(false);
      setHfSearchError(null);
      return;
    }

    const requestId = ++hfSearchRequestRef.current;
    setHfSearchLoading(true);
    setHfSearchError(null);
    const timer = setTimeout(() => {
      void searchHuggingFaceLocalModels(query, {
        hfToken: settings.hfToken,
        capabilityFilter: effectiveCapabilityFilter,
      })
        .then((page) => {
          if (requestId !== hfSearchRequestRef.current) return;
          setHfSearchModels(page.models);
          setHfSearchError(null);
        })
        .catch((error) => {
          if (requestId !== hfSearchRequestRef.current) return;
          setHfSearchModels([]);
          setHfSearchError(errorFromUnknown(error));
        })
        .finally(() => {
          if (requestId === hfSearchRequestRef.current) setHfSearchLoading(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    blocked,
    libraryActive,
    librarySection,
    searchQuery,
    effectiveCapabilityFilter,
    settings.hfToken,
  ]);

  const installedModels = filteredCatalog.filter(
    (m) => displayState(m.key).status === "ready"
  );
  const availableModels = filteredCatalog.filter(
    (m) => displayState(m.key).status !== "ready"
  );

  const directGgufModel = useMemo(() => {
    if (blocked || IS_EXPO_GO || !searchQuery.trim()) return null;
    const url = tryResolveLocalGgufDownloadUrl(searchQuery);
    if (!url) return null;
    const built = buildPendingLocalModelFromGgufUrl(url);
    const existing =
      catalogModels.find(
        (model) =>
          model.key === built.key ||
          model.filename === built.filename ||
          model.downloadUrl === url
      ) ?? null;
    const target = existing ?? built;
    if (displayState(target.key).status === "ready") return null;
    return target;
  }, [blocked, searchQuery, catalogModels, displayState]);

  const discoverLocalModels = useMemo(() => {
    let models: LocalModelInfo[];
    if (!directGgufModel) {
      models = availableModels;
    } else if (availableModels.some((model) => model.key === directGgufModel.key)) {
      models = availableModels;
    } else {
      models = [directGgufModel, ...availableModels];
    }

    if (hfSearchModels.length === 0) return models;

    const seen = new Set(models.map((model) => model.key));
    const merged = [...models];
    for (const model of hfSearchModels) {
      if (seen.has(model.key)) continue;
      if (displayState(model.key).status === "ready") continue;
      merged.push(model);
      seen.add(model.key);
    }
    return merged;
  }, [availableModels, directGgufModel, hfSearchModels, displayState]);

  const ensureCustomModelRegistered = useCallback(
    async (model: LocalModelInfo): Promise<LocalModelInfo> => {
      if (!model.key.startsWith("custom:")) return model;
      const existing = catalogModels.find((entry) => entry.key === model.key);
      if (existing) return existing;
      const record = await registerCustomLocalModel(model.downloadUrl);
      const registered = toLocalModelInfo(record);
      setCustomModels((prev) =>
        prev.some((entry) => entry.key === registered.key) ? prev : [...prev, registered]
      );
      return registered;
    },
    [catalogModels]
  );

  const handleDiscoverDownload = useCallback(
    (model: LocalModelInfo) => {
      if (!model.key.startsWith("custom:")) {
        handleDownload(model);
        return;
      }

      const resolved = catalogModels.some((entry) => entry.key === model.key)
        ? model
        : buildPendingLocalModelFromGgufUrl(model.downloadUrl);

      if (!catalogModels.some((entry) => entry.key === resolved.key)) {
        setCustomModels((prev) =>
          prev.some((entry) => entry.key === resolved.key) ? prev : [...prev, resolved]
        );
      }

      handleDownload(resolved);
      void ensureCustomModelRegistered(model);
    },
    [catalogModels, ensureCustomModelRegistered, handleDownload]
  );
  const loadedKey = getLoadedOnDeviceModelKey();
  const loadedModel =
    loadedKey != null ? installedModels.find((model) => model.key === loadedKey) ?? null : null;
  const idleInstalledModels = installedModels.filter((model) => model.key !== loadedKey);

  const quickAccessLocalModels = useMemo(() => {
    if (!showQuickDownloadLocal || searchQuery.trim()) return [];
    return getQuickAccessLocalModels(effectiveCapabilityFilter).filter(
      (model) =>
        displayState(model.key).status !== "ready" ||
        localModelDownloadStore.isActive(model.key)
    );
  }, [showQuickDownloadLocal, searchQuery, effectiveCapabilityFilter, displayState, downloadRevision]);

  const quickAccessLocalKeySet = useMemo(
    () => new Set<string>(QUICK_ACCESS_LOCAL_MODEL_KEYS),
    []
  );

  useEffect(() => {
    setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
    setDownloadVisibleCount(LIBRARY_DOWNLOAD_PAGE_SIZE);
  }, [searchQuery, effectiveCapabilityFilter]);

  const visibleInstalledModels =
    browseOnly || librarySection === "downloaded" || librarySection === "installed"
      ? installedModels.slice(0, installedVisibleCount)
      : installedModels;
  const visibleIdleInstalledModels =
    browseOnly || librarySection === "installed"
      ? idleInstalledModels.slice(0, installedVisibleCount)
      : idleInstalledModels;
  const visibleAvailableModels = browseOnly || librarySection === "discover"
    ? availableModels.slice(0, downloadVisibleCount)
    : availableModels;
  const installedListCount =
    librarySection === "installed" ? idleInstalledModels.length : installedModels.length;
  const hasMoreInstalled =
    (browseOnly || librarySection === "downloaded" || librarySection === "installed") &&
    libraryLayout &&
    libraryHasMorePages(installedVisibleCount, installedListCount);

  const mergedDiscoverItems = useMemo(() => {
    if (!unifiedDiscover || librarySection !== "discover") return [];
    const previousKeys =
      discoverStableOrderRef.current.length > 0
        ? discoverStableOrderRef.current
        : undefined;
    const merged = mergeStableLibraryBrowseItems(
      unifiedDiscover.remoteEntries,
      discoverLocalModels,
      previousKeys
    );
    discoverStableOrderRef.current = merged.map((item) => item.key);
    if (!unifiedDiscover.browseFilters) return merged;
    return filterLibraryBrowseItems(merged, unifiedDiscover.browseFilters);
  }, [
    unifiedDiscover,
    librarySection,
    discoverLocalModels,
    searchQuery,
    effectiveCapabilityFilter,
  ]);

  const groupedDiscover = useMemo(() => {
    if (!unifiedDiscover?.groupBySource) return null;
    return groupLibraryBrowseItems(mergedDiscoverItems, libraryBrowseItemDetailScore);
  }, [unifiedDiscover?.groupBySource, mergedDiscoverItems]);

  const slicedGroupedDiscover = useMemo(() => {
    if (!groupedDiscover) return null;
    return sliceGroupedBrowseItems(groupedDiscover, discoverVisibleCount);
  }, [groupedDiscover, discoverVisibleCount]);

  const visibleMergedDiscoverItems = unifiedDiscover?.groupBySource
    ? (slicedGroupedDiscover?.groups.flatMap((group) => group.items) ?? [])
    : mergedDiscoverItems.slice(0, discoverVisibleCount);

  const mergedDiscoverTotalCount = unifiedDiscover?.groupBySource
    ? (slicedGroupedDiscover?.totalCount ?? mergedDiscoverItems.length)
    : mergedDiscoverItems.length;

  const hasMoreDownloadable =
    (browseOnly || librarySection === "discover") &&
    libraryLayout &&
    (unifiedDiscover
      ? libraryHasMorePages(
          discoverVisibleCount,
          mergedDiscoverTotalCount,
          !!unifiedDiscover.hasMoreRemote
        )
      : libraryHasMorePages(downloadVisibleCount, availableModels.length));

  useEffect(() => {
    if (!unifiedDiscover || librarySection !== "discover" || !libraryActive) return;
    const remoteEntries = visibleMergedDiscoverItems
      .filter((item): item is { kind: "remote"; key: string; entry: RemoteLibraryEntry } => item.kind === "remote")
      .map((item) => item.entry);
    if (remoteEntries.length === 0) return;
    let cancelled = false;
    void prefetchRemoteLibrarySizes(remoteEntries, { hfToken: settings.hfToken }).then(() => {
      if (!cancelled) setHfSizeRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [
    unifiedDiscover,
    librarySection,
    libraryActive,
    visibleMergedDiscoverItems,
    settings.hfToken,
  ]);

  const openModelDetail = useCallback((model: LocalModelInfo) => {
    setDetailModel(model);
  }, []);

  const renderModelCards = (models: LocalModelInfo[]) => {
    if (libraryLayout) {
      return models.map((model) => (
        <LocalCatalogRow
          key={model.key}
          model={model}
          state={displayState(model.key)}
          disabled={blocked || IS_EXPO_GO}
          onPress={libraryLayout ? () => openModelDetail(model) : undefined}
          colorfulLogo={libraryLayout}
          rowStyles={catalogRowStyles}
          colors={colors}
          onDownload={() => handleDownload(model)}
          onPause={() => handlePause(model.key)}
          onResume={() => handleResume(model)}
          onCancel={() => handleCancel(model)}
          onClearError={() => clearDownloadError(model.key, model.filename)}
        />
      ));
    }

    const providers: string[] = [];
    for (const m of models) {
      if (!providers.includes(m.provider)) providers.push(m.provider);
    }
    return providers.map((provider, providerIndex) => {
      const group = models.filter((m) => m.provider === provider);
      const providerColor = group[0]?.providerColor ?? colors.textMuted;
      const headerIconBg = monochromeIcons ? colors.surface : `${providerColor}18`;
      const headerIconBorder = monochromeIcons ? colors.border : `${providerColor}40`;
      const headerLogoColor = monochromeIcons ? colors.textMuted : providerColor;
      return (
        <View key={provider}>
          <View style={[styles.providerHeader, providerIndex === 0 && { marginTop: 0 }]}>
            <View style={[styles.providerIcon, { backgroundColor: headerIconBg, borderColor: headerIconBorder }]}>
              <ModelProviderIcon
                provider={provider}
                size={14}
                color={headerLogoColor}
                monochrome={monochromeIcons}
              />
            </View>
            <Text style={styles.providerLabel}>{provider}</Text>
          </View>
          {group.map((model) => (
            <ModelCard
              key={model.key}
              model={model}
              state={displayState(model.key)}
              isSelected={selectedKey === model.key}
              onDownload={() => handleDownload(model)}
              onPause={() => handlePause(model.key)}
              onResume={() => handleResume(model)}
              onCancel={() => handleCancel(model)}
              onDelete={() => handleDelete(model)}
              onSelect={
                onSelect && displayState(model.key).status === "ready"
                  ? () => onSelect(model.key)
                  : undefined
              }
              onChat={showChatAction ? () => handleChat(model) : undefined}
              onClearError={() => clearDownloadError(model.key, model.filename)}
            />
          ))}
        </View>
      );
    });
  };

  const noDiscoverResults =
    libraryLayout &&
    librarySection === "discover" &&
    !directGgufModel &&
    !hfSearchLoading &&
    !hfSearchError &&
    (unifiedDiscover
      ? !unifiedDiscover.loading && mergedDiscoverItems.length === 0
      : searchQuery.trim().length > 0 && filteredCatalog.length === 0 && hfSearchModels.length === 0);

  const showDownloadedSection =
    librarySection === "all"
      ? browseOnly && !downloadOnly
      : librarySection === "downloaded" || librarySection === "installed";
  const showLoadedSection = librarySection === "loaded";
  const showDiscoverSection =
    librarySection === "all" ? true : librarySection === "discover";
  /** Chat picker load/eject swipes — never on Model Library. */
  const showSwipeLoadRows = !libraryLayout && !browseOnly && !downloadOnly;
  const showCustomUrlField =
    !hideLinkDownload &&
    !registerLinkDownload &&
    libraryLayout &&
    !blocked &&
    !IS_EXPO_GO &&
    !directGgufModel &&
    (librarySection === "discover" || (librarySection === "all" && downloadOnly));

  return (
    <View>
      {IS_EXPO_GO && !libraryLayout && <DevBuildBanner />}

      {showCustomUrlField ? (
        <View style={{ marginBottom: 10 }}>
          <ModelDownloadStringField
            value={customUrl}
            onChangeText={(text) => {
              setCustomUrl(text);
              if (customUrlError) setCustomUrlError(null);
            }}
            onDownload={() => void handleCustomUrlDownload()}
            placeholder="huggingface.co/…/resolve/main/model.gguf"
            colors={colors}
            downloading={customDownloading}
          />
          {customUrlError ? (
            <Text style={{ color: colors.error, fontSize: 12, lineHeight: 16, marginTop: 6 }}>
              {customUrlError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!libraryLayout && readyCount > 0 && (
        <View style={styles.statRow}>
          <Ionicons name="checkmark-done-circle-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.statText}>
            {readyCount} model{readyCount !== 1 ? "s" : ""} ready on device
          </Text>
        </View>
      )}

      {libraryLayout &&
      !hideModalityFilters &&
      !unifiedDiscover?.browseFilters &&
      (librarySection === "all" || librarySection === "discover") ? (
        <ModelModalityFilters
          selected={modalityFilter}
          onChange={setModalityFilter}
          colors={colors}
          style={{ paddingHorizontal: 0, marginBottom: 6 }}
        />
      ) : null}

      {hfSearchError ? (
        <ThemedError
          message={hfSearchError}
          variant="inline"
          onDismiss={() => setHfSearchError(null)}
        />
      ) : null}

      {noDiscoverResults ? (
        <View style={styles.emptySearch}>
          <Text style={styles.emptySearchTitle}>No model found.</Text>
          <Text style={styles.emptySearchBody}>
            Try a model name, org/model id, or paste a Hugging Face GGUF link
            (…/resolve/main/model.gguf). On-device search also looks up GGUF repos on Hugging Face.
          </Text>
        </View>
      ) : libraryLayout ? (
        <>
          {showLoadedSection && loadedModel ? (
            <View style={styles.librarySection}>
              <LocalDownloadedLibraryRow
                model={loadedModel}
                loaded
                onPress={() => setDetailModel(loadedModel)}
                onDelete={blocked ? undefined : () => handleDelete(loadedModel)}
                rowStyles={installedRowStyles}
                colors={colors}
              />
            </View>
          ) : null}

          {librarySection === "installed" &&
          (loadedModel || idleInstalledModels.length > 0) ? (
            <View style={styles.librarySection}>
              {loadedModel ? (
                <LocalDownloadedLibraryRow
                  model={loadedModel}
                  loaded
                  onPress={() => setDetailModel(loadedModel)}
                  onDelete={blocked ? undefined : () => handleDelete(loadedModel)}
                  rowStyles={installedRowStyles}
                  colors={colors}
                />
              ) : null}
              {visibleIdleInstalledModels.map((model) => (
                <LocalDownloadedLibraryRow
                  key={model.key}
                  model={model}
                  onPress={() => setDetailModel(model)}
                  onDelete={blocked ? undefined : () => handleDelete(model)}
                  rowStyles={installedRowStyles}
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
            </View>
          ) : null}

          {librarySection === "downloaded" && installedModels.length > 0 ? (
            <View style={styles.librarySection}>
              {visibleInstalledModels.map((model) => (
                <LocalDownloadedLibraryRow
                  key={model.key}
                  model={model}
                  loaded={model.key === loadedKey}
                  colorfulLogo={libraryLayout}
                  onPress={() => setDetailModel(model)}
                  onDelete={blocked ? undefined : () => handleDelete(model)}
                  rowStyles={installedRowStyles}
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
            </View>
          ) : null}

          {showDownloadedSection && browseOnly && !downloadOnly && installedModels.length > 0 ? (
            <View style={styles.librarySection}>
              <Text style={styles.librarySectionTitle}>Installed on device</Text>
              {visibleInstalledModels.map((model) => (
                <AnimatedLibraryRow key={model.key} rowKey={model.key}>
                  <LocalInstalledRow
                    model={model}
                    isSelected={selectedKey === model.key}
                    browseOnly
                    colorfulLogo={libraryLayout}
                    rowStyles={installedRowStyles}
                    colors={colors}
                    onSelect={
                      onSelect && !blocked ? () => onSelect(model.key) : undefined
                    }
                    onDelete={blocked ? undefined : () => handleDelete(model)}
                  />
                </AnimatedLibraryRow>
              ))}
              {hasMoreInstalled ? (
                <LibrarySeeMoreButton
                  colors={colors}
                  onPress={() =>
                    setInstalledVisibleCount((count) => count + LIBRARY_INSTALLED_PAGE_SIZE)
                  }
                />
              ) : null}
            </View>
          ) : null}

          {showSwipeLoadRows && loadedModel ? (
            <View style={styles.librarySection}>
              <Text style={styles.librarySectionTitle}>Loaded in memory</Text>
              <AnimatedLibraryRow rowKey={loadedModel.key}>
                <LocalInstalledRow
                  model={loadedModel}
                  isSelected={selectedKey === loadedModel.key}
                  isLoadedInMemory
                  ejecting={ejectingKey === loadedModel.key}
                  loading={loadingKey === loadedModel.key}
                  rowStyles={installedRowStyles}
                  colors={colors}
                  onSelect={
                    onSelect && !blocked
                      ? () => {
                          if (selectedKey === loadedModel.key) {
                            void performEject(loadedModel);
                          } else {
                            void performLoad(loadedModel);
                          }
                        }
                      : undefined
                  }
                  onClearSelection={
                    onSelect && !blocked ? () => void performEject(loadedModel) : undefined
                  }
                  onDelete={blocked ? undefined : () => handleDelete(loadedModel)}
                />
              </AnimatedLibraryRow>
            </View>
          ) : null}

          {showSwipeLoadRows && idleInstalledModels.length > 0 ? (
            <View
              style={[
                styles.librarySection,
                loadedModel ? styles.librarySectionSpaced : undefined,
              ]}
            >
              <Text style={styles.librarySectionTitle}>Installed on device</Text>
              {idleInstalledModels.map((model) => (
                <AnimatedLibraryRow key={model.key} rowKey={model.key}>
                  <LocalInstalledRow
                    model={model}
                    isSelected={selectedKey === model.key}
                    ejecting={ejectingKey === model.key}
                    loading={loadingKey === model.key}
                    rowStyles={installedRowStyles}
                    colors={colors}
                    onSelect={
                      onSelect && !blocked
                        ? () => {
                            if (selectedKey === model.key) {
                              void performEject(model);
                            } else {
                              void performLoad(model);
                            }
                          }
                        : undefined
                    }
                    onClearSelection={
                      onSelect && !blocked && selectedKey === model.key
                        ? () => void performEject(model)
                        : undefined
                    }
                    onDelete={blocked ? undefined : () => handleDelete(model)}
                  />
                </AnimatedLibraryRow>
              ))}
            </View>
          ) : null}

          {showDiscoverSection && unifiedDiscover && librarySection === "discover" ? (
            <View style={styles.librarySection}>
              {unifiedDiscover.loading && visibleMergedDiscoverItems.length === 0 ? (
                <View style={styles.libraryLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.libraryLoadingText}>Loading models…</Text>
                </View>
              ) : visibleMergedDiscoverItems.length > 0 ? (
                <>
                  {unifiedDiscover.groupBySource && slicedGroupedDiscover
                    ? slicedGroupedDiscover.groups.flatMap((group) =>
                        group.items.map((item) =>
                          item.kind === "remote" ? (
                            <React.Fragment key={item.key}>
                              {unifiedDiscover.renderRemoteRow(item.entry)}
                            </React.Fragment>
                          ) : (
                            <LocalCatalogRow
                              key={item.model.key}
                              model={item.model}
                              state={displayState(item.model.key)}
                              disabled={blocked || IS_EXPO_GO}
                              onPress={() => openModelDetail(item.model)}
                              colorfulLogo={libraryLayout}
                              rowStyles={catalogRowStyles}
                              colors={colors}
                              onDownload={() => void handleDiscoverDownload(item.model)}
                              onPause={() => handlePause(item.model.key)}
                              onResume={() => handleResume(item.model)}
                              onCancel={() => handleCancel(item.model)}
                              onClearError={() =>
                                clearDownloadError(item.model.key, item.model.filename)
                              }
                            />
                          )
                        )
                      )
                    : visibleMergedDiscoverItems.map((item) =>
                        item.kind === "remote" ? (
                          <React.Fragment key={item.key}>
                            {unifiedDiscover.renderRemoteRow(item.entry)}
                          </React.Fragment>
                        ) : (
                          <LocalCatalogRow
                            key={item.model.key}
                            model={item.model}
                            state={displayState(item.model.key)}
                            disabled={blocked || IS_EXPO_GO}
                            onPress={() => openModelDetail(item.model)}
                            colorfulLogo={libraryLayout}
                            rowStyles={catalogRowStyles}
                            colors={colors}
                            onDownload={() => void handleDiscoverDownload(item.model)}
                            onPause={() => handlePause(item.model.key)}
                            onResume={() => handleResume(item.model)}
                            onCancel={() => handleCancel(item.model)}
                            onClearError={() =>
                              clearDownloadError(item.model.key, item.model.filename)
                            }
                          />
                        )
                      )}
                </>
              ) : null}
              {hasMoreDownloadable || unifiedDiscover.loadingMoreRemote ? (
                <LibrarySeeMoreButton
                  colors={colors}
                  loading={unifiedDiscover.loadingMoreRemote}
                  disabled={unifiedDiscover.loadingMoreRemote}
                  onPress={() => unifiedDiscover.onSeeMoreRemote?.()}
                />
              ) : null}
            </View>
          ) : null}

          {showDiscoverSection && !unifiedDiscover && availableModels.length > 0 ? (
            <View style={styles.librarySection}>
              {!hideSectionTitles ? (
                <Text style={styles.librarySectionTitle}>Download to device</Text>
              ) : null}
              {!hideSectionTitles ? (
                <SectionHintLines
                  colors={colors}
                  line={
                    downloadOnly || librarySection === "discover"
                      ? "Phone icon — tap for details"
                      : "Tap download on each row"
                  }
                />
              ) : null}
              {renderModelCards(visibleAvailableModels)}
              {hasMoreDownloadable ? (
                <LibrarySeeMoreButton
                  colors={colors}
                  onPress={() =>
                    setDownloadVisibleCount((count) => count + LIBRARY_DOWNLOAD_PAGE_SIZE)
                  }
                />
              ) : null}
            </View>
          ) : null}

          {librarySection === "all" &&
          (downloadOnly
            ? availableModels.length === 0
            : (browseOnly ? installedModels.length === 0 : !loadedModel && idleInstalledModels.length === 0) &&
              availableModels.length === 0) ? (
            <View style={styles.emptySearch}>
              <Ionicons name="download-outline" size={28} color={colors.textDim} />
              <Text style={styles.emptySearchTitle}>
                {downloadOnly && installedModels.length > 0
                  ? "All catalog models downloaded"
                  : "No models on device yet"}
              </Text>
              <Text style={styles.emptySearchBody}>
                {downloadOnly && installedModels.length > 0
                  ? "Search above to find more models to download."
                  : "Pick a model below to download and run offline — no Mac required."}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        renderModelCards(filteredCatalog)
      )}

      <LocalModelDetailSheet
        model={detailModel}
        visible={detailModel !== null}
        onClose={() => {
          setDetailModel(null);
          setHfSizeRevision((revision) => revision + 1);
        }}
        onDownload={() => {
          if (!detailModel) return;
          if (detailModel.key.startsWith("custom:") || !LOCAL_MODEL_CATALOG.some((m) => m.key === detailModel.key)) {
            handleDiscoverDownload(detailModel);
            return;
          }
          handleDownload(detailModel);
        }}
        onDelete={
          detailModel && displayState(detailModel.key).status === "ready" && !blocked
            ? () => handleDelete(detailModel)
            : undefined
        }
        installed={detailModel ? displayState(detailModel.key).status === "ready" : false}
        downloading={
          detailModel
            ? ["downloading", "paused"].includes(displayState(detailModel.key).status)
            : false
        }
        disabled={blocked || IS_EXPO_GO}
        colors={colors}
        hfToken={settings.hfToken}
      />

      {!suppressFootnote ? (
      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
        <Text style={styles.footnoteText}>
          Q4_K_M quantized GGUF files. Powered by{" "}
          <Text style={styles.footnoteLink}>llama.cpp</Text> via{" "}
          <Text style={styles.footnoteLink}>llama.rn</Text>.
          Requires ≥1 GB free RAM for 1B+ models.
        </Text>
      </View>
      ) : null}

      <ThemedConfirmDialog
        visible={deleteTarget !== null}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete Model"}
        message="This will remove the model file from your device."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
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
                    if (!result.ok) setHfSearchError(result.message);
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

