import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { downloadAsync } from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import SectionHintLines, { createSectionSubtitleStyle } from "./SectionHintLines";
import ThemedConfirmDialog from "./ThemedConfirmDialog";
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
} from "../lib/huggingface-model-search";
import { fetchLmStudioArtifactDownloadCount } from "../lib/lmstudio-hub-artifact";
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
  registerCustomLocalModel,
  removeCustomLocalModel,
  toLocalModelInfo,
} from "../lib/custom-local-models";
import {
  resolveLocalGgufDownloadUrl,
} from "../lib/model-download-string";
import {
  getQuickAccessLocalModels,
  IS_EXPO_GO,
  LOCAL_MODEL_CATALOG,
  localModelIdHaystack,
  LocalModelInfo,
  QUICK_ACCESS_LOCAL_MODEL_KEYS,
  deleteModelFile,
  ejectOnDeviceModel,
  getLoadedOnDeviceModelKey,
  isModelDownloaded,
  modelFile,
  modelFileSize,
} from "../lib/local-models";
import ModelDownloadStringField from "./ModelDownloadStringField";
import { radii, ThemeColors, useAccentPalette, useTheme } from "../lib/theme";
import {
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
  statItemsWithoutSize,
} from "./ModelPicker";
import {
  modelMatchesCapabilityFilter,
  ModelCapabilityFilter,
} from "../lib/vision-models";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelStatus = "idle" | "checking" | "downloading" | "ready" | "error";

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
  const fromLabel = resolveFileSizeLabel(model.sizeLabel, model.filename, model.key);
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
    case "error":
      return <Ionicons name="alert-circle" size={22} color={colors.error} />;
    case "checking":
      return <ActivityIndicator size="small" color={colors.textDim} />;
    default:
      return <Ionicons name="cloud-download-outline" size={22} color={colors.textDim} />;
  }
}

// ─── Storage bar ─────────────────────────────────────────────────────────────

function StorageBar({ usedBytes }: { usedBytes: number }) {
  const { colors } = useTheme();
  const storageStyles = useMemo(() => createStorageStyles(colors), [colors]);
  let freeBytes = 0;
  try { freeBytes = Paths.availableDiskSpace; } catch { /* web/Expo Go */ }

  const total = usedBytes + freeBytes;
  const pct = total > 0 ? Math.min((usedBytes / total) * 100, 100) : 0;

  return (
    <View style={storageStyles.container}>
      <View style={storageStyles.row}>
        <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
        <Text style={storageStyles.label}>{formatStorageBytes(usedBytes)} used by models</Text>
        <Ionicons name="save-outline" size={12} color={colors.textDim} />
        <Text style={storageStyles.free}>{formatStorageBytes(freeBytes)} free</Text>
      </View>
      <View style={storageStyles.track}>
        <View style={[storageStyles.fill, { width: `${pct}%` as `${number}%` }]} />
      </View>
    </View>
  );
}

function createStorageStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginBottom: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    label: { color: colors.textMuted, fontSize: 12, flex: 1 },
    free: { color: colors.textDim, fontSize: 12 },
    track: { height: 3, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: "hidden" },
    fill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  });
}

// ─── Model card ───────────────────────────────────────────────────────────────

