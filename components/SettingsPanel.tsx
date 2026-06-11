import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ModelLibraryModal from "./ModelLibraryModal";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import NetworkScanModal from "./NetworkScanModal";
import SetupGuideModal from "./SetupGuideModal";
import SettingsCreatorFooter from "./SettingsCreatorFooter";
import DismissAffordance from "./DismissAffordance";
import { useHubNavigation } from "../lib/hub-navigation";
import { LOCAL_MODEL_CATALOG, IS_EXPO_GO } from "../lib/local-models";
import { LocalDeviceStorageBar } from "./LocalModelsSection";
import ThemedConfirmDialog from "./ThemedConfirmDialog";
import PcDownloadConsentSheet from "./PcDownloadConsentSheet";
import { usePcDownloadFromPhoneConsent } from "../lib/use-pc-download-consent";
import { formatConnectionTestError } from "../lib/errors";
import {
  getEffectiveLocalServerUrl,
  isHubUrl,
  resolveManagementApiKey,
  testConnection,
} from "../lib/api";
import { LMAccount, sanitizeApiToken, saveAccount } from "../lib/auth";
import { normalizeServerInputUrl } from "../lib/connection-string";
import {
  formatServerHost,
  resolveConnectionDisplayName,
  resolveServerDisplayName,
} from "../lib/scan-device-names";
import { useApp } from "../lib/context";
import { SecureCredentialError } from "../lib/storage";
import { Settings } from "../lib/types";
import { createModalTheme } from "../lib/modal-theme";
import { screenHeaderTopPadding } from "../lib/safe-area-layout";
import { getSettingsPalette, ThemeColors, useTheme } from "../lib/theme";
import { createConnPanelStyles, createMainStyles } from "./SettingsPanel.styles";
import {
  footerBottomPadding,
  keyboardLift,
  useKeyboardInset,
} from "../lib/use-keyboard-inset";

/** Sub-headings and explanatory copy on the settings screen */
function useSettingsColors() {
  const { colors, isDark } = useTheme();
  return useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
}

