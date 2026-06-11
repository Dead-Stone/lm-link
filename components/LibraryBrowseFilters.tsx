import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_LIBRARY_BROWSE_FILTERS,
  LIBRARY_PROVIDER_FILTER_OPTIONS,
  LibraryBrowseFilters,
  libraryBrowseFiltersActive,
  LibraryPlatformFilter,
  LibrarySourceFilter,
} from "../lib/library-filters";
import { ModelBrandKey } from "../lib/model-provider-logos";
import { capabilityFilterLabel } from "../lib/vision-models";
import { radii, ThemeColors } from "../lib/theme";
import { ModelModalityFilters } from "./ModelPicker";

type Props = {
  filters: LibraryBrowseFilters;
  onChange: (filters: LibraryBrowseFilters) => void;
  colors: ThemeColors;
  style?: object;
};

const PLATFORM_OPTIONS: Array<{
  id: LibraryPlatformFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "system", label: "System", icon: "desktop-outline" },
  { id: "phone", label: "Phone", icon: "phone-portrait-outline" },
];

const SOURCE_OPTIONS: Array<{
  id: LibrarySourceFilter;
  label: string;
  short: string;
}> = [
  { id: "all", label: "All sources", short: "All" },
  { id: "lmstudio", label: "LM Studio", short: "LM Studio" },
  { id: "huggingface", label: "Hugging Face", short: "Hugging Face" },
];

function platformLabel(id: LibraryPlatformFilter): string {
  return PLATFORM_OPTIONS.find((o) => o.id === id)?.label ?? "All";
}

function sourceLabel(id: LibrarySourceFilter): string {
  return SOURCE_OPTIONS.find((o) => o.id === id)?.short ?? "All";
}

function providerLabel(id: ModelBrandKey | "all"): string {
  return LIBRARY_PROVIDER_FILTER_OPTIONS.find((o) => o.id === id)?.label ?? "All";
}

function SegmentedRow<T extends string>({
  options,
  selected,
  onSelect,
  colors,
  styles,
}: {
  options: Array<{ id: T; label: string; icon?: keyof typeof Ionicons.glyphMap }>;
  selected: T;
  onSelect: (id: T) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createFilterStyles>;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const isSelected = opt.id === selected;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              pressed && !isSelected && styles.segmentPressed,
            ]}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={14}
                color={isSelected ? colors.primaryLight : colors.textDim}
              />
            ) : null}
            <Text
              style={[
                styles.segmentLabel,
                { color: isSelected ? colors.primaryLight : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LibraryActiveFilterChips({
  filters,
  onChange,
  colors,
}: {
  filters: LibraryBrowseFilters;
  onChange: (filters: LibraryBrowseFilters) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createFilterStyles(colors), [colors]);
  if (!libraryBrowseFiltersActive(filters)) return null;

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.platform !== "all") {
    chips.push({
      key: "platform",
      label: platformLabel(filters.platform),
      clear: () => onChange({ ...filters, platform: "all" }),
    });
  }
  if (filters.source !== "all") {
    chips.push({
      key: "source",
      label: sourceLabel(filters.source),
      clear: () => onChange({ ...filters, source: "all" }),
    });
  }
  if (filters.provider !== "all") {
    chips.push({
      key: "provider",
      label: providerLabel(filters.provider),
      clear: () => onChange({ ...filters, provider: "all" }),
    });
  }
  if (filters.capability !== "all") {
    chips.push({
      key: "capability",
      label: capabilityFilterLabel(filters.capability),
      clear: () => onChange({ ...filters, capability: "all" }),
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.activeChipsRow}
      style={styles.activeChipsScroll}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.clear}
          style={({ pressed }) => [styles.activeChip, pressed && { opacity: 0.78 }]}
        >
          <Text style={styles.activeChipText}>{chip.label}</Text>
          <Ionicons name="close" size={13} color={colors.primaryLight} />
        </Pressable>
      ))}
      <Pressable
        onPress={() => onChange(DEFAULT_LIBRARY_BROWSE_FILTERS)}
        style={({ pressed }) => [styles.clearAllChip, pressed && { opacity: 0.78 }]}
      >
        <Text style={styles.clearAllChipText}>Clear all</Text>
      </Pressable>
    </ScrollView>
  );
}