function ModelCard({
  model,
  state,
  isSelected,
  onDownload,
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
  onCancel: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  onChat?: () => void;
  onClearError: () => void;
}) {
  const colors = useAccentPalette();
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const isReady = state.status === "ready";
  const isDownloading = state.status === "downloading";
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

      {isDownloading && (
        <View style={cardStyles.progressWrap}>
          <View style={cardStyles.progressHeader}>
            <Ionicons name="cloud-download-outline" size={14} color={colors.primaryLight} />
            <Text style={cardStyles.progressTitle}>Downloading model</Text>
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

        {isDownloading && (
          <Pressable style={[cardStyles.btn, cardStyles.btnDanger]} onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={[cardStyles.btnTextDanger]}>Cancel download</Text>
          </Pressable>
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

function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  containerReady: { borderColor: colors.primaryBorder },
  containerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryGlow,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  modelIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  name: { color: colors.text, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  desc: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  detailStats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },

  progressWrap: { marginBottom: 12 },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  progressTitle: { color: colors.primaryLight, fontSize: 12, fontWeight: "600", flex: 1 },
  track: { height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  fill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  progressMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  progressMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  progressPct: { color: colors.primaryLight, fontSize: 12, fontWeight: "700" },
  progressBytes: { color: colors.textDim, fontSize: 11 },
  progressSpeed: { color: colors.textMuted, fontSize: 11 },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(248,113,113,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: colors.error, fontSize: 12, flex: 1, lineHeight: 18 },

  actions: {},
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  btnPrimary: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  btnChat: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  btnDanger: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder },
  btnDangerIcon: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: 14,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextDanger: { color: colors.error, fontSize: 14, fontWeight: "600" },
  readyRow: { flexDirection: "row", gap: 8 },
  });
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

function createBannerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: "rgba(245,158,11,0.06)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.3)",
      padding: 16,
      marginBottom: 20,
    },
    iconWrap: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: "rgba(245,158,11,0.1)",
      borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    title: { color: "#f59e0b", fontSize: 14, fontWeight: "700", marginBottom: 6 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    codeRow: {
      backgroundColor: colors.markdownCodeBg,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.markdownFenceBorder,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 6,
      alignSelf: "flex-start",
    },
    code: { color: colors.markdownCodeText, fontFamily: "Courier", fontSize: 12 },
  });
}

// ─── Compact downloaded row (unified library) ───────────────────────────────

function LocalDownloadedLibraryRow({
  model,
  onPress,
  loaded = false,
  colorfulLogo = false,
  rowStyles,
  colors,
}: {
  model: LocalModelInfo;
  onPress: () => void;
  loaded?: boolean;
  colorfulLogo?: boolean;
  rowStyles: ReturnType<typeof createInstalledRowStyles>;
  colors: ThemeColors;
}) {
  const sizeLabel = resolveLocalModelSizeLabel(model, { useActualFileSize: true });
  const stats = getLocalModelStatItems(model, { useActualFileSize: true });

  return (
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
          color={colors.textMuted}
          colorfulLogo={colorfulLogo}
          catalogSource="huggingface"
        />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.titleRow}>
          <Text style={rowStyles.name} numberOfLines={1}>
            {model.name}
          </Text>
          {loaded ? (
            <ModelTraitBadge
              trait={{ label: "Loaded", color: colors.primaryLight }}
              muted
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
          textStyle={rowStyles.stats}
          muted
        />
      </View>
      <LibraryRowSizeLabel label={sizeLabel} colors={colors} />
      </Pressable>
    </View>
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
  downloading,
  disabled,
  colors,
  hfToken,
}: {
  model: LocalModelInfo | null;
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
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

function createLocalDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { maxHeight: "82%", paddingBottom: 12 },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      alignSelf: "center",
      marginBottom: 12,
    },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    icon: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBody: {
      flex: 1,
      minWidth: 0,
    },
    publisher: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 26,
    },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
    descriptionWrap: { marginTop: 8 },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    fields: { marginTop: 16, gap: 12 },
    field: { gap: 4 },
    fieldLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    fieldValueRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    fieldValue: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
    fieldMono: {
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      fontSize: 12,
      lineHeight: 18,
    },
    copyBtn: { padding: 4, marginTop: -2 },
    actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  });
}

