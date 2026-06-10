import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { presentError } from "../lib/errors";
import {
  IS_EXPO_GO,
  LOCAL_MODEL_CATALOG,
  LOCAL_NATIVE_BUILD_MESSAGE,
  LocalModelInfo,
  ejectOnDeviceModel,
  getLocalModelByKey,
  getLoadedOnDeviceModelKey,
  getQuickAccessLocalModels,
  isModelDownloaded,
} from "../lib/local-models";
import { resolveManagementBaseUrl } from "../lib/api";
import { useApp } from "../lib/context";
import { platformRemoteLabel, platformShellIcon, resolveModelPlatform } from "../lib/model-platform";
import { isSameModelId } from "../lib/model-id";
import { createModalTheme } from "../lib/modal-theme";
import DismissAffordance from "./DismissAffordance";
import SwipeDismissSheet from "./SwipeDismissSheet";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import ThemedError from "./ThemedError";
import { getLocalModelStatItems } from "./LocalModelsSection";
import { AnimatedLibraryRow } from "./LibraryModelSections";
import {
  LibraryCatalogRow,
  ModelStatLine,
  ModelTraitBadge,
  RemoteModelList,
} from "./ModelPicker";
import SectionHintLines, { createSectionSubtitleStyle } from "./SectionHintLines";
import ModelModeBadgeIcon from "./ModelModeBadgeIcon";
import SegmentedTabs from "./SegmentedTabs";
import ModelLibraryModal, { ModelLibraryTab } from "./ModelLibraryModal";
import ModelEjectProgressFill from "./ModelEjectProgressFill";
import ModelLoadProgressFill from "./ModelLoadProgressFill";
import ModelRowActionMute from "./ModelRowActionMute";
import {
  MODEL_ROW_ACTION_FADE_OUT_MS,
  MODEL_ROW_ACTION_MIN_MS,
} from "../lib/model-row-action";
import { useIndeterminateLoadProgress } from "../lib/use-indeterminate-load-progress";
import SwipeToDeleteRow from "./SwipeToDeleteRow";

export type ChatModelMode = "remote" | "local";

type Props = {
  visible: boolean;
  onClose: () => void;
  chatMode: ChatModelMode;
  onModeChange: (mode: ChatModelMode) => void;
  remoteModelId?: string;
  onRemoteSelect: (modelId: string | null) => void | Promise<void>;
  localModelKey: string | null;
  onLocalSelect: (key: string | null) => void;
  onOpenSettings: () => void;
  disableLocal?: boolean;
};

function getLocalModelDetailItems(model: LocalModelInfo, ready: boolean) {
  return getLocalModelStatItems(model, { useActualFileSize: ready });
}