export function LibraryBrowseFilterButton({
  filters,
  onChange,
  colors,
  style,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createFilterStyles(colors), [colors]);
  const active = libraryBrowseFiltersActive(filters);

  const setPlatform = (platform: LibraryPlatformFilter) => {
    onChange({ ...filters, platform });
  };
  const setSource = (source: LibrarySourceFilter) => {
    onChange({ ...filters, source });
  };
  const setProvider = (provider: ModelBrandKey | "all") => {
    onChange({ ...filters, provider });
  };
  const setCapability = (capability: LibraryBrowseFilters["capability"]) => {
    onChange({ ...filters, capability });
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="Filter models"
        hitSlop={6}
        style={({ pressed }) => [styles.filterBtn, style, pressed && { opacity: 0.78 }]}
      >
        <Ionicons
          name="funnel-outline"
          size={17}
          color={active ? colors.primaryLight : colors.textDim}
        />
        {active ? <View style={styles.filterDot} /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Platform</Text>
            <SegmentedRow
              options={PLATFORM_OPTIONS}
              selected={filters.platform}
              onSelect={setPlatform}
              colors={colors}
              styles={styles}
            />

            <Text style={styles.sectionLabel}>Source</Text>
            <SegmentedRow
              options={SOURCE_OPTIONS.map((o) => ({ id: o.id, label: o.short }))}
              selected={filters.source}
              onSelect={setSource}
              colors={colors}
              styles={styles}
            />

            <Text style={styles.sectionLabel}>Capabilities</Text>
            <ModelModalityFilters
              selected={filters.capability}
              onChange={setCapability}
              colors={colors}
              style={styles.capabilityFilters}
            />

            <Text style={styles.sectionLabel}>Provider</Text>
            <ScrollView
              style={styles.providerScroll}
              contentContainerStyle={styles.providerGrid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {LIBRARY_PROVIDER_FILTER_OPTIONS.map((opt) => {
                const isSelected = filters.provider === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setProvider(opt.id)}
                    style={({ pressed }) => [
                      styles.providerChip,
                      isSelected && styles.providerChipSelected,
                      pressed && !isSelected && styles.providerChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerChipLabel,
                        { color: isSelected ? colors.primaryLight : colors.textMuted },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => onChange(DEFAULT_LIBRARY_BROWSE_FILTERS)}
                style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.72 }]}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.applyBtnText}>Show results</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createFilterStyles(colors: ThemeColors) {
  return StyleSheet.create({
    filterBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 2,
      position: "relative",
    },
    filterDot: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primaryLight,
    },
    activeChipsScroll: {
      marginBottom: 4,
      marginHorizontal: -2,
    },
    activeChipsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 2,
    },
    activeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    activeChipText: {
      color: colors.primaryLight,
      fontSize: 10,
      fontWeight: "600",
    },
    clearAllChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    clearAllChipText: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "600",
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.bgElevated,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 8,
      maxHeight: "78%",
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: 14,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    sheetTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    sheetClose: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
    },
    sectionLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 16,
      marginBottom: 8,
    },
    capabilityFilters: {
      paddingHorizontal: 0,
      paddingBottom: 0,
      marginBottom: 4,
    },
    segmented: {
      flexDirection: "row",
      gap: 6,
      padding: 3,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: radii.sm,
    },
    segmentSelected: {
      backgroundColor: colors.primaryGlow,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    segmentPressed: { opacity: 0.78 },
    segmentLabel: {
      fontSize: 11,
      fontWeight: "600",
    },
    providerScroll: {
      maxHeight: 148,
    },
    providerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingBottom: 4,
    },
    providerChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    providerChipSelected: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryGlow,
    },
    providerChipPressed: { opacity: 0.78 },
    providerChipLabel: {
      fontSize: 11,
      fontWeight: "600",
    },
    sheetActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 20,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    resetBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    resetBtnText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "600",
    },
    applyBtn: {
      flex: 1.4,
      paddingVertical: 13,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    applyBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