function LocalCatalogRow({
  model,
  state,
  onPress,
  onDownload,
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
  onClearError?: () => void;
  disabled?: boolean;
  colorfulLogo?: boolean;
  rowStyles: ReturnType<typeof createCatalogRowStyles>;
  colors: ThemeColors;
}) {
  const stats = getLocalModelStatItems(model);
  const sizeLabel = resolveLocalCatalogDisplaySize(model);
  const downloading = state.status === "downloading";
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
        {downloading ? (
          <View style={rowStyles.progressTrack}>
            <View
              style={[
                rowStyles.progressFill,
                { width: `${Math.round(state.progress * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
      <LibraryRowSizeLabel label={sizeLabel} colors={colors} />
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onDownload();
        }}
        disabled={downloading || disabled}
        style={({ pressed }) => [
          rowStyles.downloadBtn,
          downloading && rowStyles.downloadBtnActive,
          (downloading || disabled) && rowStyles.downloadBtnDisabled,
          pressed && !downloading && !disabled && rowStyles.downloadBtnPressed,
        ]}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={colors.primaryLight} />
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

function createCatalogRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    rowWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 12,
    },
    rowBrowse: { alignItems: "center" },
    rowPressed: { opacity: 0.82 },
    icon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    name: { color: colors.text, fontSize: 16, fontWeight: "600", lineHeight: 21, flexShrink: 1 },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
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
      borderRadius: 999,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      marginTop: 2,
      flexShrink: 0,
    },
    downloadBtnActive: {},
    downloadBtnDisabled: { opacity: 0.6 },
    downloadBtnPressed: { opacity: 0.8 },
    rowError: { marginTop: 6, marginHorizontal: 0 },
  });
}

// ─── Compact installed row (library layout) ───────────────────────────────────

function LocalInstalledRow({
  model,
  isSelected,
  isLoadedInMemory = false,
  onSelect,
  onClearSelection,
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

  if (browseOnly) {
    return row;
  }

  return (
    <SwipeToDeleteRow
      onLoad={!isLoadedInMemory && onSelect ? onSelect : undefined}
      onEject={isLoadedInMemory || isSelected ? onClearSelection : undefined}
      ejectDisabled={ejecting || loading}
      loadDisabled={loading}
      backgroundColor={colors.bgElevated}
    >
      {row}
    </SwipeToDeleteRow>
  );
}

function createInstalledRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      position: "relative",
      overflow: "hidden",
    },
    rowSelected: {
      backgroundColor: colors.primaryGlow,
      borderRadius: radii.sm,
    },
    rowBrowse: {
      paddingHorizontal: 0,
    },
    rowPressed: { opacity: 0.82 },
    rowMuteWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      zIndex: 1,
    },
    icon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    name: { color: colors.text, fontSize: 16, fontWeight: "600", lineHeight: 21, flexShrink: 1 },
    nameSelected: { color: colors.primaryLight },
    subtitle: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    useBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    useBtnSelected: {
      backgroundColor: colors.bgElevated,
      borderColor: colors.primaryBorder,
    },
    useBtnPressed: { opacity: 0.85 },
    useBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    useBtnTextSelected: { color: colors.primaryLight },
    readyIcon: { paddingHorizontal: 4 },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    actionBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnPressed: { opacity: 0.7 },
  });
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
}: {
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  showChatAction?: boolean;
  monochromeIcons?: boolean;
  searchQuery?: string;
  modalityFilter?: ModelCapabilityFilter;
  onModalityFilterChange?: (filter: ModelCapabilityFilter) => void;
  hideModalityFilters?: boolean;
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
  const [usedBytes, setUsedBytes] = useState(0);
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

  // Active downloads: key → AbortController (cancel token)
  const downloadRefs = useRef<Record<string, AbortController>>({});
  // Speed tracking: key → {lastBytes, lastTime}
  const speedRefs = useRef<Record<string, { lastBytes: number; lastTime: number }>>({});

  function patchState(key: string, patch: Partial<ModelState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const refreshStatus = useCallback(() => {
    let used = 0;
    for (const model of LOCAL_MODEL_CATALOG) {
      const exists = model.filename ? (() => {
        try { return modelFile(model.filename).exists; } catch { return false; }
      })() : false;

      if (exists) {
        patchState(model.key, { status: "ready" });
        used += modelFileSize(model.filename);
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
    setUsedBytes(used);
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

  const handleDownload = useCallback(async (model: LocalModelInfo) => {
    if (IS_EXPO_GO || blocked) {
      return;
    }

    patchState(model.key, {
      status: "downloading",
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      speedMBs: 0,
      etaSecs: 0,
    });
    speedRefs.current[model.key] = { lastBytes: 0, lastTime: Date.now() };

    // Remove any partial file from a previous attempt
    const destination = new File(Paths.document, model.filename);
    if (destination.exists) destination.delete();

    const abortCtrl = new AbortController();
    downloadRefs.current[model.key] = abortCtrl;

    // Get expected size from HEAD request so progress polling works
    let expectedBytes = 0;
    try {
      const head = await fetch(model.downloadUrl, { method: "HEAD", signal: abortCtrl.signal });
      expectedBytes = parseInt(head.headers.get("content-length") ?? "0", 10);
    } catch { /* no content-length — progress will be indeterminate */ }

    // Poll file size every 500ms to show progress while downloadAsync runs
    const pollInterval = setInterval(() => {
      try {
        const f = new File(Paths.document, model.filename);
        if (!f.exists) return;
        const written = f.size ?? 0;
        const now = Date.now();
        const ref = speedRefs.current[model.key];
        if (!ref) return;
        const deltaBytes = written - ref.lastBytes;
        const deltaSecs = (now - ref.lastTime) / 1000;
        let speedMBs = 0;
        let etaSecs = 0;
        if (deltaSecs >= 0.5 && deltaBytes > 0) {
          speedMBs = deltaBytes / (1024 * 1024) / deltaSecs;
          const remaining = Math.max(0, expectedBytes - written);
          etaSecs = speedMBs > 0 ? remaining / (1024 * 1024) / speedMBs : 0;
          speedRefs.current[model.key] = { lastBytes: written, lastTime: now };
        }
        const ratio = expectedBytes > 0 ? Math.min(written / expectedBytes, 0.99) : 0;
        patchState(model.key, {
          progress: ratio,
          bytesWritten: written,
          totalBytes: expectedBytes,
          speedMBs,
          etaSecs,
        });
      } catch { /* file not yet created */ }
    }, 500);

    try {
      if (abortCtrl.signal.aborted) throw new Error("cancelled");
      const result = await downloadAsync(model.downloadUrl, destination.uri);
      clearInterval(pollInterval);
      if (result && result.status < 400) {
        patchState(model.key, { status: "ready", progress: 1, bytesWritten: expectedBytes, totalBytes: expectedBytes });
        refreshStatus();
        void refreshCustomModels();
      } else {
        patchState(model.key, {
          status: "error",
          error: `Download server returned an error (${result?.status ?? "unknown"}). Try again in a moment.`,
        });
      }
    } catch (e) {
      clearInterval(pollInterval);
      const msg = formatLocalDownloadError(e);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("abort")) {
        patchState(model.key, { status: "idle", progress: 0 });
      } else {
        patchState(model.key, { status: "error", error: msg });
      }
    } finally {
      clearInterval(pollInterval);
      delete downloadRefs.current[model.key];
    }
  }, [blocked, refreshStatus, refreshCustomModels]);

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
      await handleDownload(model);
      setCustomUrl("");
    } catch (e) {
      setCustomUrlError(errorFromUnknown(e));
    } finally {
      setCustomDownloading(false);
      void refreshCustomModels();
    }
  }, [blocked, customUrl, handleDownload, refreshCustomModels]);

  const handleCancel = useCallback(async (model: LocalModelInfo) => {
    const ctrl = downloadRefs.current[model.key];
    if (ctrl) {
      ctrl.abort();
      delete downloadRefs.current[model.key];
    }
    // Clean up any partial file
    deleteModelFile(model.filename);
    patchState(model.key, { status: "idle", progress: 0, bytesWritten: 0, totalBytes: 0 });
  }, []);

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

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteModelFile(deleteTarget.filename);
    if (deleteTarget.key.startsWith("custom:")) {
      void removeCustomLocalModel(deleteTarget.filename);
      setCustomModels((prev) => prev.filter((model) => model.key !== deleteTarget.key));
    }
    patchState(deleteTarget.key, { status: "idle", progress: 0, bytesWritten: 0, totalBytes: 0 });
    refreshStatus();
    setDeleteTarget(null);
  }, [deleteTarget, refreshStatus]);

  const handleChat = useCallback((model: LocalModelInfo) => {
    router.push(`/chat/new?localModel=${model.key}` as any);
  }, [router]);

  const readyCount = Object.values(states).filter((s) => s.status === "ready").length;
  const catalogModels = useMemo(() => {
    const builtInKeys = new Set(LOCAL_MODEL_CATALOG.map((model) => model.key));
    const extras = customModels.filter((model) => !builtInKeys.has(model.key));
    return [...LOCAL_MODEL_CATALOG, ...extras];
  }, [customModels]);

  const filteredCatalog = useMemo(
    () => filterLocalModels(catalogModels, searchQuery, effectiveCapabilityFilter),
    [catalogModels, searchQuery, effectiveCapabilityFilter]
  );

  const installedModels = filteredCatalog.filter((m) => states[m.key]?.status === "ready");
  const availableModels = filteredCatalog.filter((m) => states[m.key]?.status !== "ready");
  const loadedKey = getLoadedOnDeviceModelKey();
  const loadedModel =
    loadedKey != null ? installedModels.find((model) => model.key === loadedKey) ?? null : null;
  const idleInstalledModels = installedModels.filter((model) => model.key !== loadedKey);

  const quickAccessLocalModels = useMemo(() => {
    if (!showQuickDownloadLocal || searchQuery.trim()) return [];
    return getQuickAccessLocalModels().filter((model) => states[model.key]?.status !== "ready");
  }, [showQuickDownloadLocal, searchQuery, states]);

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
  const hasMoreInstalled =
    (browseOnly || librarySection === "downloaded" || librarySection === "installed") &&
    libraryLayout &&
    (librarySection === "installed"
      ? idleInstalledModels.length > installedVisibleCount
      : installedModels.length > installedVisibleCount);

  const mergedDiscoverItems = useMemo(() => {
    if (!unifiedDiscover || librarySection !== "discover") return [];
    const previousKeys =
      discoverStableOrderRef.current.length > 0
        ? discoverStableOrderRef.current
        : undefined;
    const merged = mergeStableLibraryBrowseItems(
      unifiedDiscover.remoteEntries,
      availableModels,
      previousKeys
    );
    discoverStableOrderRef.current = merged.map((item) => item.key);
    if (!unifiedDiscover.browseFilters) return merged;
    return filterLibraryBrowseItems(merged, unifiedDiscover.browseFilters);
  }, [
    unifiedDiscover,
    librarySection,
    availableModels,
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
    ? (groupedDiscover?.totalCount ?? mergedDiscoverItems.length)
    : mergedDiscoverItems.length;

  const hasMoreDownloadable =
    (browseOnly || librarySection === "discover") &&
    libraryLayout &&
    (unifiedDiscover
      ? discoverVisibleCount < mergedDiscoverTotalCount || !!unifiedDiscover.hasMoreRemote
      : availableModels.length > downloadVisibleCount);

  const openModelDetail = useCallback((model: LocalModelInfo) => {
    setDetailModel(model);
  }, []);

  const renderModelCards = (models: LocalModelInfo[]) => {
    if (libraryLayout) {
      return models.map((model) => (
        <LocalCatalogRow
          key={model.key}
          model={model}
          state={states[model.key] ?? defaultState()}
          disabled={blocked || IS_EXPO_GO}
          onPress={libraryLayout ? () => openModelDetail(model) : undefined}
          colorfulLogo={libraryLayout}
          rowStyles={catalogRowStyles}
          colors={colors}
          onDownload={() => handleDownload(model)}
          onClearError={() => patchState(model.key, { status: "idle", error: undefined })}
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
              state={states[model.key] ?? defaultState()}
              isSelected={selectedKey === model.key}
              onDownload={() => handleDownload(model)}
              onCancel={() => handleCancel(model)}
              onDelete={() => handleDelete(model)}
              onSelect={
                onSelect && states[model.key]?.status === "ready"
                  ? () => onSelect(model.key)
                  : undefined
              }
              onChat={showChatAction ? () => handleChat(model) : undefined}
              onClearError={() => patchState(model.key, { status: "idle", error: undefined })}
            />
          ))}
        </View>
      );
    });
  };

  const noDiscoverResults =
    libraryLayout &&
    librarySection === "discover" &&
    (unifiedDiscover
      ? !unifiedDiscover.loading && mergedDiscoverItems.length === 0
      : searchQuery.trim().length > 0 && filteredCatalog.length === 0);

  const showDownloadedSection =
    librarySection === "all"
      ? browseOnly && !downloadOnly
      : librarySection === "downloaded" || librarySection === "installed";
  const showLoadedSection = librarySection === "loaded";
  const showDiscoverSection =
    librarySection === "all" ? true : librarySection === "discover";
  /** Chat picker load/eject swipes — not Model Library (view-only rows). */
  const showSwipeLoadRows =
    !browseOnly && !downloadOnly && (!libraryLayout || librarySection === "all");
  const showStorageBar =
    !IS_EXPO_GO && !blocked && librarySection !== "downloaded";
  const showCustomUrlField =
    libraryLayout &&
    !blocked &&
    !IS_EXPO_GO &&
    (librarySection === "discover" || (librarySection === "all" && downloadOnly));

  return (
    <View>
      {IS_EXPO_GO && !libraryLayout && <DevBuildBanner />}

      {showStorageBar ? (
        <View style={libraryLayout ? { marginBottom: 4 } : undefined}>
          <StorageBar usedBytes={usedBytes} />
        </View>
      ) : null}

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

      {noDiscoverResults ? (
        <View style={styles.emptySearch}>
          <Text style={styles.emptySearchTitle}>No model found.</Text>
        </View>
      ) : libraryLayout ? (
        <>
          {showLoadedSection && loadedModel ? (
            <View style={styles.librarySection}>
              <LocalDownloadedLibraryRow
                model={loadedModel}
                loaded
                colorfulLogo={libraryLayout}
                onPress={() => setDetailModel(loadedModel)}
                rowStyles={installedRowStyles}
                colors={colors}
              />
            </View>
          ) : null}

          {librarySection === "installed" && idleInstalledModels.length > 0 ? (
            <View style={styles.librarySection}>
              {visibleIdleInstalledModels.map((model) => (
                <LocalDownloadedLibraryRow
                  key={model.key}
                  model={model}
                  colorfulLogo={libraryLayout}
                  onPress={() => setDetailModel(model)}
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
                              state={states[item.model.key] ?? defaultState()}
                              disabled={blocked || IS_EXPO_GO}
                              onPress={() => openModelDetail(item.model)}
                              colorfulLogo={libraryLayout}
                              rowStyles={catalogRowStyles}
                              colors={colors}
                              onDownload={() => handleDownload(item.model)}
                              onClearError={() =>
                                patchState(item.model.key, {
                                  status: "idle",
                                  error: undefined,
                                })
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
                            state={states[item.model.key] ?? defaultState()}
                            disabled={blocked || IS_EXPO_GO}
                            onPress={() => openModelDetail(item.model)}
                            colorfulLogo={libraryLayout}
                            rowStyles={catalogRowStyles}
                            colors={colors}
                            onDownload={() => handleDownload(item.model)}
                            onClearError={() =>
                              patchState(item.model.key, { status: "idle", error: undefined })
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
                  ? "Browse Hugging Face below or paste a GGUF link to add more models."
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
          void handleDownload(detailModel);
        }}
        downloading={detailModel ? states[detailModel.key]?.status === "downloading" : false}
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
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createLocalModelsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    statText: { color: colors.primaryLight, fontSize: 13 },

    librarySection: { marginBottom: 8 },
    librarySectionSpaced: { marginTop: 8 },
    librarySectionTitle: createSectionSubtitleStyle(colors),
    quickDownloadBlock: { marginBottom: 4 },
    quickDownloadPlatformTitle: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginTop: 8,
      marginBottom: 2,
    },
    libraryLoading: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      gap: 10,
    },
    libraryLoadingText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    emptySearch: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      gap: 6,
    },
    emptySearchTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 4 },
    emptySearchBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
      maxWidth: 280,
    },

    providerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 20,
      marginBottom: 10,
    },
    providerIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    providerLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    footnote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      marginTop: 12, padding: 14,
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    footnoteText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, flex: 1 },
    footnoteLink: { color: colors.primary, fontWeight: "600" },
  });
}