function LocalModelRow({
  model,
  isSelected,
  ready,
  blocked,
  onPress,
  onLoad,
  onEject,
  ejecting,
  loading,
  styles,
  colors,
}: {
  model: LocalModelInfo;
  isSelected: boolean;
  ready: boolean;
  blocked?: boolean;
  ejecting?: boolean;
  loading?: boolean;
  onPress: () => void;
  onLoad?: () => void;
  onEject?: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const detailItems = getLocalModelDetailItems(model, ready);
  const canPress = ready || blocked;
  const actionActive = !!(loading || ejecting);
  const loadProgress = useIndeterminateLoadProgress(!!loading);

  const row = (
    <View style={styles.localRowShell}>
      {ejecting ? <ModelEjectProgressFill active /> : null}
      {loading ? <ModelLoadProgressFill progress={loadProgress} colors={colors} /> : null}
      <Pressable
        onPress={onPress}
        disabled={!canPress || actionActive}
        style={({ pressed }) => [
          styles.localRow,
          isSelected && styles.localRowSelected,
          !ready && !blocked && styles.localRowDisabled,
          pressed && canPress && !actionActive && styles.localRowPressed,
        ]}
      >
      <ModelRowActionMute
        active={actionActive}
        mode={ejecting ? "eject" : "load"}
        progress={loadProgress}
        style={styles.localRowMuteWrap}
      >
        <View style={styles.localIcon}>
          <ModelModeBadgeIcon
            platform="phone"
            provider={model.provider}
            label={model.name}
            size={22}
            color={isSelected ? colors.primaryLight : colors.textMuted}
            monochrome
          />
        </View>
        <View style={styles.localBody}>
          <View style={styles.localTitleRow}>
            <Text
              style={[styles.localName, isSelected && styles.localNameSelected]}
              numberOfLines={isSelected ? 2 : 1}
            >
              {model.name}
            </Text>
            <ModelTraitBadge
              trait={{ label: model.badge, color: model.badgeColor }}
              muted
              colors={colors}
            />
          </View>
          <ModelStatLine
            items={detailItems}
            colors={colors}
            textStyle={styles.localStats}
            muted
          />
        </View>
      </ModelRowActionMute>
      </Pressable>
    </View>
  );

  if (onLoad || onEject) {
    return (
      <SwipeToDeleteRow
        onLoad={onLoad}
        onEject={onEject}
        loadDisabled={blocked || !ready || loading}
        ejectDisabled={ejecting || loading}
        backgroundColor={colors.bgElevated}
      >
        {row}
      </SwipeToDeleteRow>
    );
  }

  return row;
}

function LocalModelPanel({
  active,
  selectedKey,
  onSelect,
  onOpenLibrary,
  blocked,
  selectError,
  onDismissSelectError,
  onActionComplete,
  styles,
  colors,
  bottomInset,
}: {
  active: boolean;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onOpenLibrary: () => void;
  blocked?: boolean;
  selectError?: string | null;
  onDismissSelectError?: () => void;
  onActionComplete?: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  bottomInset: number;
}) {
  const [ejectingKey, setEjectingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const quickAccessModels = useMemo(
    () => getQuickAccessLocalModels().filter((model) => !isModelDownloaded(model.filename)),
    [active]
  );
  const readyModels = useMemo(
    () => LOCAL_MODEL_CATALOG.filter((model) => isModelDownloaded(model.filename)),
    [active]
  );
  const runtimeLoadedKey = active ? getLoadedOnDeviceModelKey() : null;
  const effectiveLoadedKey =
    runtimeLoadedKey ??
    (selectedKey && readyModels.some((model) => model.key === selectedKey) ? selectedKey : null);
  const loadedModel =
    effectiveLoadedKey != null
      ? readyModels.find((model) => model.key === effectiveLoadedKey) ?? null
      : null;
  const idleReadyModels = readyModels.filter((model) => model.key !== effectiveLoadedKey);

  const performEject = async (model: LocalModelInfo) => {
    setEjectingKey(model.key);
    try {
      await Promise.all([
        ejectOnDeviceModel(model.key),
        new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
      ]);
      if (selectedKey === model.key) {
        await onSelect(null);
      }
    } finally {
      await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
      setEjectingKey(null);
      onActionComplete?.();
    }
  };

  const performLoad = async (model: LocalModelInfo) => {
    setLoadingKey(model.key);
    const started = Date.now();
    try {
      await onSelect(model.key);
    } finally {
      const remaining = MODEL_ROW_ACTION_MIN_MS - (Date.now() - started);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
      setLoadingKey(null);
    }
  };

  const handleReadyModelPress = (model: LocalModelInfo) => {
    if (selectedKey === model.key) {
      void performEject(model);
      return;
    }
    void performLoad(model);
  };

  const blockPres = blocked ? presentError(LOCAL_NATIVE_BUILD_MESSAGE, "local") : null;

  return (
    <View style={styles.localPanelRoot}>
      <ScrollView
        style={styles.localPanelScroll}
        contentContainerStyle={[styles.localScroll, { paddingBottom: bottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {blockPres ? (
        <View style={styles.localBlockBanner}>
          <Ionicons name={blockPres.icon} size={18} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={styles.localBlockTitle}>{blockPres.title}</Text>
            <Text style={styles.localBlockBody}>{LOCAL_NATIVE_BUILD_MESSAGE}</Text>
            {blockPres.hint ? (
              <Text style={styles.localBlockHint}>{blockPres.hint}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {selectError ? (
        <View style={styles.localSelectError}>
          <ThemedError
            variant="inline"
            message={selectError}
            kind="local"
            onDismiss={() => onDismissSelectError?.()}
          />
        </View>
      ) : null}
      {!blocked && readyModels.length === 0 && quickAccessModels.length === 0 ? (
        <View style={styles.localEmpty}>
          <Ionicons name="download-outline" size={28} color={colors.textDim} />
          <Text style={styles.localEmptyTitle}>No models on device</Text>
          <Text style={styles.localEmptyBody}>
            Download a model below or open the Model Library.
          </Text>
        </View>
      ) : readyModels.length > 0 ? (
        <>
          {loadedModel ? (
            <View style={styles.localSection}>
              <Text style={styles.localSectionLabel}>Loaded in memory</Text>
              <SectionHintLines colors={colors} line="Swipe left to eject" />
              <AnimatedLibraryRow rowKey={loadedModel.key}>
                <LocalModelRow
                  model={loadedModel}
                  ready
                  blocked={blocked}
                  isSelected={selectedKey === loadedModel.key}
                  ejecting={ejectingKey === loadedModel.key}
                  loading={loadingKey === loadedModel.key}
                  onPress={() => handleReadyModelPress(loadedModel)}
                  onEject={blocked ? undefined : () => void performEject(loadedModel)}
                  styles={styles}
                  colors={colors}
                />
              </AnimatedLibraryRow>
            </View>
          ) : null}
          {idleReadyModels.length > 0 ? (
            <View style={[styles.localSection, loadedModel ? styles.localSectionSpaced : undefined]}>
              <Text style={styles.localSectionLabel}>Installed on device</Text>
              <SectionHintLines colors={colors} line="Swipe right to load" />
              {idleReadyModels.map((model) => (
                <AnimatedLibraryRow key={model.key} rowKey={model.key}>
                  <LocalModelRow
                    model={model}
                    ready
                    blocked={blocked}
                    isSelected={selectedKey === model.key}
                    ejecting={ejectingKey === model.key}
                    loading={loadingKey === model.key}
                    onPress={() => handleReadyModelPress(model)}
                    onLoad={
                      blocked || selectedKey === model.key
                        ? undefined
                        : () => void performLoad(model)
                    }
                    onEject={
                      blocked || selectedKey !== model.key
                        ? undefined
                        : () => void performEject(model)
                    }
                    styles={styles}
                    colors={colors}
                  />
                </AnimatedLibraryRow>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {quickAccessModels.length > 0 ? (
        <View
          style={[
            styles.localSection,
            readyModels.length > 0 || blockPres ? styles.localSectionSpaced : undefined,
          ]}
        >
          <Text style={styles.localSectionLabel}>Quick download</Text>
          <SectionHintLines colors={colors} line="Tap download to open Model Library" />
          {quickAccessModels.map((model) => (
            <LibraryCatalogRow
              key={model.key}
              platform="phone"
              provider={model.provider}
              name={model.name}
              trait={{ label: model.badge, color: model.badgeColor }}
              statItems={getLocalModelStatItems(model)}
              onDownload={onOpenLibrary}
              disabled={blocked}
              colors={colors}
            />
          ))}
        </View>
      ) : null}

      <Pressable style={[styles.manageBtn, styles.manageBtnInScroll]} onPress={onOpenLibrary}>
        <Ionicons name="library-outline" size={16} color={colors.textMuted} />
        <Text style={styles.manageBtnText}>Open Model Library</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

export default function ChatModelPicker({
  visible,
  onClose,
  chatMode,
  onModeChange,
  remoteModelId,
  onRemoteSelect,
  localModelKey,
  onLocalSelect,
  onOpenSettings,
  disableLocal,
}: Props) {
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const { colors, isDark } = useTheme();
  const palette = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const modalStyles = useMemo(() => createModalTheme(palette), [palette]);
  const [tab, setTab] = useState<ChatModelMode>(chatMode);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTab, setLibraryTab] = useState<ModelLibraryTab>("system");
  const [localSelectError, setLocalSelectError] = useState<string | null>(null);
  const localBlocked = IS_EXPO_GO || !!disableLocal;

  const remotePlatform = useMemo(
    () => resolveModelPlatform("remote", settings.baseUrl),
    [settings.baseUrl]
  );
  const managementUrl = useMemo(
    () => resolveManagementBaseUrl(settings),
    [settings.baseUrl, settings.localServerUrl]
  );
  const modeTabs = useMemo(
    () => [
      {
        id: "remote" as const,
        label: platformRemoteLabel(remotePlatform),
        icon: platformShellIcon(remotePlatform),
      },
      {
        id: "local" as const,
        label: "On-Device",
        icon: "phone-portrait-outline" as const,
      },
    ],
    [remotePlatform]
  );

  useEffect(() => {
    if (visible) {
      setTab(chatMode);
      setShowLibrary(false);
      setLocalSelectError(null);
    }
  }, [visible, chatMode]);

  const openLibrary = (initialTab: ModelLibraryTab) => {
    setLibraryTab(initialTab);
    setShowLibrary(true);
  };

  const handleModeChange = (mode: ChatModelMode) => {
    if (mode !== tab) {
      void Haptics.selectionAsync();
      setLocalSelectError(null);
    }
    setTab(mode);
    onModeChange(mode);
  };

  const handleRemoteSelect = useCallback(
    async (modelId: string | null) => {
      if (modelId === null) {
        await onRemoteSelect(null);
        onClose();
        return;
      }

      if (isSameModelId(remoteModelId, modelId)) {
        await onRemoteSelect(null);
        onClose();
        return;
      }

      await onRemoteSelect(modelId);
      onClose();
    },
    [remoteModelId, onRemoteSelect, onClose]
  );

  const handleClose = () => {
    onClose();
  };

  const handleRequestClose = () => {
    if (showLibrary) {
      setShowLibrary(false);
      return;
    }
    handleClose();
  };

  const handleLocalSelect = async (key: string | null) => {
    if (key === null) {
      await onLocalSelect(null);
      onClose();
      return;
    }
    if (localBlocked) {
      setLocalSelectError(LOCAL_NATIVE_BUILD_MESSAGE);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const model = getLocalModelByKey(key);
    if (!model || !isModelDownloaded(model.filename)) {
      openLibrary("device");
      return;
    }
    if (localModelKey === key) {
      await onLocalSelect(null);
      onClose();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onLocalSelect(key);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <GestureHandlerRootView style={[modalStyles.pageContainer, { flex: 1 }]}>
      <SwipeDismissSheet direction="down" onDismiss={handleClose} style={modalStyles.pageContainer}>
      <View style={[modalStyles.pageContainer, { paddingTop: insets.top }]}>
        <View style={modalStyles.pageHeader}>
          <DismissAffordance kind="down" colors={palette} />
          <Text style={modalStyles.pageTitle}>Choose Model</Text>
          <View style={modalStyles.pageHeaderBtn} />
        </View>

        <View style={styles.tabsWrap}>
          <SegmentedTabs
            tabs={modeTabs}
            selected={tab}
            onChange={handleModeChange}
            colors={palette}
          />
        </View>

        <View style={styles.body}>
          {tab === "remote" ? (
            <RemoteModelList
              active={visible && tab === "remote" && !showLibrary}
              selectedModelId={remoteModelId}
              onSelect={handleRemoteSelect}
              onActionComplete={onClose}
              onOpenLibrary={() => openLibrary("system")}
              serverUrl={managementUrl ?? settings.baseUrl}
              platform={remotePlatform}
              bottomInset={insets.bottom + 16}
              suggestedLimit={8}
              monochromeIcons
              hideSearch
              quickAccessCatalog
              libraryLayout
            />
          ) : (
            <LocalModelPanel
              active={visible && tab === "local" && !showLibrary}
              selectedKey={localModelKey}
              onSelect={handleLocalSelect}
              onActionComplete={onClose}
              onOpenLibrary={() => openLibrary("device")}
              blocked={localBlocked}
              selectError={localSelectError}
              onDismissSelectError={() => setLocalSelectError(null)}
              styles={styles}
              colors={palette}
              bottomInset={insets.bottom}
            />
          )}
        </View>

      </View>
      </SwipeDismissSheet>

      <ModelLibraryModal
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
        initialTab={libraryTab}
      />
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1 },
    tabsWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
    localPanelRoot: { flex: 1 },
    localPanelScroll: { flex: 1 },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, color: colors.inputText, fontSize: 15, padding: 0 },
    localScroll: { paddingHorizontal: 16, paddingTop: 4 },
    localBlockBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      marginBottom: 12,
      borderRadius: radii.md,
      backgroundColor: "rgba(245,158,11,0.08)",
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.28)",
    },
    localBlockTitle: {
      color: "#f59e0b",
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 4,
    },
    localBlockBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    localBlockHint: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    localSection: { marginBottom: 4 },
    localSectionSpaced: { marginTop: 16 },
    localSectionLabel: createSectionSubtitleStyle(colors),
    localRowShell: {
      position: "relative",
      overflow: "hidden",
    },
    localRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 2,
    },
    localRowSelected: { backgroundColor: colors.primaryGlow, borderRadius: radii.sm },
    localRowMuteWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      minWidth: 0,
    },
    localSelectError: { marginBottom: 12 },
    localRowDisabled: { opacity: 0.6 },
    localRowPressed: { opacity: 0.75 },
    localIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    localBody: { flex: 1, minWidth: 0 },
    localTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    localName: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 22, flexShrink: 1 },
    localNameSelected: { color: colors.primaryLight },
    localStats: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    localEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 8,
    },
    localEmptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 8 },
    localEmptyBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      maxWidth: 280,
    },
    manageBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    manageBtnInScroll: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    manageBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  });
}
