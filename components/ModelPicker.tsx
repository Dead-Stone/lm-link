import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList as RNSectionList,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from "react-native";
import { createNativeWrapper, FlatList } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchModels,
  formatLoadError,
  ejectRemoteModel,
  isHubUrl,
  isModelInMemory,
  loadRemoteModelOnSystem,
  partitionLibraryModels,
  resolveManagementApiKey,
  resolveManagementBaseUrl,
} from "../lib/api";
import { LIBRARY_PAGE_SIZE } from "../lib/library-pagination";
import { isSameModelId, resolveCanonicalModelId } from "../lib/model-id";
import { extractModelParamLabel, matchesModelSearchQuery, parseModelName } from "../lib/model-name";
import { resolveEntryCatalogSource } from "../lib/library-filters";
import { matchesLibrarySearch } from "../lib/library-search";
import { isLmStudioMacDownloadModel } from "../lib/lmstudio-downloadable";
import { useApp } from "../lib/context";
import { createModalTheme } from "../lib/modal-theme";
import { radii, ThemeColors, useAccentPalette, useTheme } from "../lib/theme";
import { formatFileSize, isFileSizeLabel, resolveFileSizeLabel } from "../lib/model-size";
import {
  getQuickAccessRemoteLibrary,
  isModelInstalled,
  REMOTE_MODEL_LIBRARY,
  LibraryDownloadSource,
  RemoteLibraryEntry,
  normalizeModelKey,
  resolveRemoteLibraryDisplayName,
} from "../lib/remote-model-library";
import { LMModel, ModelPlatform } from "../lib/types";
import {
  capabilityFilterLabel,
  capabilityToModalityFilter,
  remoteLibraryEntryHaystack,
  modelMatchesCapabilityFilter,
  modelMatchesModalityFilter,
  modelModalityLabel,
  ModelCapabilityFilter,
  ModelModality,
  ModelModalityFilter,
  modelSupportsThinking,
  resolveModelModalities,
  resolveModelModalitiesFromModel,
} from "../lib/vision-models";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
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

const GestureSectionList = createNativeWrapper(RNSectionList, {
  disallowInterruption: true,
  shouldCancelWhenOutside: false,
}) as typeof RNSectionList;
import ThemedError from "./ThemedError";

// ─── Model parsing helpers ────────────────────────────────────────────────────

export { parseModelName } from "../lib/model-name";

