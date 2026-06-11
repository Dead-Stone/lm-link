import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalPageTopPadding } from "../lib/safe-area-layout";
import { FoundServer, scanLocalNetwork } from "../lib/api";
import { formatServerHost } from "../lib/scan-device-names";
import { createModalTheme } from "../lib/modal-theme";
import { ThemeColors, useTheme } from "../lib/theme";
import { SPEED_STAT_ICON, SPEED_STAT_ICON_SIZE } from "./ModelPicker";
import WifiScanRadar from "./WifiScanRadar";

const SETTINGS_SUBTEXT = { fontSize: 12, lineHeight: 16 } as const;

const SCAN_TIPS = [
  { icon: "wifi-outline" as const, text: "Phone and Mac on the same Wi‑Fi" },
  { icon: "play-circle-outline" as const, text: "LM Studio server running on port 1234" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string, displayName: string) => void;
};

export default function NetworkScanModal({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const modalStyles = useMemo(() => createModalTheme(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<FoundServer[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const scanRunRef = useRef(0);
  const listFade = useRef(new Animated.Value(0)).current;

  const progressPct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;

  const startScan = useCallback(async () => {
    const runId = ++scanRunRef.current;
    setScanning(true);
    setFound([]);
    setProgress(0);
    setTotal(0);

    const results = await scanLocalNetwork(1234, (scanned, tot, foundSoFar) => {
      if (scanRunRef.current !== runId) return;
      setProgress(scanned);
      setTotal(tot);
      setFound(foundSoFar);
    });

    if (scanRunRef.current !== runId) return;
    setFound(results);
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      scanRunRef.current += 1;
      setScanning(false);
      return;
    }
    void startScan();
  }, [visible, startScan]);

  useEffect(() => {
    Animated.timing(listFade, {
      toValue: found.length > 0 ? 1 : 0.65,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [found.length, listFade]);

  const statusText = useMemo(() => {
    if (scanning && found.length === 0) return "Searching nearby devices…";
    if (scanning && found.length > 0) {
      return `${found.length} found — tap to connect`;
    }
    if (!scanning && found.length === 0) return "No LM Studio found on this Wi‑Fi";
    return `${found.length} device${found.length !== 1 ? "s" : ""} nearby — tap to connect`;
  }, [scanning, found.length]);

  const handleSelect = (url: string, displayName: string) => {
    onSelect(url, displayName);
    onClose();
  };

  const renderServerRow = (server: FoundServer) => (
    <Pressable
      key={server.url}
      style={({ pressed }) => [styles.deviceRow, pressed && styles.deviceRowPressed]}
      onPress={() => handleSelect(server.url, server.displayName)}
    >
      <View style={styles.deviceIcon}>
        <Ionicons name="desktop-outline" size={18} color={colors.primaryLight} />
      </View>
      <View style={styles.deviceBody}>
        <Text style={styles.deviceHost}>{server.displayName}</Text>
        <Text style={styles.deviceSubhost}>{formatServerHost(server.url)}</Text>
        <View style={styles.deviceMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="cube-outline" size={11} color={colors.textMuted} />
            <Text style={styles.metaChipText}>
              {server.modelCount} model{server.modelCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name={SPEED_STAT_ICON} size={SPEED_STAT_ICON_SIZE} color={colors.textMuted} />
            <Text style={styles.metaChipText}>{server.latencyMs}ms</Text>
          </View>
        </View>
      </View>
      <View style={styles.connectPill}>
        <Text style={styles.connectPillText}>Connect</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primaryLight} />
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[modalStyles.pageContainer, { paddingTop: modalPageTopPadding(insets.top) }]}>
        <View style={modalStyles.pageHandleWrap}>
          <View style={modalStyles.pageHandle} />
        </View>

        <View style={modalStyles.pageHeader}>
          <Pressable onPress={onClose} style={modalStyles.pageHeaderBtn} hitSlop={8}>
            <View style={modalStyles.closeCircle}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </View>
          </Pressable>
          <Text style={modalStyles.pageTitle}>Nearby</Text>
          <Pressable
            onPress={() => void startScan()}
            disabled={scanning}
            style={modalStyles.pageHeaderBtn}
            hitSlop={8}
            accessibilityLabel="Scan again"
          >
            <Ionicons
              name="refresh"
              size={20}
              color={scanning ? colors.textDim : colors.textMuted}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.radarSection}>
            <WifiScanRadar
              active={scanning}
              size={280}
              colors={colors}
              devices={found.map((server) => ({
                url: server.url,
                displayName: server.displayName,
              }))}
              onSelectDevice={handleSelect}
            />
            <Text style={styles.statusTitle}>{statusText}</Text>
            {scanning ? (
              <Text style={styles.statusMeta}>
                {total > 0 ? `${progressPct}% · port 1234` : "Checking Bonjour & Wi‑Fi…"}
              </Text>
            ) : found.length === 0 ? (
              <Text style={styles.statusMeta}>Make sure LM Studio is serving on your Mac</Text>
            ) : null}
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Devices</Text>
            {scanning ? <View style={styles.scanningDot} /> : null}
          </View>

          <Animated.View style={{ opacity: listFade }}>
            {found.length > 0 ? (
              found.map((server) => renderServerRow(server))
            ) : (
              <View style={styles.emptyList}>
                <Ionicons name="search-outline" size={22} color={colors.textDim} />
                <Text style={styles.emptyListText}>
                  {scanning
                    ? "Devices appear here as they are found"
                    : "Nothing nearby yet — try scanning again"}
                </Text>
                {!scanning ? (
                  <Pressable
                    style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
                    onPress={() => void startScan()}
                  >
                    <Ionicons name="refresh" size={16} color={colors.primaryLight} />
                    <Text style={styles.retryBtnText}>Scan again</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>

          {!scanning && found.length === 0 ? (
            <View style={styles.tipsCard}>
              {SCAN_TIPS.map((tip, index, arr) => (
                <View
                  key={tip.text}
                  style={[styles.tipRow, index === arr.length - 1 && styles.tipRowLast]}
                >
                  <Ionicons name={tip.icon} size={16} color={colors.textMuted} />
                  <Text style={styles.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { paddingHorizontal: 16, paddingTop: 4 },
    radarSection: {
      alignItems: "center",
      paddingVertical: 4,
      marginBottom: 12,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: -0.2,
      marginTop: 14,
      textAlign: "center",
    },
    statusMeta: {
      color: colors.textMuted,
      ...SETTINGS_SUBTEXT,
      marginTop: 4,
      textAlign: "center",
    },
    listHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    listTitle: {
      color: colors.textDim,
      ...SETTINGS_SUBTEXT,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    scanningDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.primaryLight,
    },
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      marginBottom: 2,
    },
    deviceRowPressed: { opacity: 0.65 },
    deviceIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryGlow,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    deviceBody: { flex: 1, minWidth: 0 },
    deviceHost: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
      letterSpacing: -0.15,
    },
    deviceSubhost: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 6,
    },
    deviceMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingRight: 8,
    },
    metaChipText: { color: colors.textMuted, ...SETTINGS_SUBTEXT, fontWeight: "500" },
    connectPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      flexShrink: 0,
    },
    connectPillText: { color: colors.primaryLight, ...SETTINGS_SUBTEXT, fontWeight: "600" },
    emptyList: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 20,
      paddingHorizontal: 8,
    },
    emptyListText: {
      color: colors.textMuted,
      ...SETTINGS_SUBTEXT,
      textAlign: "center",
      maxWidth: 260,
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    retryBtnPressed: { opacity: 0.75 },
    retryBtnText: { color: colors.primaryLight, fontSize: 13, fontWeight: "600" },
    tipsCard: {
      marginTop: 12,
      gap: 8,
    },
    tipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 4,
    },
    tipRowLast: {},
    tipText: { color: colors.textMuted, ...SETTINGS_SUBTEXT, flex: 1 },
  });
}
