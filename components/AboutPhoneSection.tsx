import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  assessOnDeviceDownloads,
  formatAboutPhoneStat,
  OnDeviceDownloadStatus,
  readAboutPhoneStats,
} from "../lib/about-phone";
import { computeLocalModelsUsedBytes } from "../lib/local-storage-usage";
import { radii, ThemeColors } from "../lib/theme";

const SETTINGS_SUBTEXT = {
  fontSize: 12,
  lineHeight: 16,
} as const;

function statusTone(
  status: OnDeviceDownloadStatus,
  colors: ThemeColors
): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  switch (status) {
    case "ready":
      return {
        icon: "checkmark-circle",
        color: colors.primaryLight,
        bg: colors.primaryGlow,
      };
    case "ram_limited":
      return {
        icon: "warning",
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
      };
    case "storage_low":
      return {
        icon: "save-outline",
        color: colors.error,
        bg: colors.errorBg,
      };
    case "blocked_expo_go":
    default:
      return {
        icon: "close-circle",
        color: colors.error,
        bg: colors.errorBg,
      };
  }
}

function StatRow({
  icon,
  label,
  value,
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, styles.rowValueMuted]}>{value}</Text>
      </View>
    </View>
  );
}

export default function AboutPhoneSection({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modelsUsedBytes, setModelsUsedBytes] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useMemo(() => readAboutPhoneStats(), [refreshKey]);
  const assessment = useMemo(
    () => assessOnDeviceDownloads(stats, modelsUsedBytes),
    [stats, modelsUsedBytes]
  );
  const tone = statusTone(assessment.status, colors);

  const refresh = useCallback(() => {
    void computeLocalModelsUsedBytes().then(setModelsUsedBytes);
    setRefreshKey((key) => key + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const storagePct =
    stats.totalStorageBytes && stats.freeStorageBytes != null
      ? Math.min(
          100,
          Math.max(
            0,
            ((stats.totalStorageBytes - stats.freeStorageBytes) / stats.totalStorageBytes) * 100
          )
        )
      : 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>About this phone</Text>
      <View style={styles.group}>
        <View style={[styles.statusBanner, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={22} color={tone.color} />
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { color: tone.color }]}>{assessment.statusLabel}</Text>
            <Text style={styles.statusDetail}>{assessment.statusDetail}</Text>
            <Text style={styles.statusHint}>{assessment.maxModelHint}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <StatRow
          icon="phone-portrait-outline"
          label="Device"
          value={
            stats.deviceTypeLabel
              ? `${stats.deviceLabel} · ${stats.deviceTypeLabel}`
              : stats.deviceLabel
          }
          colors={colors}
          styles={styles}
        />

        <View style={styles.divider} />

        <StatRow
          icon="layers-outline"
          label="System"
          value={stats.osLabel}
          colors={colors}
          styles={styles}
        />

        <View style={styles.divider} />

        <StatRow
          icon="hardware-chip-outline"
          label="RAM"
          value={formatAboutPhoneStat(stats.ramBytes)}
          colors={colors}
          styles={styles}
        />

        <View style={styles.divider} />

        <View style={styles.storageBlock}>
          <View style={styles.row}>
            <Ionicons name="save-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Storage</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]}>
                {stats.freeStorageBytes != null && stats.totalStorageBytes != null
                  ? `${formatAboutPhoneStat(stats.freeStorageBytes)} free of ${formatAboutPhoneStat(stats.totalStorageBytes)}`
                  : stats.freeStorageBytes != null
                    ? `${formatAboutPhoneStat(stats.freeStorageBytes)} free`
                    : "Unknown"}
              </Text>
              {modelsUsedBytes > 0 ? (
                <Text style={styles.storageUsed}>
                  {formatAboutPhoneStat(modelsUsedBytes)} used by on-device models
                </Text>
              ) : null}
            </View>
          </View>
          {stats.totalStorageBytes != null && stats.totalStorageBytes > 0 ? (
            <View style={styles.storageTrack}>
              <View style={[styles.storageFill, { width: `${storagePct}%` }]} />
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <StatRow
          icon="cube-outline"
          label="On-device engine"
          value={stats.nativeBuild ? "llama.cpp available in this build" : "Not included (Expo Go)"}
          colors={colors}
          styles={styles}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    sectionTitle: {
      color: colors.textDim,
      ...SETTINGS_SUBTEXT,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    group: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    statusBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    statusCopy: { flex: 1, minWidth: 0, gap: 4 },
    statusTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
    statusDetail: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    statusHint: { color: colors.textDim, fontSize: 12, lineHeight: 16, marginTop: 2 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
    rowValue: { color: colors.textMuted, ...SETTINGS_SUBTEXT, marginTop: 2 },
    rowValueMuted: { color: colors.textDim },
    storageBlock: { paddingBottom: 14 },
    storageUsed: { color: colors.textDim, fontSize: 11, lineHeight: 15, marginTop: 4 },
    storageTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      overflow: "hidden",
      marginHorizontal: 16,
      marginTop: 4,
    },
    storageFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
  });
}