function formatContext(n?: number): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M ctx`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function formatLoadState(state?: string): string | null {
  if (!state) return null;
  const normalized = state.toLowerCase();
  if (normalized === "loaded") return "Loaded";
  if (normalized === "not-loaded" || normalized === "not loaded") return "Not loaded";
  return state.replace(/-/g, " ");
}

const QUANT_COLORS: Record<string, string> = {
  F32: "#a78bfa", F16: "#8b5cf6", BF16: "#8b5cf6",
  Q8_0: "#34d399", Q6_K: "#6ee7b7",
  Q5_K_M: "#a78bfa", Q5_K_S: "#a78bfa", Q5_0: "#c4b5fd",
  Q4_K_M: "#8b5cf6", Q4_K_S: "#8b5cf6", Q4_0: "#7c3aed",
  Q3_K_M: "#f59e0b", Q3_K_S: "#fbbf24",
  Q2_K: "#f87171",
};

function quantColor(q: string): string {
  return QUANT_COLORS[q] ?? "#888";
}

export type ModelStatItem = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Text glyph for modality (e.g. "Aa" for text-only). */
  glyph?: string;
  label: string;
  color?: string;
  /** Adjacent stats in the same group render without a comma separator. */
  group?: string;
  /** Renders with an accent color when set (text / image / video). */
  modality?: ModelModality;
  /** Model file download size (GB/MB) — rendered right-aligned, slightly larger than other stats. */
  role?: "size" | "param";
};

export { isFileSizeLabel } from "../lib/model-size";

function findRemoteLibraryEntry(modelId: string) {
  return REMOTE_MODEL_LIBRARY.find((item) => isSameModelId(item.id, modelId));
}

const MODALITY_ICON_SIZE = 11;

function modalityAccentColor(
  modality: ModelModality,
  colors: ThemeColors,
  muted = false,
  isDark = true
): string {
  if (muted) return isDark ? colors.textMuted : "#c0c0c0";
  switch (modality) {
    case "image":
      return isDark ? "#a78bfa" : "#2563eb";
    case "video":
      return isDark ? "#f59e0b" : "#d97706";
    default:
      return isDark ? colors.primaryLight : colors.textMuted;
  }
}

export const MAX_MODEL_STATS = 5;

export function trimModelStats(
  items: ModelStatItem[],
  limit = MAX_MODEL_STATS
): ModelStatItem[] {
  const pinned = items.filter((item) => item.role === "param");
  const capabilities = items.filter(
    (item) => item.group === "modality" || item.group === "capability"
  );
  const rest = items.filter(
    (item) =>
      item.role !== "param" &&
      item.role !== "size" &&
      item.group !== "modality" &&
      item.group !== "capability"
  );
  const restLimit = Math.max(limit - pinned.length - capabilities.length, 0);
  const trimmedRest = rest.slice(0, restLimit);

  const result: ModelStatItem[] = [];
  let capabilitiesInserted = false;
  let pinnedInserted = false;
  for (const item of items) {
    if (item.role === "size") continue;
    if (item.group === "modality" || item.group === "capability") {
      if (!capabilitiesInserted) {
        result.push(...capabilities);
        capabilitiesInserted = true;
      }
      continue;
    }
    if (item.role === "param") {
      if (!pinnedInserted) {
        result.push(...pinned);
        pinnedInserted = true;
      }
      continue;
    }
    if (trimmedRest.includes(item)) {
      result.push(item);
    }
  }
  if (!capabilitiesInserted) {
    result.push(...capabilities);
  }
  if (!pinnedInserted) {
    result.push(...pinned);
  }
  return result;
}

/** Flat 2D thunder bolt — used for speed-related stats (matches other `-outline` detail icons). */
export const SPEED_STAT_ICON: keyof typeof Ionicons.glyphMap = "flash-outline";
export const SPEED_STAT_ICON_SIZE = 8;

export function isSpeedLabel(label: string): boolean {
  return /\b(fast|speed|quick|rapid|tok\/s|mb\/s)\b/i.test(label);
}

export function badgeStatIcon(badge: string): keyof typeof Ionicons.glyphMap {
  return isSpeedLabel(badge) ? SPEED_STAT_ICON : "ribbon-outline";
}

export type ModelTrait = {
  label: string;
  color?: string;
};

export function modelTraitIcon(label: string): keyof typeof Ionicons.glyphMap {
  const lower = label.toLowerCase();
  if (/recomm|staff|pick|popular/.test(lower)) return "star-outline";
  if (/powerful|quality|strong|moe/.test(lower)) return "flame-outline";
  if (isSpeedLabel(label) || /fast|tiny|compact|efficient/.test(lower)) return SPEED_STAT_ICON;
  if (/new/.test(lower)) return "sparkles-outline";
  if (/reason|think/.test(lower)) return "bulb-outline";
  if (/cod|stem/.test(lower)) return "code-slash-outline";
  if (/vision|vlm/.test(lower)) return "image-outline";
  if (/balance/.test(lower)) return "scale-outline";
  if (/classic/.test(lower)) return "book-outline";
  if (/multi|lingual/.test(lower)) return "globe-outline";
  return badgeStatIcon(label);
}

export function shortenTraitLabel(label: string): string {
  const primary = label.split(/[·•|,]/)[0]?.trim() || label;
  const lower = primary.toLowerCase();
  if (lower.includes("recommend")) return "Recomm";
  if (lower.includes("high quality")) return "Quality";
  if (lower.includes("staff pick")) return "Recomm";
  if (primary.length <= 14) return primary;
  return `${primary.slice(0, 12)}…`;
}

export function resolveRemoteModelTrait(modelId: string): ModelTrait | null {
  const key = normalizeModelKey(modelId);
  const entry = REMOTE_MODEL_LIBRARY.find((item) => {
    const libKey = normalizeModelKey(item.id);
    return key === libKey || key.endsWith(libKey) || libKey.endsWith(key);
  });
  if (entry?.badge) {
    return { label: entry.badge, color: entry.badgeColor };
  }

  const { displayName } = parseModelName(modelId);
  const hay = `${modelId} ${displayName}`.toLowerCase();
  if (/r1|reason|think|o1|deepseek-r1/.test(hay)) {
    return { label: "Reasoning", color: "#f59e0b" };
  }
  if (/vision|vlm|llava|moondream|gemma-3n|gemma-4|multimodal|pixtral|qwen.*vl|internvl|moondream/.test(hay)) {
    return { label: "Vision", color: "#8b5cf6" };
  }
  if (/codellama|coder|starcoder|\bcode\b/.test(hay)) {
    return { label: "Coding", color: "#f59e0b" };
  }
  if (/embed/.test(hay)) return { label: "Embed", color: "#6b7280" };
  return null;
}

export function ModelTraitBadge({
  trait,
  muted = false,
  colors,
}: {
  trait: ModelTrait;
  muted?: boolean;
  colors: ThemeColors;
}) {
  const { isDark } = useTheme();
  const tint = muted ? colors.textMuted : (trait.color ?? colors.primaryLight);
  const icon = modelTraitIcon(trait.label);
  const isSpeed = icon === SPEED_STAT_ICON;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 5,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? (muted ? colors.border : colors.primaryBorder) : undefined,
        backgroundColor: isDark
          ? muted
            ? colors.surface
            : colors.primaryGlow
          : colors.surface,
        flexShrink: 0,
      }}
    >
      <Ionicons name={icon} size={isSpeed ? SPEED_STAT_ICON_SIZE : 9} color={tint} />
      <Text style={{ fontSize: 9, fontWeight: "700", color: tint, lineHeight: 11 }}>
        {shortenTraitLabel(trait.label)}
      </Text>
    </View>
  );
}

function resolveStatTextColor(
  colors: ThemeColors,
  textStyle?: TextStyle | TextStyle[]
): string {
  const flat = StyleSheet.flatten([{ color: colors.textMuted }, textStyle]) as TextStyle;
  return typeof flat.color === "string" ? flat.color : colors.textMuted;
}

export function SpeedStatRow({
  text,
  colors,
  style,
  textStyle,
  iconSize = SPEED_STAT_ICON_SIZE,
}: {
  text: string;
  colors: ThemeColors;
  style?: object;
  textStyle?: TextStyle | TextStyle[];
  iconSize?: number;
}) {
  const labelColor = resolveStatTextColor(colors, textStyle);
  const labelStyle = StyleSheet.flatten([{ color: labelColor, fontSize: 12 }, textStyle]) as TextStyle;

  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0 }, style]}>
      <Ionicons
        name={SPEED_STAT_ICON}
        size={iconSize}
        color={labelColor}
        style={{ flexShrink: 0 }}
      />
      <Text style={[labelStyle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
        {text}
      </Text>
    </View>
  );
}

export function getModalityStatItem(modality: ModelModality): ModelStatItem {
  if (modality === "text") {
    return { glyph: "Aa", label: "", modality };
  }
  if (modality === "video") {
    return { icon: "videocam-outline", label: "", modality };
  }
  return { icon: "image-outline", label: "", modality };
}

export function getThinkingStatItem(
  modelId: string,
  options?: {
    catalog?: Iterable<LMModel>;
    modelType?: string | null;
    badge?: string | null;
  }
): ModelStatItem | null {
  if (
    !modelSupportsThinking(
      modelId,
      options?.catalog ?? [],
      options?.modelType,
      options?.badge
    )
  ) {
    return null;
  }
  return { icon: "bulb-outline", label: "", group: "capability" };
}

export function getModelModalityStatItems(
  modelId: string,
  catalog: Iterable<LMModel> = [],
  modelType?: string | null,
  haystack?: string | null
): ModelStatItem[] {
  const modalities = resolveModelModalities(modelId, catalog, modelType, haystack);
  return (modalities.length > 0 ? modalities : (["text"] as const)).map((modality) => ({
    ...getModalityStatItem(modality),
    group: "modality",
  }));
}

/** Text (Aa) · vision · video · thinking — shown first in model stat rows. */
export function getModelCapabilityStatItems(
  modelId: string,
  options?: {
    catalog?: Iterable<LMModel>;
    modelType?: string | null;
    badge?: string | null;
    haystack?: string | null;
  }
): ModelStatItem[] {
  const catalog = options?.catalog ?? [];
  const thinkingId = options?.haystack ? `${modelId} ${options.haystack}` : modelId;
  const modalities = getModelModalityStatItems(
    modelId,
    catalog,
    options?.modelType,
    options?.haystack
  );
  const thinking = getThinkingStatItem(thinkingId, options);
  return [...modalities, ...(thinking ? [thinking] : [])];
}

export function getModelModalityStatItemsFromModel(
  model: LMModel,
  catalog: Iterable<LMModel> = []
): ModelStatItem[] {
  return getModelModalityStatItems(model.id, catalog, model.type);
}

export function getModelDetailItems(
  model: LMModel,
  catalog: Iterable<LMModel> = []
): ModelStatItem[] {
  return getRemoteInstalledStatItems(model, catalog);
}

function formatPublisherSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveRemotePublisher(
  model: LMModel,
  parsed: ReturnType<typeof parseModelName>
): string | null {
  const idParts = model.id.split("/").filter(Boolean);
  const pathPublisher = idParts.length > 1 ? formatPublisherSlug(idParts[0]) : null;
  return (
    model.publisher ??
    model.owned_by ??
    pathPublisher ??
    (parsed.family !== "Other" ? parsed.family : null)
  );
}

function resolveRemoteDownloadSizeLabel(
  model: LMModel,
  parsed: ReturnType<typeof parseModelName>
): string | null {
  const entry = findRemoteLibraryEntry(model.id);
  return resolveFileSizeLabel(
    model.size_bytes,
    entry?.sizeLabel,
    model.id,
    parsed.displayName,
    model.params_string
  );
}

function resolveRemoteParamLabel(
  model: LMModel,
  parsed: ReturnType<typeof parseModelName>
): string | null {
  const entry = findRemoteLibraryEntry(model.id);
  return (
    extractModelParamLabel(
      model.params_string,
      model.id,
      parsed.displayName,
      entry?.params
    ) ??
    entry?.params ??
    null
  );
}

function resolveRemoteChipLabel(
  model: LMModel,
  parsed: ReturnType<typeof parseModelName>,
  downloadSize: string | null,
  paramLabel: string | null
): string | null {
  const candidates = [
    formatContext(model.max_context_length),
    parsed.quant,
    model.quantization,
    model.arch,
    model.format,
  ].filter((value): value is string => !!value);

  for (const candidate of candidates) {
    if (
      candidate !== downloadSize &&
      candidate !== paramLabel &&
      !isFileSizeLabel(candidate)
    ) {
      return candidate;
    }
  }

  return parsed.quant ?? model.quantization ?? model.arch ?? null;
}

/** Remote model rows — modality · size · chip, publisher last. Always fills gaps from id/metadata. */
export function getRemoteInstalledStatItems(
  model: LMModel,
  catalog: Iterable<LMModel> = []
): ModelStatItem[] {
  const parsed = parseModelName(model.id);
  const publisher = resolveRemotePublisher(model, parsed);
  const downloadSize = resolveRemoteDownloadSizeLabel(model, parsed);
  const paramLabel = resolveRemoteParamLabel(model, parsed);
  const chipLabel = resolveRemoteChipLabel(model, parsed, downloadSize, paramLabel);
  const capabilityItems = getModelCapabilityStatItems(model.id, {
    catalog,
    modelType: model.type,
    haystack: [
      parsed.displayName,
      parsed.family,
      model.arch,
      model.params_string,
      model.publisher,
      model.owned_by,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return [
    ...trimModelStats([
      ...capabilityItems,
      ...(paramLabel
        ? [{ icon: "hardware-chip-outline" as const, label: paramLabel, role: "param" as const }]
        : []),
      ...(chipLabel
        ? [{ icon: "hardware-chip-outline" as const, label: chipLabel }]
        : []),
      ...(publisher ? [{ icon: "business-outline" as const, label: publisher }] : []),
    ]),
    ...(downloadSize
      ? [{ icon: "document-outline" as const, label: downloadSize, role: "size" as const }]
      : []),
  ];
}

export function filterRemoteLibraryCatalog(
  installedIds: string[],
  query: string,
  modalityFilter: ModelCapabilityFilter = "all"
): RemoteLibraryEntry[] {
  return REMOTE_MODEL_LIBRARY.filter((entry) => {
    if (!isLmStudioMacDownloadModel(entry.id)) return false;
    if (isModelInstalled(installedIds, entry.id)) return false;
    if (
      !modelMatchesCapabilityFilter(
        entry.id,
        modalityFilter,
        [],
        undefined,
        entry.badge,
        remoteLibraryEntryHaystack(entry)
      )
    ) {
      return false;
    }
    return matchesLibrarySearch(
      [entry.id, entry.name, entry.publisher, entry.params, entry.description, entry.sizeLabel],
      query,
      { id: entry.id, publisher: entry.publisher }
    );
  });
}

export function getRemoteLibraryEntryStatItems(entry: {
  id: string;
  publisher: string;
  params?: string;
  sizeLabel?: string;
  description?: string;
  downloads?: number;
  downloadSource?: "lmstudio" | "huggingface";
  badge?: string;
}): ModelStatItem[] {
  const parsed = parseModelName(entry.id);
  const capabilityItems = getModelCapabilityStatItems(entry.id, {
    badge: entry.badge,
    haystack: remoteLibraryEntryHaystack(entry),
  });
  const downloadSize = resolveFileSizeLabel(entry.sizeLabel, entry.id);
  const paramLabel =
    extractModelParamLabel(entry.params, entry.id, parsed.displayName) ??
    entry.params ??
    parsed.sizeTag ??
    null;
  const chipLabel = parsed.quant ?? null;
  const publisher = entry.publisher || parsed.family;

  return [
    ...trimModelStats([
      ...capabilityItems,
      ...(paramLabel
        ? [{ icon: "hardware-chip-outline" as const, label: paramLabel, role: "param" as const }]
        : []),
      ...(chipLabel && chipLabel !== paramLabel
        ? [{ icon: "hardware-chip-outline" as const, label: chipLabel }]
        : []),
      ...(publisher ? [{ icon: "business-outline" as const, label: publisher }] : []),
    ]),
    ...(downloadSize
      ? [{ icon: "document-outline" as const, label: downloadSize, role: "size" as const }]
      : []),
  ];
}

const CAPABILITY_FILTER_OPTIONS: Array<{
  id: ModelCapabilityFilter;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  glyph?: string;
}> = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "text", label: "", glyph: "Aa" },
  { id: "image", label: "", icon: "image-outline" },
  { id: "video", label: "", icon: "videocam-outline" },
  { id: "thinking", label: "", icon: "bulb-outline" },
];

function capabilityFilterAccent(
  id: ModelCapabilityFilter,
  colors: ThemeColors,
  isDark: boolean,
  accentPurple: string
): string {
  if (id === "image") return isDark ? "#93c5fd" : "#2563eb";
  if (id === "video") return isDark ? "#fbbf24" : "#d97706";
  if (id === "thinking") return isDark ? "#fbbf24" : "#d97706";
  if (id === "text") return isDark ? colors.primaryLight : colors.textMuted;
  return isDark ? colors.primaryLight : accentPurple;
}

export function ModelModalityFilters({
  selected,
  onChange,
  colors,
  style,
}: {
  selected: ModelCapabilityFilter;
  onChange: (filter: ModelCapabilityFilter) => void;
  colors: ThemeColors;
  style?: object;
}) {
  const { isDark, accent } = useTheme();
  const styles = useMemo(() => createModalityFilterStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        {CAPABILITY_FILTER_OPTIONS.map((opt) => {
          const isSelected = opt.id === selected;
          const accentColor = isSelected
            ? capabilityFilterAccent(opt.id, colors, isDark, accent.purple)
            : isDark
              ? colors.textDim
              : colors.textMuted;

          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              accessibilityLabel={
                opt.label ||
                (opt.id === "all"
                  ? "All"
                  : opt.id === "thinking"
                    ? "Thinking"
                    : modelModalityLabel(opt.id))
              }
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && !isSelected && styles.chipPressed,
              ]}
            >
              {opt.glyph ? (
                <Text style={[styles.chipGlyph, { color: accentColor }]}>
                  {opt.glyph}
                </Text>
              ) : opt.icon ? (
                <Ionicons name={opt.icon} size={13} color={accentColor} />
              ) : null}
              {opt.label ? (
                <Text style={[styles.chipLabel, { color: accentColor }]}>
                  {opt.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createModalityFilterStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      alignSelf: "stretch",
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      backgroundColor: colors.surfaceHover,
      borderRadius: radii.md,
      padding: 3,
    },
    chip: {
      flex: 1,
      minHeight: 30,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 4,
      paddingVertical: 6,
      borderRadius: radii.sm - 2,
    },
    chipSelected: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: "600",
    },
    chipGlyph: {
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 15,
    },
  });
}

export function ModelStatLine({
  items,
  colors,
  textStyle,
  rowStyle,
  maxItems = MAX_MODEL_STATS,
  muted = false,
}: {
  items: ModelStatItem[];
  colors: ThemeColors;
  textStyle: object;
  rowStyle?: object;
  maxItems?: number;
  /** Neutral stat colors — no purple or trait accents (unselected rows). */
  muted?: boolean;
}) {
  const { isDark } = useTheme();
  const sizeItem = items.find((item) => item.role === "size" && item.label);
  const statItems = items.filter((item) => item.role !== "size");
  const visible = trimModelStats(statItems, maxItems);
  if (visible.length === 0 && !sizeItem) return null;

  const baseTextColor = resolveStatTextColor(colors, textStyle);
  const flatTextStyle = StyleSheet.flatten(textStyle);
  const statFontSize =
    typeof flatTextStyle?.fontSize === "number" ? flatTextStyle.fontSize : 11;
  const sizeFontSize = statFontSize + 2;

  const renderStatItems = (stats: ModelStatItem[]) =>
    stats.map((item, index) => {
      const isSpeedStat = item.icon === SPEED_STAT_ICON;
      const labelColor =
        muted || isSpeedStat ? baseTextColor : (item.color ?? baseTextColor);
      const prev = index > 0 ? stats[index - 1] : null;
      const sameGroup =
        !!item.group && !!prev?.group && item.group === prev.group;

      return (
        <View
          key={`${item.glyph ?? item.icon ?? "stat"}-${item.label}-${index}`}
          style={{ flexDirection: "row", alignItems: "center", flexShrink: 0 }}
        >
          {index > 0 && !sameGroup ? (
            <Text style={[textStyle, { color: colors.textDim, marginHorizontal: 4 }]}>,</Text>
          ) : null}
          {sameGroup ? <View style={{ width: 3 }} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            {item.modality ? (
              item.glyph ? (
                <Text
                  style={{
                    color: modalityAccentColor(item.modality, colors, muted, isDark),
                    fontSize: MODALITY_ICON_SIZE,
                    fontWeight: "700",
                    lineHeight: MODALITY_ICON_SIZE + 2,
                  }}
                >
                  {item.glyph}
                </Text>
              ) : item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={MODALITY_ICON_SIZE}
                  color={modalityAccentColor(item.modality, colors, muted, isDark)}
                />
              ) : null
            ) : item.group === "capability" && item.icon === "bulb-outline" ? (
              <Ionicons
                name="bulb-outline"
                size={MODALITY_ICON_SIZE}
                color={
                  muted
                    ? baseTextColor
                    : isDark
                      ? "#fbbf24"
                      : "#d97706"
                }
              />
            ) : (
              <>
                {item.glyph ? (
                  <Text
                    style={[
                      textStyle,
                      {
                        color: labelColor,
                        fontSize: 10,
                        fontWeight: "700",
                        lineHeight: 12,
                      },
                    ]}
                  >
                    {item.glyph}
                  </Text>
                ) : item.icon ? (
                  <Ionicons
                    name={item.icon}
                    size={isSpeedStat ? SPEED_STAT_ICON_SIZE : 10}
                    color={labelColor}
                  />
                ) : null}
                {item.label ? (
                  <Text
                    style={[textStyle, { color: labelColor }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      );
    });

  return (
    <View
      style={[
        rowStyle,
        {
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
        },
      ]}
    >
      {visible.length > 0 ? (
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {renderStatItems(visible)}
        </View>
      ) : (
        <View style={{ flex: 1, minWidth: 0 }} />
      )}
      {sizeItem ? (
        <Text
          style={[
            textStyle,
            {
              color: muted ? baseTextColor : (sizeItem.color ?? baseTextColor),
              fontSize: sizeFontSize,
              fontWeight: "600",
              lineHeight: sizeFontSize + 3,
              marginLeft: 8,
              paddingRight: 4,
              flexShrink: 0,
              textAlign: "right",
            },
          ]}
          numberOfLines={1}
        >
          {sizeItem.label}
        </Text>
      ) : null}
    </View>
  );
}

export function statItemsWithoutSize(items: ModelStatItem[]): ModelStatItem[] {
  return items.filter((item) => item.role !== "size");
}

export function sizeLabelFromStatItems(items: ModelStatItem[]): string | null {
  const item = items.find((entry) => entry.role === "size" && entry.label);
  return item?.label ?? null;
}

export function LibraryRowSizeLabel({
  label,
  colors,
  style,
}: {
  label: string | null | undefined;
  colors: ThemeColors;
  style?: TextStyle;
}) {
  if (!label) return null;
  return (
    <Text
      style={[
        {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: "600",
          lineHeight: 16,
          flexShrink: 0,
          textAlign: "right",
          minWidth: 48,
          alignSelf: "center",
        },
        style,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

export function LibraryCatalogRow({
  platform,
  modelId,
  provider,
  name,
  trait,
  statItems,
  onDownload,
  disabled,
  colors,
  rowStyles: rowStylesProp,
  iconMonochrome = false,
  catalogSource = null,
}: {
  platform: ModelPlatform;
  modelId?: string;
  provider: string;
  name: string;
  trait: ModelTrait | null;
  statItems: ModelStatItem[];
  onDownload: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  rowStyles?: ReturnType<typeof createRowStyles>;
  iconMonochrome?: boolean;
  catalogSource?: LibraryDownloadSource | null;
}) {
  const internalRowStyles = useMemo(() => createRowStyles(colors), [colors]);
  const rowStyles = rowStylesProp ?? internalRowStyles;

  return (
    <View style={rowStyles.catalogRow}>
      <View style={rowStyles.catalogIcon}>
        <ModelModeBadgeIcon
          platform={platform}
          modelId={modelId}
          provider={provider}
          label={name}
          size={26}
          color={colors.textMuted}
          monochrome={iconMonochrome}
          catalogSource={catalogSource}
        />
      </View>
      <View style={rowStyles.catalogBody}>
        <View style={rowStyles.titleRow}>
          <Text style={rowStyles.name} numberOfLines={1}>
            {name}
          </Text>
          {trait ? <ModelTraitBadge trait={trait} muted colors={colors} /> : null}
        </View>
        <ModelStatLine items={statItems} colors={colors} textStyle={rowStyles.stats} muted />
      </View>
      <Pressable
        onPress={onDownload}
        disabled={disabled}
        style={({ pressed }) => [
          rowStyles.catalogDownloadBtn,
          disabled && rowStyles.catalogDownloadBtnDisabled,
          pressed && !disabled && rowStyles.catalogDownloadBtnPressed,
        ]}
      >
        <Ionicons name="cloud-download-outline" size={18} color={colors.primaryLight} />
      </Pressable>
    </View>
  );
}

function ModelRow({
  model,
  isCurrent,
  isLoading,
  loadProgress,
  loadError,
  selectionLocked,
  onPress,
  platform,
  rowStyles,
  colors,
  libraryLayout,
  onLoad,
  onEject,
  onDelete,
  loadingAction,
  ejecting,
  deleting,
  managementActionsDisabled,
  modelCatalog,
  greyUnselectedIcons = false,
}: {
  model: LMModel;
  isCurrent: boolean;
  isLoading?: boolean;
  loadProgress?: number;
  loadError?: string | null;
  selectionLocked?: boolean;
  onPress: () => void;
  platform: ModelPlatform;
  rowStyles: ReturnType<typeof createRowStyles>;
  colors: ThemeColors;
  libraryLayout?: boolean;
  onLoad?: () => void;
  onEject?: () => void;
  onDelete?: () => void;
  loadingAction?: boolean;
  ejecting?: boolean;
  deleting?: boolean;
  managementActionsDisabled?: boolean;
  modelCatalog?: LMModel[];
  /** Grey platform shell + brand logo on unselected rows (model picker). */
  greyUnselectedIcons?: boolean;
}) {
  const { displayName } = parseModelName(model.id);
  const detailItems = getRemoteInstalledStatItems(model, modelCatalog);
  const trait = resolveRemoteModelTrait(model.id);
  const iconColor = isCurrent ? colors.primaryLight : colors.textDim;
  const iconMonochrome = greyUnselectedIcons && !isCurrent;
  const traitMuted = !isCurrent;
  const badgeSize = 26;

  const pct =
    loadProgress !== undefined
      ? Math.min(100, Math.max(0, Math.round(loadProgress * 100)))
      : null;

  const hasLoadProgress =
    isLoading && loadProgress !== undefined && loadProgress > 0.05;
  const indeterminateProgress = useIndeterminateLoadProgress(
    !!isLoading && !hasLoadProgress
  );
  const progressRatio = isLoading
    ? Math.min(
        1,
        Math.max(0.03, hasLoadProgress ? (loadProgress ?? 0) : indeterminateProgress)
      )
    : 0;
  const actionActive = !!(isLoading || ejecting);

  const titleContent = (
    <>
      <View style={rowStyles.titleRow}>
        <Text
          style={[
            libraryLayout ? rowStyles.libraryName : rowStyles.name,
            isCurrent && rowStyles.nameSelected,
          ]}
          numberOfLines={isCurrent ? 2 : 1}
        >
          {displayName}
        </Text>
        {trait ? (
          <ModelTraitBadge trait={trait} muted={traitMuted} colors={colors} />
        ) : null}
      </View>
      <ModelStatLine
        items={detailItems}
        colors={colors}
        textStyle={rowStyles.stats}
        muted={traitMuted}
      />
    </>
  );

  const modelIcon = (
    <View style={libraryLayout ? rowStyles.libraryIcon : rowStyles.modelIcon}>
      <ModelModeBadgeIcon
        platform={platform}
        modelId={model.id}
        provider={model.publisher ?? model.owned_by}
        size={badgeSize}
        color={iconColor}
        monochrome={iconMonochrome}
      />
    </View>
  );

  const loadingLine =
    isLoading && loadError ? (
      <Text
        style={libraryLayout ? rowStyles.libraryLoadError : rowStyles.loadLineError}
        numberOfLines={1}
      >
        {loadError}
      </Text>
    ) : !libraryLayout && isLoading ? (
      loadError ? (
        <Text style={rowStyles.loadLineError} numberOfLines={1}>
          {loadError}
        </Text>
      ) : (
        <View style={rowStyles.loadLine}>
          <ActivityIndicator size={12} color={colors.primaryLight} />
          <Text style={rowStyles.loadLineText} numberOfLines={1}>
            Loading…{pct !== null ? ` ${pct}%` : ""}
          </Text>
        </View>
      )
    ) : null;

  const row = libraryLayout ? (
    <View style={rowStyles.libraryWrap}>
      <View
        style={[
          rowStyles.libraryRow,
          isCurrent && !isLoading && rowStyles.libraryRowSelected,
        ]}
      >
        {ejecting ? <ModelEjectProgressFill active /> : null}
        {isLoading ? (
          <ModelLoadProgressFill progress={progressRatio} colors={colors} />
        ) : null}
        <ModelRowActionMute
          active={actionActive}
          mode={ejecting ? "eject" : "load"}
          progress={progressRatio}
          style={rowStyles.libraryRowContent}
        >
          {modelIcon}
          <Pressable
            style={rowStyles.libraryBody}
            onPress={onPress}
            disabled={isLoading || selectionLocked || ejecting}
          >
            {titleContent}
          </Pressable>
        </ModelRowActionMute>
      </View>
      {loadingLine}
    </View>
  ) : (
    <View style={rowStyles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={isLoading || selectionLocked}
        style={({ pressed }) => [
          rowStyles.container,
          isCurrent && rowStyles.selected,
          isLoading && rowStyles.loading,
          pressed && !isLoading && !selectionLocked && rowStyles.pressed,
        ]}
      >
        {modelIcon}
        <View style={rowStyles.left}>{titleContent}</View>
      </Pressable>
      {loadingLine}
    </View>
  );

  if (libraryLayout && (onLoad || onDelete || onEject)) {
    return (
      <SwipeToDeleteRow
        onLoad={onLoad}
        onDelete={onDelete}
        onEject={onEject}
        disabled={!!deleting}
        loadDisabled={!!loadingAction || !!isLoading || !!selectionLocked || !!managementActionsDisabled}
        ejectDisabled={!!ejecting}
        backgroundColor={colors.bgElevated}
      >
        {row}
      </SwipeToDeleteRow>
    );
  }

  return row;
}

function SectionHeader({
  title,
  sectionStyles,
  colors,
}: {
  title: string;
  sectionStyles: ReturnType<typeof createSectionStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={[sectionStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

// ─── Shared remote model list (chat + settings) ───────────────────────────────

export const LIBRARY_INSTALLED_PAGE_SIZE = LIBRARY_PAGE_SIZE;
export const LIBRARY_DOWNLOAD_PAGE_SIZE = LIBRARY_PAGE_SIZE;

export function LibrarySeeMoreButton({
  onPress,
  disabled,
  loading,
  colors,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  colors: ThemeColors;
}) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginTop: 4,
          paddingVertical: 8,
        },
        btnPressed: { opacity: 0.65 },
        btnDisabled: { opacity: 0.45 },
        text: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
      }),
    [colors]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        pressed && styles.btnPressed,
        (disabled || loading) && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <>
          <Text style={styles.text}>See more</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textDim} />
        </>
      )}
    </Pressable>
  );
}

export function RemoteModelList({
  active,
  selectedModelId,
  onSelect,
  persistDefault = false,
  bottomInset = 0,
  browseMode = false,
  suggestedLimit = 24,
  searchQuery,
  hideSearch = false,
  listHeader,
  listFooter,
  reloadKey = 0,
  serverUrl,
  loadOnSelect = false,
  useSettingsDefault = false,
  platform,
  activeLoadingModelId,
  activeLoadingProgress,
  activeLoadingError,
  libraryLayout,
  browseOnly,
  onEjectModel,
  onDeleteModel,
  ejectingModelId,
  deletingModelId,
  managementActionsDisabled,
  showModalityFilters,
  modalityFilter: controlledModalityFilter,
  onModalityFilterChange,
  onActionComplete,
  onOpenLibrary,
  quickAccessCatalog = false,
  greyUnselectedIcons = false,
}: {
  active: boolean;
  selectedModelId?: string;
  onSelect: (modelId: string | null) => void;
  persistDefault?: boolean;
  bottomInset?: number;
  browseMode?: boolean;
  suggestedLimit?: number;
  searchQuery?: string;
  hideSearch?: boolean;
  listHeader?: React.ReactNode;
  listFooter?: React.ReactNode;
  reloadKey?: number;
  /** Override settings.baseUrl for fetching (e.g. direct Mac URL when chatting via Hub). */
  serverUrl?: string;
  /** Load model on LM Studio Mac/server when a row is selected. */
  loadOnSelect?: boolean;
  /** Fall back to settings.defaultModel when selectedModelId is empty. */
  useSettingsDefault?: boolean;
  /** Override platform icon (e.g. Mac library always uses PC). */
  platform?: ModelPlatform;
  /** Parent-driven load state (e.g. chat model picker). */
  activeLoadingModelId?: string | null;
  activeLoadingProgress?: number;
  activeLoadingError?: string | null;
  /** Installed rows — swipe right to load, swipe left to eject. */
  libraryLayout?: boolean;
  /** Library browse mode — view and download only (no load/eject). */
  browseOnly?: boolean;
  onEjectModel?: (modelId: string) => void;
  onDeleteModel?: (modelId: string) => void;
  ejectingModelId?: string | null;
  deletingModelId?: string | null;
  managementActionsDisabled?: boolean;
  /** Show All / Text / Images / Video filter chips above the list. */
  showModalityFilters?: boolean;
  modalityFilter?: ModelCapabilityFilter;
  onModalityFilterChange?: (filter: ModelCapabilityFilter) => void;
  /** Called after a library load/eject action finishes (e.g. close chat picker). */
  onActionComplete?: () => void;
  /** Chat picker: catalog rows open the library instead of selecting. */
  onOpenLibrary?: () => void;
  /** Chat picker: curated download rows at the top instead of search + full catalog. */
  quickAccessCatalog?: boolean;
  /** Grey platform shell + brand logo on unselected rows (model picker). */
  greyUnselectedIcons?: boolean;
}) {
  const { settings, updateSettings, account } = useApp();
  const colors = useAccentPalette();
  const styles = useMemo(() => createListStyles(colors), [colors]);
  const rowStyles = useMemo(() => createRowStyles(colors), [colors]);
  const sectionStyles = useMemo(() => createSectionStyles(colors), [colors]);

  const [models, setModels] = useState<LMModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [installedVisibleCount, setInstalledVisibleCount] = useState(LIBRARY_INSTALLED_PAGE_SIZE);
  const [internalModalityFilter, setInternalModalityFilter] =
    useState<ModelCapabilityFilter>("all");
  const modalityFilter = controlledModalityFilter ?? internalModalityFilter;
  const setModalityFilter = onModalityFilterChange ?? setInternalModalityFilter;
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [internalEjectingId, setInternalEjectingId] = useState<string | null>(null);
  const effectiveBaseUrl = serverUrl ?? settings.baseUrl;
  const listBaseUrl =
    serverUrl ?? resolveManagementBaseUrl(settings) ?? effectiveBaseUrl;
  const listApiKey = resolveManagementApiKey(settings, account);
  const remotePlatform: ModelPlatform =
    platform ?? (isHubUrl(effectiveBaseUrl) ? "hub" : "pc");

  const effectiveSelectedId = useSettingsDefault
    ? (selectedModelId ?? settings.defaultModel)
    : selectedModelId;
  const rowLoadingId = activeLoadingModelId ?? loadingModelId;
  const SUGGESTED_LIMIT = suggestedLimit;
  const prevActiveLoadingRef = useRef<string | null>(null);

  const load = useCallback(async (): Promise<LMModel[]> => {
    if (!active) return [];
    setLoading(true);
    setError(null);
    try {
      const m = await fetchModels(listBaseUrl, listApiKey);
      setModels(m);
      return m;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect to LM Studio");
      return [];
    } finally {
      setLoading(false);
    }
  }, [active, listBaseUrl, listApiKey]);

  const isSearchControlled = searchQuery !== undefined;
  const effectiveSearch = isSearchControlled ? (searchQuery ?? "") : search;

  useEffect(() => {
    if (active) {
      if (!isSearchControlled) setSearch("");
      setShowAll(browseMode);
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
      if (controlledModalityFilter === undefined) {
        setInternalModalityFilter("all");
      }
      load();
    }
  }, [active, browseMode, load, reloadKey, isSearchControlled, controlledModalityFilter]);

  useEffect(() => {
    if (active && browseOnly && libraryLayout) {
      setInstalledVisibleCount(LIBRARY_INSTALLED_PAGE_SIZE);
    }
  }, [active, browseOnly, libraryLayout, effectiveSearch, modalityFilter]);

  useEffect(() => {
    const prev = prevActiveLoadingRef.current;
    prevActiveLoadingRef.current = activeLoadingModelId ?? null;
    if (prev && !activeLoadingModelId && !activeLoadingError && libraryLayout && active) {
      void load();
    }
  }, [activeLoadingModelId, activeLoadingError, libraryLayout, active, load]);

  const filteredModels = useMemo(() => {
    const q = effectiveSearch.trim().toLowerCase();
    let filtered = models.filter((m) => {
      const parsed = parseModelName(m.id);
      const haystack = [
        m.id,
        parsed.displayName,
        parsed.family,
        m.arch,
        m.type,
        m.params_string,
        m.publisher,
        m.owned_by,
      ]
        .filter(Boolean)
        .join(" ");
      return modelMatchesCapabilityFilter(m.id, modalityFilter, models, m.type, null, haystack);
    });

    filtered = q
      ? filtered.filter((m) => {
          const parsed = parseModelName(m.id);
          const hay = [
            m.id,
            parsed.displayName,
            parsed.family,
            parsed.quant,
            parsed.sizeTag,
            m.arch,
            m.type,
            m.publisher,
            m.owned_by,
            m.quantization,
            m.state,
            m.format,
            m.compatibility_type,
            m.params_string,
            m.size_bytes ? formatFileSize(m.size_bytes) : null,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return matchesModelSearchQuery(hay, q);
        })
      : filtered;

    if (
      libraryLayout ||
      browseMode ||
      q ||
      showAll ||
      filtered.length <= SUGGESTED_LIMIT
    ) {
      return filtered;
    }

    const selected = effectiveSelectedId
      ? filtered.filter((m) => m.id === effectiveSelectedId)
      : [];
    const rest = filtered.filter((m) => m.id !== effectiveSelectedId);
    const sortedRest = [...rest].sort((a, b) => {
      const pa = parseModelName(a.id);
      const pb = parseModelName(b.id);

      if (pa.family === "Other" && pb.family !== "Other") return 1;
      if (pb.family === "Other" && pa.family !== "Other") return -1;

      const familyCmp = pa.family.localeCompare(pb.family);
      if (familyCmp !== 0) return familyCmp;
      return pa.displayName.localeCompare(pb.displayName);
    });

    return [...selected, ...sortedRest].slice(0, SUGGESTED_LIMIT);
  }, [
    models,
    effectiveSearch,
    showAll,
    effectiveSelectedId,
    browseMode,
    SUGGESTED_LIMIT,
    modalityFilter,
    libraryLayout,
  ]);

  const libraryModels = useMemo(() => {
    if (!libraryLayout) return [];
    return [...filteredModels].sort((a, b) =>
      parseModelName(a.id).displayName.localeCompare(parseModelName(b.id).displayName)
    );
  }, [filteredModels, libraryLayout]);

  const visibleLibraryModels = useMemo(() => {
    if (!browseOnly || !libraryLayout) return libraryModels;
    return libraryModels.slice(0, installedVisibleCount);
  }, [libraryModels, browseOnly, libraryLayout, installedVisibleCount]);

  const hasMoreInstalled =
    browseOnly && libraryLayout && libraryModels.length > installedVisibleCount;

  const { loaded: loadedLibraryModels, installed: installedLibraryModels } = useMemo(() => {
    if (!libraryLayout) return { loaded: [] as LMModel[], installed: [] as LMModel[] };
    return partitionLibraryModels(libraryModels, {
      activeModelId: effectiveSelectedId,
      singleModelMode: settings.singleModelMode !== false,
    });
  }, [libraryModels, libraryLayout, effectiveSelectedId, settings.singleModelMode]);

  const installedIds = useMemo(() => models.map((model) => model.id), [models]);

  const catalogEntries = useMemo(() => {
    if (!libraryLayout || !onOpenLibrary || browseMode) return [];
    if (quickAccessCatalog) {
      return getQuickAccessRemoteLibrary(installedIds, modalityFilter);
    }
    return filterRemoteLibraryCatalog(installedIds, effectiveSearch, modalityFilter);
  }, [
    libraryLayout,
    onOpenLibrary,
    browseMode,
    quickAccessCatalog,
    installedIds,
    effectiveSearch,
    modalityFilter,
  ]);

  const sections = useMemo(() => {
    if (libraryLayout) return [];

    const groups: Record<string, LMModel[]> = {};
    for (const m of filteredModels) {
      const { family } = parseModelName(m.id);
      if (!groups[family]) groups[family] = [];
      groups[family].push(m);
    }

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return a.localeCompare(b);
      })
      .map(([title, data]) => ({ title, data }));
  }, [filteredModels, libraryLayout]);

  const activeEjectingId = ejectingModelId ?? internalEjectingId;

  async function performEject(model: LMModel) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInternalEjectingId(model.id);
    try {
      await Promise.all([
        ejectRemoteModel(settings, model.id, account?.token),
        new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
      ]);
    } catch (e: unknown) {
      setLoadError(formatLoadError(e, settings));
      await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
      setInternalEjectingId(null);
      return;
    }

    if (isSameModelId(effectiveSelectedId, model.id)) {
      if (persistDefault) {
        await updateSettings({ defaultModel: "" });
      }
      setLoadingModelId(null);
      setLoadProgress(0);
      setLoadError(null);
      await Promise.resolve(onSelect(null));
    }
    await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
    setInternalEjectingId(null);
    await load();
    onActionComplete?.();
  }

  async function handleSelect(modelId: string) {
    const isInstalled = models.some((model) => isSameModelId(model.id, modelId));
    if (libraryLayout && onOpenLibrary && !isInstalled) {
      onOpenLibrary();
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isSameModelId(effectiveSelectedId, modelId)) {
      if (!browseOnly) {
        const currentModel = models.find((m) => isSameModelId(m.id, modelId));
        if (currentModel) {
          void performEject(currentModel);
        }
      }
      return;
    }

    const showLoadState = (loadOnSelect || libraryLayout) && !browseOnly;
    if (showLoadState) {
      setLoadingModelId(modelId);
      setLoadProgress(0.03);
      setLoadError(null);
    }

    const loadStarted = Date.now();

    if (loadOnSelect) {
      try {
        await loadRemoteModelOnSystem(settings, modelId, {
          onProgress: setLoadProgress,
          previousModelId: effectiveSelectedId,
          accountToken: account?.token,
        });
      } catch (e: unknown) {
        setLoadError(formatLoadError(e, settings));
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setLoadingModelId(null);
        setLoadProgress(0);
        return;
      }
    }

    try {
      const refreshed = loadOnSelect ? await load() : models;
      const canonicalId = resolveCanonicalModelId(refreshed, modelId);

      if (persistDefault) {
        await updateSettings({ defaultModel: canonicalId });
      }
      await Promise.resolve(onSelect(canonicalId));
    } finally {
      if (showLoadState) {
        const remaining = MODEL_ROW_ACTION_MIN_MS - (Date.now() - loadStarted);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setLoadingModelId(null);
        setLoadProgress(0);
        if (libraryLayout) {
          await load();
        }
        onActionComplete?.();
      }
    }
  }

  const listHorizontalPadding = 16;
  const hasInstalledLibraryModels = browseOnly
    ? libraryModels.length > 0
    : loadedLibraryModels.length > 0 || installedLibraryModels.length > 0;
  const listIsEmpty = libraryLayout
    ? !hasInstalledLibraryModels && catalogEntries.length === 0
    : sections.length === 0;

  const renderModelRow = (item: LMModel) => (
    <ModelRow
      model={item}
      platform={remotePlatform}
      isCurrent={isSameModelId(effectiveSelectedId, item.id)}
      isLoading={rowLoadingId === item.id}
      loadProgress={
        rowLoadingId === item.id ? (activeLoadingProgress ?? loadProgress) : undefined
      }
      loadError={rowLoadingId === item.id ? (activeLoadingError ?? loadError) : undefined}
      selectionLocked={!!activeLoadingModelId && rowLoadingId !== item.id}
      onPress={() => handleSelect(item.id)}
      rowStyles={rowStyles}
      colors={colors}
      libraryLayout={libraryLayout}
      onLoad={
        libraryLayout && !browseOnly && !isModelInMemory(item)
          ? () => handleSelect(item.id)
          : undefined
      }
      onEject={
        libraryLayout && !browseOnly && isModelInMemory(item)
          ? () => void performEject(item)
          : undefined
      }
      onDelete={onDeleteModel ? () => onDeleteModel(item.id) : undefined}
      loadingAction={rowLoadingId === item.id}
      ejecting={activeEjectingId === item.id}
      deleting={deletingModelId === item.id}
      managementActionsDisabled={managementActionsDisabled}
      modelCatalog={models}
      greyUnselectedIcons={greyUnselectedIcons}
    />
  );

  const librarySectionStyles = useMemo(() => createLibrarySectionStyles(colors), [colors]);

  const renderLibrarySections = () => (
    <>
      {listHeader ? <>{listHeader}</> : null}
      {onOpenLibrary &&
      listIsEmpty &&
      (effectiveSearch.trim() || modalityFilter !== "all") ? (
        <View style={styles.pickerEmpty}>
          <Ionicons name="search-outline" size={28} color={colors.textDim} />
          <Text style={styles.emptyTitle}>
            {effectiveSearch.trim() ? "No models match your search" : "No models match your filters"}
          </Text>
          <Text style={[styles.centerText, { textAlign: "center", maxWidth: 280 }]}>
            {modalityFilter !== "all"
              ? `Try All or another capability, or search for a different ${capabilityFilterLabel(modalityFilter) || "model"}.`
              : "Try a different name, provider, or size."}
          </Text>
        </View>
      ) : null}
      {onOpenLibrary &&
      !hasInstalledLibraryModels &&
      catalogEntries.length === 0 &&
      !effectiveSearch.trim() &&
      (modalityFilter === "all" || quickAccessCatalog) ? (
        <View style={styles.pickerEmpty}>
          <Ionicons name="download-outline" size={28} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No models on system</Text>
          <Text style={[styles.centerText, { textAlign: "center", maxWidth: 280 }]}>
            Download a model from the Model Library to run on your Mac.
          </Text>
        </View>
      ) : null}
      {browseOnly && libraryModels.length > 0 ? (
        <View style={librarySectionStyles.sectionBlock}>
          <Text style={librarySectionStyles.sectionTitle}>Installed on system</Text>
          {visibleLibraryModels.map((item) => (
            <AnimatedLibraryRow key={item.id} rowKey={item.id}>
              {renderModelRow(item)}
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
      {!browseOnly && loadedLibraryModels.length > 0 ? (
        <View style={librarySectionStyles.sectionBlock}>
          <Text style={librarySectionStyles.sectionTitle}>Loaded in memory</Text>
          <SectionHintLines colors={colors} line="Swipe left to eject" />
          {loadedLibraryModels.map((item) => (
            <AnimatedLibraryRow key={item.id} rowKey={item.id}>
              {renderModelRow(item)}
            </AnimatedLibraryRow>
          ))}
        </View>
      ) : null}
      {!browseOnly && installedLibraryModels.length > 0 ? (
        <View
          style={[
            librarySectionStyles.sectionBlock,
            loadedLibraryModels.length > 0 ? librarySectionStyles.sectionSpaced : undefined,
          ]}
        >
          <Text style={librarySectionStyles.sectionTitle}>Installed on system</Text>
          <SectionHintLines colors={colors} line="Swipe right to load" />
          {installedLibraryModels.map((item) => (
            <AnimatedLibraryRow key={item.id} rowKey={item.id}>
              {renderModelRow(item)}
            </AnimatedLibraryRow>
          ))}
        </View>
      ) : null}
      {onOpenLibrary && catalogEntries.length > 0 ? (
        <View
          style={[
            librarySectionStyles.sectionBlock,
            hasInstalledLibraryModels ? librarySectionStyles.sectionSpaced : undefined,
          ]}
        >
          <Text style={librarySectionStyles.sectionTitle}>Quick download</Text>
          <SectionHintLines colors={colors} line="Tap download to open Model Library" />
          {catalogEntries.map((entry) => (
            <LibraryCatalogRow
              key={entry.id}
              platform={remotePlatform}
              modelId={entry.id}
              provider={entry.publisher}
              name={resolveRemoteLibraryDisplayName(entry)}
              trait={
                entry.badge
                  ? { label: entry.badge, color: entry.badgeColor }
                  : null
              }
              statItems={getRemoteLibraryEntryStatItems(entry)}
              onDownload={onOpenLibrary}
              rowStyles={rowStyles}
              colors={colors}
              iconMonochrome={greyUnselectedIcons}
              catalogSource={resolveEntryCatalogSource(entry)}
            />
          ))}
        </View>
      ) : null}
      {onOpenLibrary ? (
        <Pressable
          style={({ pressed }) => [
            styles.openLibraryBtn,
            pressed && styles.openLibraryBtnPressed,
          ]}
          onPress={onOpenLibrary}
        >
          <Ionicons name="library-outline" size={16} color={colors.textMuted} />
          <Text style={styles.openLibraryBtnText}>Open Model Library</Text>
        </Pressable>
      ) : null}
    </>
  );

  const listFooterContent = () => {
    const toggle =
      !browseMode &&
      effectiveSearch.trim().length === 0 &&
      models.length > SUGGESTED_LIMIT ? (
        <View style={styles.toggleWrap}>
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={({ pressed }) => [styles.toggleBtn, pressed && styles.toggleBtnPressed]}
          >
            <Text style={styles.toggleBtnText}>
              {showAll ? "Show fewer models" : `Show all models (${models.length})`}
            </Text>
          </Pressable>
        </View>
      ) : null;

    if (!toggle && !listFooter) return null;
    return (
      <>
        {listFooter}
        {toggle}
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Connecting to LM Studio…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ThemedError
          variant="panel"
          message={error}
          kind="network"
          title="Can't reach LM Studio"
          onDismiss={() => setError(null)}
          onRetry={load}
        />
      </View>
    );
  }

  if (models.length === 0 && !(libraryLayout && onOpenLibrary)) {
    if (listHeader) {
      return (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: listHorizontalPadding,
            paddingBottom: bottomInset + 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {listHeader}
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={32} color={colors.textDim} />
            </View>
            <Text style={styles.emptyTitle}>No models installed</Text>
            <Text style={[styles.centerText, { textAlign: "center" }]}>
              Download a model below, then load it in LM Studio if needed.
            </Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Ionicons name="refresh" size={15} color={colors.primaryLight} />
              <Text style={styles.retryText}>Refresh</Text>
            </Pressable>
          </View>
          {listFooter}
        </ScrollView>
      );
    }

    return (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cube-outline" size={32} color={colors.textDim} />
        </View>
        <Text style={styles.emptyTitle}>No models loaded</Text>
        <Text style={[styles.centerText, { textAlign: "center" }]}>
          Open LM Studio and load a model, then tap Retry.
        </Text>
        <Pressable onPress={load} style={styles.retryBtn}>
          <Ionicons name="refresh" size={15} color={colors.primaryLight} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.listRoot}>
      {!hideSearch && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textDim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search models…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      )}

      {showModalityFilters ? (
        <ModelModalityFilters
          selected={modalityFilter}
          onChange={setModalityFilter}
          colors={colors}
        />
      ) : null}

      {listIsEmpty && !(libraryLayout && onOpenLibrary) ? (
        listHeader ? (
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={{
              paddingHorizontal: listHorizontalPadding,
              paddingBottom: bottomInset + 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {listHeader}
            <View style={styles.center}>
              <Text style={styles.centerText}>
                {effectiveSearch.trim()
                  ? `No results for "${effectiveSearch}"`
                  : modalityFilter !== "all"
                    ? `No ${capabilityFilterLabel(modalityFilter) || "matching"} models match your filters.`
                    : "No models installed yet — download one below."}
              </Text>
            </View>
            {listFooter}
          </ScrollView>
        ) : (
          <View style={[styles.center, styles.listScroll]}>
            <Text style={styles.centerText}>
              {effectiveSearch.trim()
                ? `No results for "${effectiveSearch}"`
                : modalityFilter !== "all"
                  ? `No ${capabilityFilterLabel(modalityFilter) || "matching"} models match your filters.`
                  : "No models match your filters."}
            </Text>
          </View>
        )
      ) : libraryLayout ? (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={{
            paddingHorizontal: listHorizontalPadding,
            paddingBottom: bottomInset + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderLibrarySections()}
          {listFooterContent()}
        </ScrollView>
      ) : (
        <GestureSectionList
          style={styles.listScroll}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: listHorizontalPadding,
            paddingBottom: bottomInset + 24,
          }}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader ? () => <>{listHeader}</> : undefined}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} sectionStyles={sectionStyles} colors={colors} />
          )}
          renderItem={({ item }) => renderModelRow(item)}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 6 }} />}
          ListFooterComponent={listFooterContent}
        />
      )}
    </View>
  );
}

// ─── Full browse modal (chat + settings) ──────────────────────────────────────

type BrowserProps = {
  visible: boolean;
  onClose: () => void;
  onSelect?: (modelId: string | null) => void;
  selectedModelId?: string;
  persistDefault?: boolean;
  title?: string;
};

export function RemoteModelsBrowser({
  visible,
  onClose,
  onSelect,
  selectedModelId,
  persistDefault,
  title = "Browse Models",
}: BrowserProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);

  const shouldPersistDefault = persistDefault ?? !onSelect;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[modalStyles.pageContainer, { paddingTop: insets.top }]}>
        <View style={modalStyles.pageHandleWrap}>
          <View style={modalStyles.pageHandle} />
        </View>
        <View style={modalStyles.pageHeader}>
          <Pressable onPress={onClose} hitSlop={8} style={modalStyles.pageHeaderBtn}>
            <View style={modalStyles.closeCircle}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </View>
          </Pressable>
          <Text style={modalStyles.pageTitle}>{title}</Text>
          <View style={modalStyles.pageHeaderBtn} />
        </View>

        <RemoteModelList
          active={visible}
          selectedModelId={selectedModelId}
          onSelect={(modelId) => {
            onSelect?.(modelId);
            onClose();
          }}
          persistDefault={shouldPersistDefault}
          bottomInset={insets.bottom}
          browseMode
          loadOnSelect
          useSettingsDefault
        />
      </View>
    </Modal>
  );
}

// ─── Settings modal wrapper ───────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect?: (modelId: string | null) => void;
  selectedModelId?: string;
}

export default function ModelPicker(props: Props) {
  return <RemoteModelsBrowser {...props} title="Browse Models" />;
}

function createListStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listRoot: {
      flex: 1,
      width: "100%",
      alignSelf: "stretch",
    },
    listScroll: {
      flex: 1,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.inputText,
      fontSize: 15,
      padding: 0,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 8 },
    centerText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 20,
      backgroundColor: colors.primaryGlow,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    retryText: { color: colors.primaryLight, fontWeight: "600", fontSize: 14 },
    toggleWrap: { paddingTop: 6, paddingBottom: 2 },
    toggleBtn: {
      marginHorizontal: 0,
      marginBottom: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleBtnPressed: { opacity: 0.85 },
    toggleBtnText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
    pickerEmpty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 8,
    },
    openLibraryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    openLibraryBtnPressed: { opacity: 0.75 },
    openLibraryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  });
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 2,
    },
    container: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    selected: {
      backgroundColor: colors.primaryGlow,
      borderRadius: radii.sm,
    },
    loading: { opacity: 0.55 },
    pressed: { opacity: 0.75 },
    mainPress: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      minWidth: 0,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
      flexShrink: 0,
    },
    actionBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
    },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnPressed: { opacity: 0.7 },
    modelIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    left: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    name: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 22, flexShrink: 1 },
    nameSelected: { color: colors.primaryLight },
    stats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    loadLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginLeft: 56,
      marginTop: 2,
      marginBottom: 6,
      paddingRight: 4,
    },
    loadLineText: {
      flex: 1,
      minWidth: 0,
      color: colors.primaryLight,
      fontSize: 12,
      fontWeight: "500",
    },
    loadLineError: {
      marginLeft: 56,
      marginTop: 2,
      marginBottom: 6,
      paddingRight: 4,
      color: colors.error,
      fontSize: 12,
    },
    libraryWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    libraryRow: {
      position: "relative",
      overflow: "hidden",
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    libraryRowContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 1,
    },
    libraryRowSelected: {
      backgroundColor: colors.primaryGlow,
      borderRadius: radii.sm,
    },
    libraryIcon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    libraryBody: { flex: 1, minWidth: 0 },
    libraryName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 22,
      flexShrink: 1,
    },
    libraryLoadLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginLeft: 54,
      marginTop: -4,
      marginBottom: 6,
      paddingRight: 4,
    },
    libraryLoadError: {
      marginLeft: 54,
      marginTop: -4,
      marginBottom: 6,
      paddingRight: 4,
      color: colors.error,
      fontSize: 12,
    },
    catalogRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      marginBottom: 2,
    },
    catalogIcon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    catalogBody: { flex: 1, minWidth: 0 },
    catalogDownloadBtn: {
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
    catalogDownloadBtnDisabled: { opacity: 0.6 },
    catalogDownloadBtnPressed: { opacity: 0.8 },
  });
}

function createLibrarySectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionBlock: { marginBottom: 8 },
    sectionSpaced: { marginTop: 8 },
    sectionTitle: createSectionSubtitleStyle(colors),
  });
}

function createSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingTop: 14,
      paddingBottom: 8,
    },
    title: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    line: {
      flex: 1,
      height: 1,
    },
  });
}
