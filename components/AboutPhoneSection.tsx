import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  assessOnDeviceDownloads,
  formatAboutPhoneStat,
  OnDeviceDownloadStatus,
  readAboutPhoneStats,
} from "../lib/about-phone";
import { computeLocalModelsUsedBytes } from "../lib/local-storage-usage";
import { ThemeColors } from "../lib/theme";

const SETTINGS_SUBTEXT = {
  fontSize: 12,
  lineHeight: 16,
} as const;

const SUB_ROW_INDENT = 48;

function statusIcon(
  status: OnDeviceDownloadStatus,
  colors: ThemeColors
): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  switch (status) {
    case "ready":
      return { icon: "checkmark-circle", color: colors.primaryLight };
    case "ram_limited":
      return { icon: "warning", color: "#f59e0b" };
    case "storage_low":
      return { icon: "save-outline", color: colors.error };
    case "blocked_expo_go":
    default:
      return { icon: "close-circle", color: colors.error };
  }
}

function SubRow({
  label,
  value,
  detail,
  styles,
}: {
  label: string;
  value: string;
  detail?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.subRow}>
      <Text style={styles.subLabel}>{label}</Text>
      <Text style={styles.subValue}>{value}</Text>
      {detail ? <Text style={styles.subDetail}>{detail}</Text> : null}
    </View>
  );
}

function SubDivider({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.subDivider} />;
}

/** Collapsible on-device block — embed inside the About settings group. */
export default function AboutPhoneSection({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const [modelsUsedBytes, setModelsUsedBytes] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useMemo(() => readAboutPhoneStats(), [refreshKey]);
  const assessment = useMemo(
    () => assessOnDeviceDownloads(stats, modelsUsedBytes),
    [stats, modelsUsedBytes]
  );
  const tone = statusIcon(assessment.status, colors);
  const statusSubdetail = assessment.statusDetail.includes(assessment.maxModelHint)
    ? assessment.statusDetail
    : `${assessment.statusDetail} ${assessment.maxModelHint}`;

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

  const storageValue =
    stats.freeStorageBytes != null && stats.totalStorageBytes != null
      ? `${formatAboutPhoneStat(stats.freeStorageBytes)} free of ${formatAboutPhoneStat(stats.totalStorageBytes)}`
      : stats.freeStorageBytes != null
        ? `${formatAboutPhoneStat(stats.freeStorageBytes)} free`
        : "Unknown";

  const storageDetail =
    modelsUsedBytes > 0
      ? `${formatAboutPhoneStat(modelsUsedBytes)} used by on-device models`
      : undefined;

  return (
    <View style={styles.block}>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel="On-device"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Ionicons name={tone.icon} size={20} color={tone.color} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>On-device</Text>
          <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={expanded ? undefined : 2}>
            {assessment.statusLabel}
          </Text>
          {expanded ? (
            <Text style={[styles.rowValue, styles.rowValueMuted, styles.rowSubdetail]}>
              {statusSubdetail}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textDim}
          style={styles.chevron}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.subGroup}>
          <SubDivider styles={styles} />

          <SubRow
            label="Device"
            value={
              stats.deviceTypeLabel
                ? `${stats.deviceLabel} · ${stats.deviceTypeLabel}`
                : stats.deviceLabel
            }
            styles={styles}
          />

          <SubDivider styles={styles} />

          <SubRow label="System" value={stats.osLabel} styles={styles} />

          <SubDivider styles={styles} />

          <SubRow label="RAM" value={formatAboutPhoneStat(stats.ramBytes)} styles={styles} />

          <SubDivider styles={styles} />

          <View style={styles.storageSubBlock}>
            <SubRow label="Storage" value={storageValue} detail={storageDetail} styles={styles} />
            {stats.totalStorageBytes != null && stats.totalStorageBytes > 0 ? (
              <View style={styles.storageTrack}>
                <View style={[styles.storageFill, { width: `${storagePct}%` }]} />
              </View>
            ) : null}
          </View>

          <SubDivider styles={styles} />

          <SubRow
            label="Engine"
            value={stats.nativeBuild ? "llama.cpp in this build" : "Not included (Expo Go)"}
            styles={styles}
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      paddingBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowPressed: {
      backgroundColor: colors.surfaceHover,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
    rowValue: { color: colors.textMuted, ...SETTINGS_SUBTEXT, marginTop: 2 },
    rowValueMuted: { color: colors.textDim },
    rowSubdetail: { marginTop: 2 },
    chevron: {
      flexShrink: 0,
      marginTop: 3,
    },
    subGroup: {
      paddingBottom: 6,
    },
    subDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: SUB_ROW_INDENT,
    },
    subRow: {
      paddingLeft: SUB_ROW_INDENT,
      paddingRight: 16,
      paddingVertical: 10,
      gap: 2,
    },
    subLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    subValue: {
      color: colors.textMuted,
      ...SETTINGS_SUBTEXT,
    },
    subDetail: {
      color: colors.textDim,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    storageSubBlock: {
      paddingBottom: 4,
    },
    storageTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      overflow: "hidden",
      marginLeft: SUB_ROW_INDENT,
      marginRight: 16,
      marginTop: 6,
    },
    storageFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
  });
}