function useSettingsStyles() {
  const colors = useSettingsColors();
  return useMemo(
    () => ({
      styles: createMainStyles(colors),
      connPanelStyles: createConnPanelStyles(colors),
      modalStyles: createModalTheme(colors),
    }),
    [colors]
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useSettingsStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Divider() {
  const { styles } = useSettingsStyles();
  return <View style={styles.divider} />;
}

function clampGenerationValue(
  raw: number,
  min: number,
  max: number,
  step: number,
  decimals: number
): number {
  const clamped = Math.min(max, Math.max(min, raw));
  if (decimals > 0) {
    const factor = Math.pow(10, decimals);
    return Math.round(clamped * factor) / factor;
  }
  return Math.round(clamped / step) * step;
}

function ratioFromValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function valueFromRatioSmooth(ratio: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return min + clamped * (max - min);
}

function GenerationParamRow({
  label,
  hint,
  icon,
  value,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const { styles, modalStyles } = useSettingsStyles();
  const colors = useSettingsColors();
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const dragStartRatioRef = useRef(0);
  const dragStartXRef = useRef(0);
  const editInputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const boundsRef = useRef({ min, max, step, decimals });

  const safeValue = Number.isFinite(value)
    ? clampGenerationValue(value, min, max, step, decimals)
    : min;

  valueRef.current = safeValue;
  onChangeRef.current = onChange;
  boundsRef.current = { min, max, step, decimals };

  const format = (n: number) => {
    const v = Number.isFinite(n) ? n : min;
    return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  };

  const syncTrackWidth = useCallback(() => {
    trackRef.current?.measureInWindow((_x, _y, width) => {
      if (width > 0) trackWidthRef.current = width;
    });
  }, []);

  const displayValue = dragValue ?? safeValue;
  const displayRatio = ratioFromValue(displayValue, min, max);
  const thumbLeft = `${displayRatio * 100}%` as `${number}%`;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          syncTrackWidth();
          const { min: lo, max: hi } = boundsRef.current;
          dragStartRatioRef.current = ratioFromValue(valueRef.current, lo, hi);
          dragStartXRef.current = evt.nativeEvent.pageX;
        },
        onPanResponderMove: (evt) => {
          const width = trackWidthRef.current;
          if (width <= 0) return;
          const { min: lo, max: hi } = boundsRef.current;
          const delta = evt.nativeEvent.pageX - dragStartXRef.current;
          const nextRatio = dragStartRatioRef.current + delta / width;
          setDragValue(valueFromRatioSmooth(nextRatio, lo, hi));
        },
        onPanResponderRelease: (evt, gesture) => {
          const width = trackWidthRef.current;
          const { min: lo, max: hi, step: st, decimals: dec } = boundsRef.current;

          if (width <= 0) {
            setDragValue(null);
            return;
          }

          const dx = gesture?.dx ?? 0;
          const dy = gesture?.dy ?? 0;
          const raw =
            Math.abs(dx) < 4 && Math.abs(dy) < 4
              ? valueFromRatioSmooth(evt.nativeEvent.locationX / width, lo, hi)
              : valueFromRatioSmooth(
                  dragStartRatioRef.current +
                    (evt.nativeEvent.pageX - dragStartXRef.current) / width,
                  lo,
                  hi
                );

          onChangeRef.current(clampGenerationValue(raw, lo, hi, st, dec));
          setDragValue(null);
        },
        onPanResponderTerminate: () => setDragValue(null),
      }),
    [syncTrackWidth]
  );

  const openEdit = () => {
    setDraft(decimals > 0 ? safeValue.toFixed(decimals) : String(Math.round(safeValue)));
    setShowEdit(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const closeEdit = () => setShowEdit(false);

  const commitDraft = () => {
    const parsed =
      decimals > 0
        ? parseFloat(draft.replace(",", "."))
        : parseInt(draft.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(parsed)) {
      onChange(clampGenerationValue(parsed, min, max, step, decimals));
    }
    closeEdit();
  };

  return (
    <View style={styles.genParamRow}>
      <View style={styles.genParamHeader}>
        <View style={styles.genParamTitleWrap}>
          <Ionicons name={icon} size={18} color={colors.textMuted} />
          <View style={styles.genParamTitleBody}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.genParamHint}>{hint}</Text>
          </View>
        </View>
        <Pressable
          onPress={openEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.genValueTap, pressed && styles.genValueTapPressed]}
        >
          <Text style={styles.genValueText}>{format(displayValue)}</Text>
        </Pressable>
      </View>

      <View
        ref={trackRef}
        collapsable={false}
        style={styles.genSliderWrap}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) trackWidthRef.current = width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: thumbLeft }]} />
        </View>
        <View style={[styles.genThumb, { left: thumbLeft }]} pointerEvents="none" />
      </View>

      <View style={styles.sliderBounds}>
        <Text style={styles.bound}>{format(min)}</Text>
        <Text style={styles.bound}>{format(max)}</Text>
      </View>

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeEdit} />
          <View style={[modalStyles.card, { gap: 12 }]}>
            <Text style={modalStyles.dialogTitle}>{label}</Text>
            <Text style={[modalStyles.dialogMessage, { marginBottom: 0 }]}>
              {format(min)} – {format(max)}
            </Text>
            <TextInput
              ref={editInputRef}
              value={draft}
              onChangeText={setDraft}
              keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
              selectTextOnFocus
              style={styles.genEditInput}
              returnKeyType="done"
              onSubmitEditing={commitDraft}
            />
            <View style={modalStyles.actionRow}>
              <Pressable
                onPress={closeEdit}
                style={({ pressed }) => [modalStyles.secondaryBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={modalStyles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={commitDraft}
                style={({ pressed }) => [modalStyles.primaryBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={modalStyles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Local connection panel ───────────────────────────────────────────────────

type ConnStatus = "idle" | "checking" | "ok" | "error";
type ConnectionVisual = "connected" | "disconnected" | "empty" | "checking" | "error";

function resolveConnectionVisual(
  connStatus: ConnStatus,
  isConnected: boolean,
  hasChanges: boolean,
  isEmpty: boolean
): ConnectionVisual {
  if (connStatus === "checking") return "checking";
  if (isEmpty) return "empty";
  if (connStatus === "error") return "error";
  if ((isConnected && !hasChanges) || connStatus === "ok") return "connected";
  return "disconnected";
}

/** Dark green — connected LM Studio / PC on network */
const CONNECTION_PC_CONNECTED = "#2e7d32";

const CONNECTION_STATUS_COPY: Record<
  ConnectionVisual,
  { title: string; subtitle?: string }
> = {
  connected: { title: "Connected", subtitle: "LM Studio server is set" },
  disconnected: { title: "Not connected", subtitle: "Add your server below" },
  empty: { title: "Not connected", subtitle: "Enter a connection string" },
  checking: { title: "Testing connection…" },
  error: { title: "Connection error", subtitle: "Check the server URL and try again" },
};

function ConnectionStatusIcon({
  state,
  colors,
  styles: iconStyles,
}: {
  state: ConnectionVisual;
  colors: ThemeColors;
  styles: ReturnType<typeof createConnPanelStyles>;
}) {
  if (state === "checking") {
    return (
      <View style={[iconStyles.statusIcon, iconStyles.statusIconNeutral]}>
        <ActivityIndicator size="small" color={colors.primaryLight} />
      </View>
    );
  }

  const connected = state === "connected";
  const empty = state === "empty";

  const iconColor = connected
    ? CONNECTION_PC_CONNECTED
    : empty
      ? colors.textDim
      : colors.error;
  const iconWrap = connected
    ? iconStyles.statusIconConnected
    : empty
      ? iconStyles.statusIconEmpty
      : iconStyles.statusIconDisconnected;

  return (
    <View style={[iconStyles.statusIcon, iconWrap]}>
      <Ionicons name="desktop-outline" size={20} color={iconColor} />
    </View>
  );
}

function LocalConnectionPanel({
  localBaseUrl,
  setLocalBaseUrl,
  savedLocalUrl,
  connectionName,
  setConnectionName,
  localApiToken,
  setLocalApiToken,
  savedApiToken,
  localHfToken,
  setLocalHfToken,
  savedHfToken,
  showLocalToken,
  setShowLocalToken,
  showLocalHfToken,
  setShowLocalHfToken,
  connStatus,
  connMessage,
  setConnStatus,
  setConnMessage,
  onTest,
  onSave,
  onScan,
  macDownloadConfigured,
  saving,
  showAdvanced,
  setShowAdvanced,
}: {
  localBaseUrl: string;
  setLocalBaseUrl: (v: string) => void;
  savedLocalUrl: string;
  connectionName: string;
  setConnectionName: (v: string) => void;
  localApiToken: string;
  setLocalApiToken: (v: string) => void;
  savedApiToken: string;
  localHfToken: string;
  setLocalHfToken: (v: string) => void;
  savedHfToken: string;
  showLocalToken: boolean;
  setShowLocalToken: (v: boolean) => void;
  showLocalHfToken: boolean;
  setShowLocalHfToken: (v: boolean) => void;
  connStatus: ConnStatus;
  connMessage: string;
  setConnStatus: (s: ConnStatus) => void;
  setConnMessage: (m: string) => void;
  onTest: () => void;
  onSave: () => void;
  onScan: () => void;
  /** Mac LAN URL saved for Hub users (downloads / model load). */
  macDownloadConfigured: boolean;
  saving: boolean;
  showAdvanced: boolean;
  setShowAdvanced: (open: boolean) => void;
}) {
  const colors = useSettingsColors();
  const { styles, connPanelStyles } = useSettingsStyles();
  const trimmedUrl = localBaseUrl.trim();
  const hasChanges =
    trimmedUrl !== savedLocalUrl.trim() ||
    sanitizeApiToken(localApiToken) !== sanitizeApiToken(savedApiToken) ||
    sanitizeApiToken(localHfToken) !== sanitizeApiToken(savedHfToken);
  const isConnected = !!savedLocalUrl.trim();
  const [expanded, setExpanded] = useState(!isConnected);
  const wasSavingRef = useRef(false);

  const summaryPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          expanded && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 28) setExpanded(false);
        },
      }),
    [expanded]
  );

  const summaryName =
    connectionName.trim() || resolveServerDisplayName(savedLocalUrl || localBaseUrl);
  const summaryUrl = hasChanges ? localBaseUrl : savedLocalUrl || localBaseUrl;

  useEffect(() => {
    if (!isConnected) setExpanded(true);
  }, [isConnected]);

  useEffect(() => {
    if (hasChanges) setExpanded(true);
  }, [hasChanges]);

  useEffect(() => {
    if (showAdvanced) setExpanded(true);
  }, [showAdvanced]);

  useEffect(() => {
    if (wasSavingRef.current && !saving && isConnected && !hasChanges) {
      setExpanded(false);
    }
    wasSavingRef.current = saving;
  }, [saving, isConnected, hasChanges]);

  const showDetails = !isConnected || expanded;
  const activeUrl = (hasChanges ? localBaseUrl : savedLocalUrl || localBaseUrl).trim();
  const isEmpty = !activeUrl;
  const connectionVisual = resolveConnectionVisual(
    connStatus,
    isConnected,
    hasChanges,
    isEmpty
  );
  const statusCopy = CONNECTION_STATUS_COPY[connectionVisual];

  return (
    <View style={connPanelStyles.body}>
      {isConnected ? (
        <Pressable
          onPress={() => setExpanded((open) => !open)}
          {...(expanded ? summaryPan.panHandlers : undefined)}
          style={({ pressed }) => [
            connPanelStyles.summaryRow,
            pressed && connPanelStyles.optionPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <ConnectionStatusIcon
            state={
              isEmpty
                ? "empty"
                : connectionVisual === "checking" || connectionVisual === "error"
                  ? connectionVisual
                  : "connected"
            }
            colors={colors}
            styles={connPanelStyles}
          />
          <View style={connPanelStyles.summaryCopy}>
            <Text style={connPanelStyles.summaryName} numberOfLines={1}>
              {summaryName}
            </Text>
            <Text
              style={connPanelStyles.summaryUrl}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {formatServerHost(summaryUrl) || summaryUrl}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textDim}
          />
        </Pressable>
      ) : (
        <View style={connPanelStyles.statusRow}>
          <ConnectionStatusIcon
            state={connectionVisual}
            colors={colors}
            styles={connPanelStyles}
          />
          <View style={connPanelStyles.statusCopy}>
            <Text style={connPanelStyles.statusTitle}>{statusCopy.title}</Text>
            {statusCopy.subtitle ? (
              <Text style={connPanelStyles.statusSubtitle}>{statusCopy.subtitle}</Text>
            ) : null}
          </View>
        </View>
      )}

      {showDetails ? (
        <>
      <Text style={connPanelStyles.desc}>
        {macDownloadConfigured
          ? "Your Mac's local server URL is used to download and load models while chatting via Hub."
          : "Connect to LM Studio on your Wi‑Fi. Scan to find it, or enter the server URL manually. This URL is also used to download models onto your Mac from the Model Library."}
      </Text>

      <View style={connPanelStyles.fieldBlock}>
        <Text style={connPanelStyles.fieldLabel}>Name</Text>
        <TextInput
          value={connectionName}
          onChangeText={setConnectionName}
          placeholder="My Mac"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="words"
          autoCorrect={false}
          style={connPanelStyles.fieldInput}
        />
      </View>

      <View style={connPanelStyles.fieldBlock}>
        <Text style={connPanelStyles.fieldLabel}>Connection string</Text>
        <TextInput
          value={localBaseUrl}
          onChangeText={(t) => {
            setLocalBaseUrl(t);
            setConnStatus("idle");
            setConnMessage("");
          }}
          placeholder="http://192.168.1.x:1234/v1"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[connPanelStyles.fieldInput, connPanelStyles.fieldInputMono]}
        />
      </View>

      <View style={connPanelStyles.optionsGroup}>
        <Pressable
          onPress={onScan}
          style={({ pressed }) => [connPanelStyles.optionRow, pressed && connPanelStyles.optionPressed]}
        >
          <Ionicons name="wifi-outline" size={18} color={colors.primaryLight} />
          <Text style={connPanelStyles.optionLabel}>Scan local network</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={({ pressed }) => [connPanelStyles.optionRow, pressed && connPanelStyles.optionPressed]}
        >
          <Ionicons name="key-outline" size={18} color={colors.textMuted} />
          <Text style={connPanelStyles.optionLabel}>Advanced keys</Text>
          <Ionicons
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={15}
            color={colors.textDim}
          />
        </Pressable>
      </View>

      {showAdvanced ? (
        <View style={connPanelStyles.advancedBlock}>
          <Text style={connPanelStyles.advancedHint}>
            LM Studio token for downloads and when authentication is enabled — LM Studio → Developer → Manage Tokens
          </Text>
          <View style={connPanelStyles.advancedInputWrap}>
            <TextInput
              value={localApiToken}
              onChangeText={(t) => {
                setLocalApiToken(t);
                setConnStatus("idle");
              }}
              placeholder="sk-lm-…"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!showLocalToken}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                connPanelStyles.fieldInput,
                connPanelStyles.fieldInputMono,
                connPanelStyles.advancedInput,
                showLocalToken && connPanelStyles.advancedInputPlain,
              ]}
            />
            <Pressable
              onPress={() => setShowLocalToken(!showLocalToken)}
              style={connPanelStyles.advancedEye}
              hitSlop={8}
            >
              <Ionicons
                name={showLocalToken ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          <Text style={[connPanelStyles.advancedHint, connPanelStyles.advancedHintSpaced]}>
            Hugging Face token for model library browse — overrides the dev token in `.env` when set
          </Text>
          <View style={connPanelStyles.advancedInputWrap}>
            <TextInput
              value={localHfToken}
              onChangeText={setLocalHfToken}
              placeholder="hf_…"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!showLocalHfToken}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                connPanelStyles.fieldInput,
                connPanelStyles.fieldInputMono,
                connPanelStyles.advancedInput,
                showLocalHfToken && connPanelStyles.advancedInputPlain,
              ]}
            />
            <Pressable
              onPress={() => setShowLocalHfToken(!showLocalHfToken)}
              style={connPanelStyles.advancedEye}
              hitSlop={8}
            >
              <Ionicons
                name={showLocalHfToken ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={connPanelStyles.actionRow}>
        <Pressable
          onPress={onTest}
          disabled={connStatus === "checking" || !trimmedUrl}
          style={[
            connPanelStyles.secondaryBtn,
            (connStatus === "checking" || !trimmedUrl) && connPanelStyles.btnDisabled,
          ]}
        >
          {connStatus === "checking" ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons
              name={connStatus === "ok" ? "checkmark-circle-outline" : "pulse-outline"}
              size={18}
              color={connStatus === "ok" ? colors.primaryLight : colors.text}
            />
          )}
          <Text style={connPanelStyles.secondaryBtnText}>
            {connStatus === "checking" ? "Testing…" : "Test"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onSave}
          disabled={saving || !trimmedUrl || !hasChanges}
          style={[
            connPanelStyles.saveBtn,
            (saving || !trimmedUrl || !hasChanges) && connPanelStyles.btnDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={18} color="#fff" />
          )}
          <Text style={connPanelStyles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>

      {connStatus === "ok" ? (
        <>
          <Text style={styles.connResultOk}>Connected</Text>
          {__DEV__ && connMessage ? (
            <Text style={styles.connResultDebug}>{connMessage}</Text>
          ) : null}
        </>
      ) : null}
      {connStatus === "error" ? (
        <>
          <Text style={styles.connResultError}>Connection error</Text>
          {__DEV__ && connMessage ? (
            <Text style={styles.connResultDebug}>
              {formatConnectionTestError(connMessage)}
            </Text>
          ) : null}
        </>
      ) : null}
        </>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function ModelDefaultSummary({
  defaultModel,
  defaultLocalKey,
  localModelName,
  localModelProvider,
  colors,
  styles,
}: {
  defaultModel?: string;
  defaultLocalKey?: string;
  localModelName?: string;
  localModelProvider?: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createMainStyles>;
}) {
  if (!defaultModel && !defaultLocalKey) {
    return (
      <Text style={[styles.rowValue, styles.rowValueMuted]}>
        Browse, download, and select models
      </Text>
    );
  }

  const remoteLabel = defaultModel
    ? (defaultModel.split("/").pop() ?? defaultModel)
    : null;
  const deviceLabel = defaultLocalKey
    ? (localModelName ?? defaultLocalKey)
    : null;

  return (
    <View style={styles.modelSummaryRow}>
      {remoteLabel ? (
        <View style={styles.modelSummaryItem}>
          <ModelModeBadgeIcon
            platform="pc"
            modelId={defaultModel}
            size={14}
            color={colors.textMuted}
          />
          <Text style={styles.modelSummaryText} numberOfLines={1}>
            {remoteLabel}
          </Text>
        </View>
      ) : null}
      {remoteLabel && deviceLabel ? (
        <Text style={styles.modelSummarySep}>·</Text>
      ) : null}
      {deviceLabel ? (
        <View style={styles.modelSummaryItem}>
          <ModelModeBadgeIcon
            platform="phone"
            provider={localModelProvider}
            label={localModelName ?? deviceLabel}
            size={14}
            color={colors.textMuted}
          />
          <Text style={styles.modelSummaryText} numberOfLines={1}>
            {deviceLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SettingsPanel() {
  const insets = useSafeAreaInsets();
  const { keyboardHeight, composerLift } = useKeyboardInset();
  const keyboardInset = keyboardLift(keyboardHeight, composerLift);
  const scrollBottomPadding = footerBottomPadding(insets.bottom, keyboardHeight, 32);
  const router = useRouter();
  const { openChat } = useHubNavigation();
  const { localAdvanced } = useLocalSearchParams<{ localAdvanced?: string }>();
  const { settings, updateSettings, account, setAccount, resetApp } = useApp();
  const colors = useSettingsColors();
  const { styles } = useSettingsStyles();

  const [showModelLibrary, setShowModelLibrary] = useState(false);
  const [storageRevision, setStorageRevision] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const {
    enabled: pcDownloadsEnabled,
    enable: enablePcDownloads,
    disable: disablePcDownloads,
  } = usePcDownloadFromPhoneConsent();
  const [pcConsentSheetOpen, setPcConsentSheetOpen] = useState(false);
  const [pcDisableConfirmOpen, setPcDisableConfirmOpen] = useState(false);

  const savedLocalUrl = useMemo(
    () => getEffectiveLocalServerUrl(settings),
    [settings.baseUrl, settings.localServerUrl]
  );
  const macDownloadConfigured = !!savedLocalUrl && isHubUrl(settings.baseUrl);

  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connMessage, setConnMessage] = useState<string>("");
  const [localBaseUrl, setLocalBaseUrl] = useState(savedLocalUrl);
  const [localConnectionName, setLocalConnectionName] = useState(() =>
    resolveConnectionDisplayName(savedLocalUrl, settings.serverConnectionName)
  );
  const [savingLocal, setSavingLocal] = useState(false);
  const savedApiToken = settings.apiKey ?? account?.token ?? "";
  const savedHfToken = settings.hfToken ?? "";
  const [localApiToken, setLocalApiToken] = useState(savedApiToken);
  const [localHfToken, setLocalHfToken] = useState(savedHfToken);
  const [showLocalToken, setShowLocalToken] = useState(false);
  const [showLocalHfToken, setShowLocalHfToken] = useState(false);
  const [localAdvancedOpen, setLocalAdvancedOpen] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(settings.defaultSystemPrompt);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const openLocalConnectionAdvanced = useCallback(() => {
    setShowModelLibrary(false);
    setLocalAdvancedOpen(true);
    setConnStatus("idle");
    setConnMessage("");
  }, []);

  useEffect(() => {
    setLocalBaseUrl(savedLocalUrl);
    if (savedLocalUrl) {
      setLocalConnectionName(
        (prev) =>
          prev ||
          resolveConnectionDisplayName(savedLocalUrl, settings.serverConnectionName)
      );
    }
  }, [savedLocalUrl, settings.serverConnectionName]);
  useEffect(() => {
    setLocalApiToken(savedApiToken);
  }, [savedApiToken]);
  useEffect(() => {
    setLocalHfToken(savedHfToken);
  }, [savedHfToken]);
  useEffect(() => {
    if (localAdvanced === "1") {
      openLocalConnectionAdvanced();
    }
  }, [localAdvanced, openLocalConnectionAdvanced]);
  useEffect(() => { setLocalPrompt(settings.defaultSystemPrompt); }, [settings.defaultSystemPrompt]);

  const handleTestConnection = useCallback(async () => {
    let url: string;
    try {
      url = normalizeServerInputUrl(localBaseUrl);
    } catch (e) {
      setConnStatus("error");
      setConnMessage(e instanceof Error ? e.message : "Invalid server URL");
      return;
    }
    if (!url) return;
    setConnStatus("checking");
    setConnMessage("");
    const token = sanitizeApiToken(localApiToken) || undefined;
    const res = await testConnection(url, token);
    if (res.ok) {
      setConnStatus("ok");
      setConnMessage(
        `${url} · ${res.modelCount} model${res.modelCount !== 1 ? "s" : ""} · ${res.latencyMs}ms`
      );
    } else {
      setConnStatus("error");
      setConnMessage(res.error ?? "Connection failed");
    }
  }, [localBaseUrl, localApiToken]);

  const handleSaveConnection = useCallback(async () => {
    let url: string;
    try {
      url = normalizeServerInputUrl(localBaseUrl);
    } catch {
      return;
    }
    if (!url) return;
    setSavingLocal(true);
    try {
      const token = sanitizeApiToken(localApiToken);
      const hfToken = sanitizeApiToken(localHfToken);
      const connectionName = localConnectionName.trim();
      const patch: Partial<typeof settings> = {
        ...(token ? { apiKey: token } : {}),
        // "" explicitly clears; saveSettings preserves stored token when omitted.
        hfToken,
        serverConnectionName: connectionName || undefined,
      };
      if (isHubUrl(settings.baseUrl)) {
        await updateSettings({ ...patch, localServerUrl: url });
      } else {
        await updateSettings({ ...patch, baseUrl: url, localServerUrl: url });
      }
      if (account && token) {
        const updated = { ...account, token };
        await saveAccount(updated);
        setAccount(updated);
      }
      setConnStatus("idle");
      setConnMessage("");
    } catch (error) {
      setConnStatus("error");
      setConnMessage(
        error instanceof SecureCredentialError
          ? error.message
          : "Could not save connection settings"
      );
    } finally {
      setSavingLocal(false);
    }
  }, [
    localBaseUrl,
    localApiToken,
    localHfToken,
    localConnectionName,
    updateSettings,
    settings.baseUrl,
    account,
    setAccount,
  ]);

  const localModelInfo = LOCAL_MODEL_CATALOG.find((m) => m.key === settings.defaultLocalModel);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
        <DismissAffordance kind="left" colors={colors} onPress={openChat} />
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.topBarBtn} />
      </View>

      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 12, paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
        {/* ── Connection ── */}
        <Section title="Connection">
          <LocalConnectionPanel
              localBaseUrl={localBaseUrl}
              setLocalBaseUrl={setLocalBaseUrl}
              savedLocalUrl={savedLocalUrl}
              connectionName={localConnectionName}
              setConnectionName={setLocalConnectionName}
              localApiToken={localApiToken}
              setLocalApiToken={setLocalApiToken}
              savedApiToken={savedApiToken}
              localHfToken={localHfToken}
              setLocalHfToken={setLocalHfToken}
              savedHfToken={savedHfToken}
              showLocalToken={showLocalToken}
              setShowLocalToken={setShowLocalToken}
              showLocalHfToken={showLocalHfToken}
              setShowLocalHfToken={setShowLocalHfToken}
              connStatus={connStatus}
              connMessage={connMessage}
              setConnStatus={setConnStatus}
              setConnMessage={setConnMessage}
              onTest={handleTestConnection}
              onSave={handleSaveConnection}
              onScan={() => setShowScanner(true)}
              macDownloadConfigured={macDownloadConfigured}
              saving={savingLocal}
              showAdvanced={localAdvancedOpen}
              setShowAdvanced={setLocalAdvancedOpen}
            />
        </Section>

        {/* ── Models ── */}
        <Section title="Models">
          {!IS_EXPO_GO ? (
            <>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <LocalDeviceStorageBar refreshKey={storageRevision} />
              </View>
              <Divider />
            </>
          ) : null}
          <Pressable onPress={() => setShowModelLibrary(true)} style={styles.row}>
            <Ionicons name="library-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Model Library</Text>
              <ModelDefaultSummary
                defaultModel={settings.defaultModel}
                defaultLocalKey={settings.defaultLocalModel}
                localModelName={localModelInfo?.name}
                localModelProvider={localModelInfo?.provider}
                colors={colors}
                styles={styles}
              />
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
          <Divider />
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name="desktop-outline" size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Download to Mac/PC</Text>
                <Text style={styles.switchSub}>
                  Start computer model installs from Model Library (one-way; delete on desktop only)
                </Text>
              </View>
            </View>
            <Switch
              value={pcDownloadsEnabled}
              onValueChange={(next) => {
                if (next) {
                  setPcConsentSheetOpen(true);
                  return;
                }
                setPcDisableConfirmOpen(true);
              }}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={pcDownloadsEnabled ? colors.primaryLight : colors.switchTrackOff}
            />
          </View>
          <Divider />
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name="layers-outline" size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Single Model at a Time</Text>
                <Text style={styles.switchSub}>
                  Unload the current model before loading a new one
                </Text>
              </View>
            </View>
            <Switch
              value={settings.singleModelMode !== false}
              onValueChange={(v) => updateSettings({ singleModelMode: v })}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={
                settings.singleModelMode !== false ? colors.primaryLight : colors.switchTrackOff
              }
            />
          </View>
        </Section>

        {/* ── Generation ── */}
        <Section title="Generation">
          <GenerationParamRow
            label="Temperature"
            hint="Lower = focused · higher = creative"
            icon="thermometer-outline"
            value={settings.temperature}
            min={0}
            max={2}
            step={0.1}
            decimals={1}
            onChange={(v) => updateSettings({ temperature: v })}
          />
          <Divider />
          <GenerationParamRow
            label="Max Tokens"
            hint="Maximum length of each reply"
            icon="text-outline"
            value={settings.maxTokens}
            min={256}
            max={8192}
            step={256}
            onChange={(v) => updateSettings({ maxTokens: v })}
          />
          <Divider />
          <View style={styles.promptBlock}>
            <View style={styles.promptLabelRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>System Prompt</Text>
                <Text style={styles.switchSub}>Instructions sent to the model at the start of each chat</Text>
              </View>
            </View>
            <TextInput
              value={localPrompt}
              onChangeText={setLocalPrompt}
              onBlur={() => updateSettings({ defaultSystemPrompt: localPrompt })}
              placeholder="Enter a system prompt…"
              placeholderTextColor={colors.placeholder}
              multiline
              style={styles.promptInput}
            />
          </View>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name={settings.theme === "dark" ? "moon" : "sunny"} size={20} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{settings.theme === "dark" ? "Dark Mode" : "Light Mode"}</Text>
            </View>
            <Switch
              value={settings.theme === "dark"}
              onValueChange={(v) => updateSettings({ theme: v ? "dark" : "light" })}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={settings.theme === "dark" ? colors.primaryLight : colors.switchTrackOff}
            />
          </View>
        </Section>

        {/* ── More ── */}
        <Section title="More">
          <Pressable onPress={() => router.push("/about")} style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primaryLight} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>About App</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={1}>
                Version and app details
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
          <Divider />
          <Pressable onPress={() => setShowSetupGuide(true)} style={styles.row}>
            <Ionicons name="book-outline" size={20} color={colors.primaryLight} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Setup Guide</Text>
              <Text style={[styles.rowValue, styles.rowValueMuted]} numberOfLines={1}>
                Connect LM Studio and start chatting
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
          <Divider />
          <Pressable onPress={() => setShowClearDataConfirm(true)} style={styles.row}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.rowLabel, { flex: 1, color: colors.error }]}>Clear All Data</Text>
          </Pressable>
        </Section>

        <View style={styles.creatorFooter}>
          <SettingsCreatorFooter />
        </View>
      </ScrollView>

      <ThemedConfirmDialog
        visible={showClearDataConfirm}
        title="Clear All Data"
        message="Delete all conversations and reset settings? This cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          void (async () => {
            try {
              await resetApp();
              setShowClearDataConfirm(false);
              openChat();
              router.replace("/chat/new");
            } catch {
              setShowClearDataConfirm(false);
            }
          })();
        }}
        onCancel={() => setShowClearDataConfirm(false)}
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

      <SetupGuideModal visible={showSetupGuide} onClose={() => setShowSetupGuide(false)} />

      <ModelLibraryModal
        visible={showModelLibrary}
        onClose={() => {
          setShowModelLibrary(false);
          setStorageRevision((revision) => revision + 1);
        }}
      />
      <NetworkScanModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSelect={(url, displayName) => {
          setLocalBaseUrl(url);
          setLocalConnectionName(displayName);
          setConnStatus("idle");
          setConnMessage("");
          setLocalAdvancedOpen(false);
        }}
      />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

