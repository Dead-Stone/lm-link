import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView as DeckScrollView,
  ScrollView as GHScrollView,
} from "react-native-gesture-handler";
import Reanimated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorFromUnknown, presentError } from "../lib/errors";
import {
  IS_EXPO_GO,
  LOCAL_MODEL_CATALOG,
  LOCAL_NATIVE_BUILD_MESSAGE,
  LocalModelInfo,
  ejectOnDeviceModel,
  getLocalModelByKey,
  getLoadedOnDeviceModelKey,
  isModelDownloaded,
  subscribeOnDeviceModelLoaded,
  waitForOnDeviceModelLoaded,
} from "../lib/local-models";
import { localModelDownloadStore } from "../lib/local-model-download-store";
import {
  ModelCapabilityFilter,
  modelMatchesCapabilityFilter,
} from "../lib/vision-models";
import {
  ejectRemoteModel,
  fetchModels,
  getEffectiveLocalServerUrl,
  normalizeServiceUrl,
  partitionLibraryModels,
  resolveManagementApiKey,
  resolveManagementBaseUrl,
} from "../lib/api";
import { useApp } from "../lib/context";
import { isChatSelectableLmModel } from "../lib/lmstudio-downloadable";
import { parseModelName } from "../lib/model-name";
import { platformRemoteLabel, platformShellIcon, resolveModelPlatform } from "../lib/model-platform";
import { resolveInstalledRemoteCatalogSource } from "../lib/library-filters";
import { readAboutPhoneStats } from "../lib/about-phone";
import { playModelLoadSound, playModelUnloadSound } from "../lib/model-picker-sounds";
import {
  formatServerHost,
  resolveConnectionDisplayName,
  resolveServerDisplayName,
} from "../lib/scan-device-names";
import { LibraryDownloadSource } from "../lib/remote-model-library";
import { LMModel, ModelPlatform, Settings } from "../lib/types";
import { isSameModelId } from "../lib/model-id";
import { createModalTheme } from "../lib/modal-theme";
import { modalPageTopPadding } from "../lib/safe-area-layout";
import DismissAffordance from "./DismissAffordance";
import SwipeDismissSheet, { SwipeDismissSheetHandle } from "./SwipeDismissSheet";
import { getSettingsPalette, radii, ThemeColors, useTheme } from "../lib/theme";
import ThemedError from "./ThemedError";
import { getLocalModelStatItems } from "./LocalModelsSection";
import { AnimatedLibraryRow } from "./LibraryModelSections";
import {
  getRemoteInstalledStatItems,
  ModelModalityFilters,
  ModelStatItem,
  ModelStatLine,
  ModelTraitBadge,
  RemoteModelList,
  sizeLabelFromStatItems,
  statItemsWithoutSize,
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
  MODEL_ROW_EJECT_FILL_MS,
} from "../lib/model-row-action";
import { useIndeterminateLoadProgress } from "../lib/use-indeterminate-load-progress";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import ThemedConfirmDialog from "./ThemedConfirmDialog";

export type ChatModelMode = "remote" | "local";

type Props = {
  visible: boolean;
  onClose: () => void;
  chatMode: ChatModelMode;
  remoteModelId?: string;
  onRemoteSelect: (modelId: string | null) => void | Promise<void>;
  localModelKey: string | null;
  onLocalSelect: (key: string | null) => void | Promise<void>;
  /** Loaded deck tap — open a matching recent chat or a new one (picker dismisses after). */
  onLoadedRemoteActivate?: (modelId: string) => void | Promise<void>;
  onLoadedLocalActivate?: (key: string) => void | Promise<void>;
  onOpenSettings: () => void;
  disableLocal?: boolean;
  /** Avoid a loading flash in the installed list while the sheet slides up. */
  prefetchedRemoteModels?: LMModel[];
};

function getLocalModelDetailItems(model: LocalModelInfo, ready: boolean) {
  return getLocalModelStatItems(model, { useActualFileSize: ready });
}

const LOADED_DECK_ICON_SIZE = 78;
/** Loaded deck shows this many slots in the viewport; sideways scroll advances one slot at a time. */
const LOADED_DECK_VISIBLE_SLOTS = 2;
const LOADED_DECK_GLOW_SIZE = LOADED_DECK_ICON_SIZE + 20;
/** Header row + bottom padding below the drag handle (safe-area padding is added separately). */
const CHOOSE_MODEL_HEADER_BAND = 56;

const AnimatedGHScrollView = Reanimated.createAnimatedComponent(GHScrollView);
type ModelSelectOptions = {
  /** Close picker right away — e.g. tapping an already-loaded deck card to start chat. */
  immediate?: boolean;
};

const LOADED_DECK_RADIAL_GLOW_LAYERS = [
  { scale: 1, alpha: 0.05 },
  { scale: 0.84, alpha: 0.09 },
  { scale: 0.68, alpha: 0.15 },
  { scale: 0.5, alpha: 0.24 },
  { scale: 0.32, alpha: 0.38 },
] as const;

function resolveDeckCatalogSource(
  platform: ModelPlatform,
  modelId: string | null
): LibraryDownloadSource {
  if (platform === "phone") return "huggingface";
  if (modelId) return resolveInstalledRemoteCatalogSource(modelId);
  return "lmstudio";
}

type LoadedDeckSlotKind = "chat" | "local" | "phone";

type LoadedDeckSlotDefinition = {
  id: string;
  kind: LoadedDeckSlotKind;
  platform: ModelPlatform;
  sectionLabel: string;
  listUrl: string | null;
  networkLinked: boolean;
  hostHint: string | null;
  networkName: string | null;
};

function buildLoadedDeckSlots(
  settings: Settings,
  remotePlatform: ModelPlatform
): LoadedDeckSlotDefinition[] {
  const slots: LoadedDeckSlotDefinition[] = [];
  const baseUrl = settings.baseUrl.trim();
  const localUrl = getEffectiveLocalServerUrl(settings);
  const baseKey = baseUrl ? normalizeServiceUrl(baseUrl) : "";
  const localKey = localUrl ? normalizeServiceUrl(localUrl) : "";
  const localDistinct = !!localKey && localKey !== baseKey;
  const pcConnectionName = settings.serverConnectionName;
  const phoneNetworkName = readAboutPhoneStats().deviceLabel;

  slots.push({
    id: "chat",
    kind: "chat",
    platform: remotePlatform,
    sectionLabel: remotePlatform === "hub" ? "Hub" : "Computer",
    listUrl: baseUrl || null,
    networkLinked: remotePlatform === "pc",
    hostHint: baseUrl ? formatServerHost(baseUrl) : null,
    networkName: baseUrl
      ? remotePlatform === "pc"
        ? resolveConnectionDisplayName(baseUrl, pcConnectionName)
        : resolveServerDisplayName(baseUrl)
      : null,
  });

  if (localDistinct) {
    slots.push({
      id: "local",
      kind: "local",
      platform: "pc",
      sectionLabel: "Computer",
      listUrl: localUrl,
      networkLinked: true,
      hostHint: formatServerHost(localUrl),
      networkName: resolveConnectionDisplayName(localUrl, pcConnectionName),
    });
  }

  slots.push({
    id: "phone",
    kind: "phone",
    platform: "phone",
    sectionLabel: "Phone",
    listUrl: null,
    networkLinked: false,
    hostHint: "localhost",
    networkName: phoneNetworkName,
  });

  return slots.filter((slot) => slot.platform !== "pc" || slot.networkLinked);
}

function loadedDeckTraitStatItems(items: ModelStatItem[]): ModelStatItem[] {
  return statItemsWithoutSize(items).filter((item) => item.icon !== "business-outline");
}

function resolveRemoteLoadedModel(
  catalog: LMModel[],
  activeModelId: string | null,
  singleModelMode: boolean
): LMModel | null {
  const selectable = catalog
    .filter((model) => isChatSelectableLmModel(model))
    .sort((a, b) =>
      parseModelName(a.id).displayName.localeCompare(parseModelName(b.id).displayName)
    );
  const { loaded } = partitionLibraryModels(selectable, {
    activeModelId: activeModelId ?? undefined,
    singleModelMode,
  });
  return loaded[0] ?? null;
}

function LoadedModelDeckIcon({
  platform,
  present,
  ejecting,
  pulseToken,
  badgeModelId,
  provider,
  label,
  catalogSource,
  networkLinked,
  colors,
  styles,
}: {
  platform: ModelPlatform;
  present: boolean;
  ejecting?: boolean;
  pulseToken?: number;
  badgeModelId: string | null;
  provider: string | null;
  label: string | null;
  catalogSource: LibraryDownloadSource | null;
  networkLinked: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const accent = present ? colors.primaryLight : colors.textDim;
  const wifiSize = Math.max(11, Math.round(LOADED_DECK_ICON_SIZE * 0.2));
  const scale = useRef(new Animated.Value(present ? 1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(present ? 1 : 0.78)).current;
  const activeFade = useRef(new Animated.Value(present ? 0.48 : 0)).current;
  const showActiveHalo = present && !ejecting;

  useEffect(() => {
    if (!pulseToken) return;
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.1,
          friction: 5,
          tension: 96,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 82,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(activeFade, {
          toValue: 0.92,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(activeFade, {
          toValue: 0.48,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [pulseToken, scale, activeFade]);

  useEffect(() => {
    if (ejecting) {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: MODEL_ROW_EJECT_FILL_MS * 0.55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.78,
          duration: MODEL_ROW_EJECT_FILL_MS * 0.55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(activeFade, {
          toValue: 0,
          duration: MODEL_ROW_EJECT_FILL_MS * 0.45,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (present) {
      scale.setValue(1);
      opacity.setValue(1);
      activeFade.setValue(0.48);
      return;
    }

    scale.setValue(0.9);
    opacity.setValue(0.78);
    activeFade.setValue(0);
  }, [present, ejecting, scale, opacity, activeFade]);

  const glowColor = "#6d28d9";

  return (
    <View style={styles.loadedDeckIconWrap}>
      {showActiveHalo ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.loadedDeckRadialGlow,
            { width: LOADED_DECK_GLOW_SIZE, height: LOADED_DECK_GLOW_SIZE, opacity: activeFade },
          ]}
        >
          {LOADED_DECK_RADIAL_GLOW_LAYERS.map((layer, index) => {
            const size = LOADED_DECK_GLOW_SIZE * layer.scale;
            const offset = (LOADED_DECK_GLOW_SIZE - size) / 2;
            return (
              <View
                key={index}
                style={[
                  styles.loadedDeckRadialGlowLayer,
                  {
                    left: offset,
                    top: offset,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: glowColor,
                    opacity: layer.alpha,
                  },
                ]}
              />
            );
          })}
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          styles.loadedDeckIconInner,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <ModelModeBadgeIcon
          platform={platform}
          modelId={badgeModelId}
          provider={provider}
          label={label}
          size={LOADED_DECK_ICON_SIZE}
          color={accent}
          colorfulLogo={present}
          monochrome={!present}
          shellOnly={!present}
          catalogSource={present ? catalogSource : null}
          catalogSourceScale={0.32}
        />
        {networkLinked ? (
          <View style={[styles.loadedDeckWifiBadge, { width: wifiSize, height: wifiSize }]}>
            <Ionicons name="wifi" size={wifiSize - 2} color={colors.primaryLight} />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function LoadedModelPlayingCard({
  platform,
  present,
  sectionLabel,
  title,
  subtitle,
  statItems,
  badgeModelId,
  provider,
  catalogSource,
  networkLinked,
  networkName,
  hostHint,
  onIconPress,
  onBodyPress,
  onLongPress,
  ejecting,
  presentPulseToken,
  styles,
  colors,
}: {
  platform: ModelPlatform;
  present: boolean;
  presentPulseToken?: number;
  sectionLabel: string;
  title: string;
  subtitle: string | null;
  statItems: ReturnType<typeof getLocalModelDetailItems>;
  badgeModelId: string | null;
  provider: string | null;
  catalogSource: LibraryDownloadSource | null;
  networkLinked: boolean;
  networkName: string | null;
  hostHint: string | null;
  onIconPress: () => void;
  onBodyPress: () => void;
  onLongPress?: () => void;
  ejecting?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const [pulseToken, setPulseToken] = useState(0);
  const showLoaded = present && !ejecting;
  const isNetworkPlaceholder = !showLoaded;
  const iconPresent = showLoaded;
  const iconModelId = iconPresent ? badgeModelId : null;
  const iconProvider = iconPresent ? provider : null;
  const iconLabel = iconPresent ? title : null;
  const iconCatalogSource = iconPresent ? catalogSource : null;
  const displayTitle = showLoaded ? title : networkName ?? sectionLabel;
  const sizeLabel = showLoaded ? sizeLabelFromStatItems(statItems) : null;
  const providerLabel = showLoaded ? provider ?? subtitle : null;
  const traitStats = showLoaded ? loadedDeckTraitStatItems(statItems) : [];
  const metaParts = [providerLabel, sizeLabel].filter(
    (part): part is string => !!part?.trim()
  );
  const showMetaAndStats = showLoaded && metaParts.length > 0;
  const showNetworkHost =
    isNetworkPlaceholder &&
    !!hostHint?.trim() &&
    (networkLinked || platform === "phone");
  const bodyOpacity = useRef(new Animated.Value(1)).current;
  const bodyTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ejecting) {
      if (platform === "pc") {
        bodyOpacity.setValue(1);
        bodyTranslateY.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(bodyOpacity, {
            toValue: 0,
            duration: MODEL_ROW_EJECT_FILL_MS * 0.85,
            delay: 70,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(bodyTranslateY, {
            toValue: 6,
            duration: MODEL_ROW_EJECT_FILL_MS * 0.85,
            delay: 70,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
      return;
    }

    bodyOpacity.setValue(1);
    bodyTranslateY.setValue(0);
  }, [ejecting, platform, bodyOpacity, bodyTranslateY]);

  const bumpPulse = useCallback(() => {
    setPulseToken((token) => token + 1);
  }, []);

  const handleIconPress = useCallback(() => {
    if (!showLoaded) return;
    bumpPulse();
    onIconPress();
  }, [bumpPulse, onIconPress, showLoaded]);

  const handleBodyPress = useCallback(() => {
    if (showLoaded) bumpPulse();
    onBodyPress();
  }, [bumpPulse, onBodyPress, showLoaded]);

  const interactionsDisabled = ejecting;
  const slotInteractive = showLoaded && !interactionsDisabled;

  return (
    <View style={styles.loadedDeckColumn}>
      <Text style={styles.loadedDeckSectionLabel}>{sectionLabel}</Text>
      <Pressable
        onPress={handleIconPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        disabled={!slotInteractive}
        style={({ pressed }) => [
          styles.loadedDeckIconButton,
          !showLoaded && styles.loadedDeckIconButtonEmpty,
          pressed && slotInteractive && styles.loadedCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !slotInteractive }}
        accessibilityLabel={
          showLoaded
            ? `Chat with ${title}`
            : `No model loaded on ${sectionLabel.toLowerCase()}`
        }
      >
        <LoadedModelDeckIcon
          platform={platform}
          present={iconPresent}
          ejecting={ejecting}
          pulseToken={pulseToken + (presentPulseToken ?? 0)}
          badgeModelId={iconModelId}
          provider={iconProvider}
          label={iconLabel}
          catalogSource={iconCatalogSource}
          networkLinked={networkLinked}
          colors={colors}
          styles={styles}
        />
      </Pressable>
      <Animated.View
        style={{
          opacity: bodyOpacity,
          transform: [{ translateY: bodyTranslateY }],
          width: "100%",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={handleBodyPress}
          onLongPress={onLongPress}
          delayLongPress={400}
          disabled={!slotInteractive}
          style={({ pressed }) => [
            styles.loadedDeckDetails,
            !showLoaded && styles.loadedDeckDetailsEmpty,
            pressed && slotInteractive && styles.loadedCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            showLoaded
              ? `Chat with ${title}. Long press to eject.`
              : isNetworkPlaceholder && networkName
                ? `${networkName}${showNetworkHost ? ` · ${hostHint}` : ""} — browse models`
                : `No ${sectionLabel.toLowerCase()} model loaded`
          }
        >
          <Text
            style={[styles.loadedDeckTitle, showLoaded && styles.loadedDeckTitleActive]}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          {showNetworkHost ? (
            <Text style={styles.loadedDeckHostHint} numberOfLines={1}>
              {hostHint}
            </Text>
          ) : null}
          {showMetaAndStats ? (
            <Text style={styles.loadedDeckMeta} numberOfLines={1}>
              {providerLabel ? (
                <Text style={styles.loadedDeckMetaProvider}>{providerLabel}</Text>
              ) : null}
              {providerLabel && sizeLabel ? (
                <Text style={styles.loadedDeckMetaSep}> · </Text>
              ) : null}
              {sizeLabel ? (
                <Text style={styles.loadedDeckMetaSize}>{sizeLabel}</Text>
              ) : null}
            </Text>
          ) : null}
        </Pressable>
        {showLoaded && traitStats.length > 0 ? (
          <ModelStatLine
            items={traitStats}
            colors={colors}
            textStyle={styles.loadedCardStats}
            rowStyle={styles.loadedDeckStatsRow}
            maxItems={3}
            muted={false}
            centered
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

function LoadedModelDeck({
  active,
  remotePlatform,
  remoteModelId,
  refreshToken,
  interactionsLocked,
  onUseRemote,
  onUseLocal,
  onRemoteEjected,
  onLocalEjected,
  styles,
  colors,
}: {
  active: boolean;
  remotePlatform: ModelPlatform;
  remoteModelId?: string;
  refreshToken?: number;
  interactionsLocked?: boolean;
  onUseRemote: (modelId: string) => void;
  onUseLocal: (key: string) => void;
  onRemoteEjected: (modelId: string) => void | Promise<void>;
  onLocalEjected: (key: string) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const { settings, account } = useApp();
  const managementApiKey = useMemo(
    () => resolveManagementApiKey(settings, account),
    [settings.baseUrl, settings.localServerUrl, settings.apiKey, account?.token]
  );
  const [catalogs, setCatalogs] = useState<Record<string, LMModel[]>>({});
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [deviceLoadedKey, setDeviceLoadedKey] = useState<string | null>(null);
  const [phonePresentPulse, setPhonePresentPulse] = useState(0);
  const [ejectingSlotId, setEjectingSlotId] = useState<string | null>(null);
  const [ejectError, setEjectError] = useState<string | null>(null);
  const [deckWidth, setDeckWidth] = useState(0);
  const deckScrollRef = useRef<DeckScrollView>(null);

  const slots = useMemo(
    () => buildLoadedDeckSlots(settings, remotePlatform),
    [settings.baseUrl, settings.localServerUrl, remotePlatform]
  );
  const listUrls = useMemo(
    () =>
      [...new Set(slots.map((slot) => slot.listUrl).filter((url): url is string => !!url))],
    [slots]
  );
  const slotWidth = deckWidth > 0 ? deckWidth / LOADED_DECK_VISIBLE_SLOTS : 0;
  const canScroll = slots.length > LOADED_DECK_VISIBLE_SLOTS && slotWidth > 0;
  const deckSnapOffsets = useMemo(() => {
    if (!canScroll || slotWidth <= 0) return undefined;
    const maxStartIndex = slots.length - LOADED_DECK_VISIBLE_SLOTS;
    return Array.from({ length: maxStartIndex + 1 }, (_, index) => index * slotWidth);
  }, [canScroll, slotWidth, slots.length]);

  useEffect(() => {
    if (!active) return;
    setDeviceLoadedKey(getLoadedOnDeviceModelKey());
  }, [active]);

  useEffect(() => {
    if (!refreshToken) return;
    setCatalogRefreshKey((key) => key + 1);
    const key = getLoadedOnDeviceModelKey();
    setDeviceLoadedKey(key);
    if (key) setPhonePresentPulse((token) => token + 1);
  }, [refreshToken]);

  useEffect(() => {
    if (!active) return;
    return subscribeOnDeviceModelLoaded((key) => {
      setDeviceLoadedKey(key);
    });
  }, [active]);

  useEffect(() => {
    if (!active || listUrls.length === 0) {
      setCatalogs({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      listUrls.map(async (url) => {
        try {
          const models = await fetchModels(url, managementApiKey);
          return { url, models };
        } catch {
          return { url, models: [] as LMModel[] };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setCatalogs((prev) => {
        const next = { ...prev };
        for (const { url, models } of results) next[url] = models;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [active, listUrls, managementApiKey, catalogRefreshKey]);

  const performPhoneEject = useCallback(
    async (model: LocalModelInfo) => {
      setEjectingSlotId("phone");
      setEjectError(null);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Promise.all([
          ejectOnDeviceModel(model.key),
          new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
        ]);
        void playModelUnloadSound();
        setDeviceLoadedKey(getLoadedOnDeviceModelKey());
        await onLocalEjected(model.key);
      } catch (error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setEjectError(errorFromUnknown(error));
      } finally {
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setEjectingSlotId(null);
      }
    },
    [onLocalEjected]
  );

  const performRemoteEject = useCallback(
    async (modelId: string, slotId: string) => {
      setEjectingSlotId(slotId);
      setEjectError(null);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Promise.all([
          ejectRemoteModel(settings, modelId, account?.token),
          new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
        ]);
        void playModelUnloadSound();
        setCatalogRefreshKey((key) => key + 1);
        await onRemoteEjected(modelId);
      } catch (error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setEjectError(errorFromUnknown(error));
      } finally {
        await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
        setEjectingSlotId(null);
      }
    },
    [settings, account?.token, onRemoteEjected]
  );

  const phoneLoadedModel =
    deviceLoadedKey != null ? getLocalModelByKey(deviceLoadedKey) ?? null : null;
  const singleModelMode = settings.singleModelMode !== false;
  const activeRemoteModelId =
    remoteModelId?.trim() || settings.defaultModel?.trim() || null;

  const slotCards = slots.map((slot) => {
    if (slot.kind === "phone") {
      const phoneStats = phoneLoadedModel
        ? getLocalModelDetailItems(phoneLoadedModel, true)
        : [];
      const badgeModelId = phoneLoadedModel?.downloadUrl ?? null;
      return {
        slot,
        present: !!phoneLoadedModel,
        title: phoneLoadedModel?.name ?? slot.networkName ?? slot.sectionLabel,
        subtitle: phoneLoadedModel?.provider ?? slot.hostHint,
        statItems: phoneStats,
        badgeModelId,
        provider: phoneLoadedModel?.provider ?? null,
        catalogSource: resolveDeckCatalogSource(slot.platform, badgeModelId),
        onIconPress: () => {
          if (phoneLoadedModel) onUseLocal(phoneLoadedModel.key);
        },
        onBodyPress: () => {
          if (phoneLoadedModel) onUseLocal(phoneLoadedModel.key);
        },
        networkName: slot.networkName,
        onLongPress: phoneLoadedModel
          ? () => void performPhoneEject(phoneLoadedModel)
          : undefined,
      };
    }

    const catalog = slot.listUrl ? catalogs[slot.listUrl] ?? [] : [];
    const remoteLoadedModel = resolveRemoteLoadedModel(
      catalog,
      slot.kind === "chat" ? activeRemoteModelId : null,
      singleModelMode
    );
    const parsed = remoteLoadedModel ? parseModelName(remoteLoadedModel.id) : null;
    const publisher =
      remoteLoadedModel?.publisher ??
      remoteLoadedModel?.owned_by ??
      parsed?.family ??
      null;
    const stats = remoteLoadedModel
      ? getRemoteInstalledStatItems(remoteLoadedModel, catalog)
      : [];
    const badgeModelId = remoteLoadedModel?.id ?? null;

    return {
      slot,
      present: !!remoteLoadedModel,
      title: remoteLoadedModel
        ? (parsed?.displayName ?? platformRemoteLabel(slot.platform))
        : slot.networkName ?? slot.sectionLabel,
      subtitle: publisher ?? slot.hostHint,
      statItems: stats,
      badgeModelId,
      provider: publisher,
      catalogSource: resolveDeckCatalogSource(slot.platform, badgeModelId),
      networkName: slot.networkName,
      onIconPress: () => {
        if (remoteLoadedModel) onUseRemote(remoteLoadedModel.id);
      },
      onBodyPress: () => {
        if (remoteLoadedModel) onUseRemote(remoteLoadedModel.id);
      },
      onLongPress: remoteLoadedModel
        ? () => void performRemoteEject(remoteLoadedModel.id, slot.id)
        : undefined,
    };
  });

  return (
    <View
      style={styles.loadedDeck}
      pointerEvents={interactionsLocked ? "none" : "auto"}
    >
      <View style={styles.loadedDeckHeader}>
        <Text style={styles.loadedDeckLabel}>Loaded models</Text>
        <Text style={styles.loadedDeckHint}>
          {canScroll
            ? "Swipe sideways · Tap loaded to chat · Long press to eject"
            : "Tap loaded to chat · Long press to eject"}
        </Text>
      </View>
      {ejectError ? (
        <ThemedError
          message={ejectError}
          variant="inline"
          onDismiss={() => setEjectError(null)}
        />
      ) : null}
      <View
        style={styles.loadedDeckViewport}
        onLayout={(event) => setDeckWidth(event.nativeEvent.layout.width)}
      >
        <DeckScrollView
          ref={deckScrollRef}
          horizontal
          nestedScrollEnabled
          scrollEnabled={canScroll && !interactionsLocked}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToOffsets={deckSnapOffsets}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={styles.loadedDeckScrollContent}
        >
          {slotCards.map((entry, index) => (
            <View
              key={entry.slot.id}
              style={[
                styles.loadedDeckSlot,
                slotWidth > 0 ? { width: slotWidth } : { flex: 1 },
              ]}
            >
              <LoadedModelPlayingCard
                platform={entry.slot.platform}
                present={entry.present}
                presentPulseToken={
                  entry.slot.kind === "phone" ? phonePresentPulse : undefined
                }
                sectionLabel={entry.slot.sectionLabel}
                title={entry.title}
                subtitle={entry.subtitle}
                statItems={entry.statItems}
                badgeModelId={entry.badgeModelId}
                provider={entry.provider}
                catalogSource={entry.catalogSource}
                networkLinked={entry.slot.networkLinked}
                networkName={entry.networkName}
                hostHint={entry.slot.hostHint}
                onIconPress={entry.onIconPress}
                onBodyPress={entry.onBodyPress}
                onLongPress={entry.onLongPress}
                ejecting={ejectingSlotId === entry.slot.id}
                styles={styles}
                colors={colors}
              />
              {index < slotCards.length - 1 ? (
                <View style={styles.loadedDeckDivider} />
              ) : null}
            </View>
          ))}
        </DeckScrollView>
      </View>
    </View>
  );
}

function LocalModelRow({
  model,
  isSelected,
  ready,
  blocked,
  onPress,
  onLoad,
  onEject,
  onDelete,
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
  onDelete?: () => void;
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
            modelId={model.downloadUrl}
            provider={model.provider}
            label={model.name}
            size={26}
            color={isSelected ? colors.primaryLight : colors.textMuted}
            monochrome={!isSelected}
            catalogSource="huggingface"
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
              muted={!isSelected}
              colors={colors}
            />
          </View>
          <ModelStatLine
            items={detailItems}
            colors={colors}
            textStyle={styles.localStats}
            muted={!isSelected}
          />
        </View>
      </ModelRowActionMute>
      </Pressable>
    </View>
  );

  if (onLoad || onEject || onDelete) {
    return (
      <SwipeToDeleteRow
        onLoad={onLoad}
        onEject={onEject}
        onDelete={onDelete}
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

function ChooseModelLibraryFooter({
  onPress,
  colors,
  styles,
  bottomInset,
}: {
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  bottomInset: number;
}) {
  return (
    <View style={[styles.libraryFooter, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.libraryFooterButton,
          pressed && styles.libraryFooterButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open Model Library"
      >
        <View style={styles.libraryFooterIcon}>
          <Ionicons name="library-outline" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.libraryFooterTextCol}>
          <Text style={styles.libraryFooterTitle}>Model Library</Text>
          <Text style={styles.libraryFooterSubtitle}>Browse & download models</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

function LocalModelPanel({
  active,
  activeChatMode,
  selectedKey,
  onSelect,
  onOpenLibrary,
  blocked,
  selectError,
  onDismissSelectError,
  onActionComplete,
  capabilityFilter,
  onCapabilityFilterChange,
  styles,
  colors,
  bottomInset,
  embedInParentScroll = false,
}: {
  active: boolean;
  /** Chat's active mode — local tab is browse-only when this is still "remote". */
  activeChatMode: ChatModelMode;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onOpenLibrary?: () => void;
  blocked?: boolean;
  selectError?: string | null;
  onDismissSelectError?: () => void;
  onActionComplete?: () => void;
  capabilityFilter: ModelCapabilityFilter;
  onCapabilityFilterChange: (filter: ModelCapabilityFilter) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  bottomInset: number;
  embedInParentScroll?: boolean;
}) {
  const { settings } = useApp();
  const [ejectingKey, setEjectingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalModelInfo | null>(null);

  const matchesCapability = useCallback(
    (model: LocalModelInfo) => {
      const haystack = [model.key, model.name, model.provider, model.description, model.badge]
        .filter(Boolean)
        .join(" ");
      return modelMatchesCapabilityFilter(
        haystack,
        capabilityFilter,
        [],
        undefined,
        model.badge,
        haystack
      );
    },
    [capabilityFilter]
  );

  const readyModels = useMemo(
    () =>
      LOCAL_MODEL_CATALOG.filter((model) => isModelDownloaded(model.filename)).filter(
        matchesCapability
      ),
    [active, matchesCapability]
  );
  const loadedKey = active ? getLoadedOnDeviceModelKey() : null;
  const idleReadyModels = readyModels.filter((model) => model.key !== loadedKey);

  const performEject = async (model: LocalModelInfo) => {
    setEjectingKey(model.key);
    try {
      await Promise.all([
        ejectOnDeviceModel(model.key),
        new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_MIN_MS)),
      ]);
      void playModelUnloadSound();
      if (selectedKey === model.key) {
        await onSelect(null);
      }
    } finally {
      await new Promise((resolve) => setTimeout(resolve, MODEL_ROW_ACTION_FADE_OUT_MS));
      setEjectingKey(null);
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
    if (activeChatMode === "remote") {
      void performLoad(model);
      return;
    }
    if (selectedKey === model.key) {
      void performEject(model);
      return;
    }
    void performLoad(model);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const model = deleteTarget;
    setDeleteTarget(null);
    if (getLoadedOnDeviceModelKey() === model.key) {
      await ejectOnDeviceModel(model.key);
    }
    if (selectedKey === model.key) {
      await onSelect(null);
    }
    await localModelDownloadStore.removeInstalled(model);
  }, [deleteTarget, onSelect, selectedKey]);

  const blockPres = blocked ? presentError(LOCAL_NATIVE_BUILD_MESSAGE, "local") : null;

  const panelScrollPadding = embedInParentScroll ? 0 : bottomInset + 16;

  const panelBody = (
    <>
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
      <ModelModalityFilters
        selected={capabilityFilter}
        onChange={onCapabilityFilterChange}
        colors={colors}
        style={styles.localCapabilityFilters}
      />
      {!blocked && capabilityFilter === "all" && readyModels.length === 0 ? (
        <View style={styles.localEmpty}>
          <Ionicons name="download-outline" size={28} color={colors.textDim} />
          <Text style={styles.localEmptyTitle}>No models on device</Text>
          <Text style={styles.localEmptyBody}>
            Download a model in Model Library below.
          </Text>
        </View>
      ) : readyModels.length > 0 ? (
        <>
          {idleReadyModels.length > 0 ? (
            <View style={styles.localSection}>
              <Text style={styles.localSectionLabel}>Installed on device</Text>
              <SectionHintLines colors={colors} line="Swipe right to load · swipe left to delete" />
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
                      blocked ||
                      (activeChatMode !== "remote" && selectedKey === model.key)
                        ? undefined
                        : () => void performLoad(model)
                    }
                    onEject={
                      blocked || selectedKey !== model.key
                        ? undefined
                        : () => void performEject(model)
                    }
                    onDelete={blocked ? undefined : () => setDeleteTarget(model)}
                    styles={styles}
                    colors={colors}
                  />
                </AnimatedLibraryRow>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {!embedInParentScroll && onOpenLibrary ? (
        <Pressable style={[styles.manageBtn, styles.manageBtnInScroll]} onPress={onOpenLibrary}>
          <Ionicons name="library-outline" size={16} color={colors.textMuted} />
          <Text style={styles.manageBtnText}>Open Model Library</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View style={embedInParentScroll ? styles.localPanelEmbedded : styles.localPanelRoot}>
      {embedInParentScroll ? (
        <View style={styles.localScroll}>{panelBody}</View>
      ) : (
        <ScrollView
          style={styles.localPanelScroll}
          contentContainerStyle={[styles.localScroll, { paddingBottom: panelScrollPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {panelBody}
        </ScrollView>
      )}

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
    </View>
  );
}

export default function ChatModelPicker({
  visible,
  onClose,
  chatMode,
  remoteModelId,
  onRemoteSelect,
  localModelKey,
  onLocalSelect,
  onLoadedRemoteActivate,
  onLoadedLocalActivate,
  onOpenSettings,
  disableLocal,
  prefetchedRemoteModels,
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
  const [pickerSelectError, setPickerSelectError] = useState<string | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<ModelCapabilityFilter>("all");
  const [deckRefreshToken, setDeckRefreshToken] = useState(0);
  const [remoteLoadPending, setRemoteLoadPending] = useState(false);
  const [sheetExiting, setSheetExiting] = useState(false);
  const localBlocked = IS_EXPO_GO || !!disableLocal;
  const sheetRef = useRef<SwipeDismissSheetHandle>(null);
  const pendingRemoteLoadIdRef = useRef<string | null>(null);
  const closePickerAfterRemoteLoadRef = useRef(false);
  const sheetScrollOffsetY = useSharedValue(0);
  const sheetScrollGesture = useMemo(() => Gesture.Native(), []);
  const pickerActionBusy = remoteLoadPending;
  const sheetContentLive = visible || sheetExiting;
  const chooseModelDismissZone =
    modalPageTopPadding(insets.top) + 8 + CHOOSE_MODEL_HEADER_BAND;
  const onSheetScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      sheetScrollOffsetY.value = event.contentOffset.y;
    },
  });

  const handleSheetDismissed = useCallback(() => {
    setSheetExiting(false);
    onClose();
  }, [onClose]);

  const handleSheetExitStart = useCallback(() => {
    setSheetExiting(true);
  }, []);

  /** Pop + slide the sheet out, then let onDismiss close the modal. */
  const animateClose = useCallback(() => {
    if (sheetRef.current) sheetRef.current.dismiss();
    else onClose();
  }, [onClose]);

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
    if (!remoteLoadPending) return;
    const timer = setTimeout(() => {
      if (!pendingRemoteLoadIdRef.current) return;
      pendingRemoteLoadIdRef.current = null;
      closePickerAfterRemoteLoadRef.current = false;
      setRemoteLoadPending(false);
      setPickerSelectError("Model load timed out. Try again.");
    }, 60_000);
    return () => clearTimeout(timer);
  }, [remoteLoadPending]);

  useEffect(() => {
    if (visible) {
      setSheetExiting(false);
      sheetScrollOffsetY.value = 0;
      closePickerAfterRemoteLoadRef.current = false;
      Keyboard.dismiss();
      setTab(chatMode);
      setShowLibrary(false);
      setLocalSelectError(null);
      setPickerSelectError(null);
      setRemoteLoadPending(false);
      pendingRemoteLoadIdRef.current = null;
    }
  }, [visible, chatMode]);

  const refreshLoadedDeck = useCallback(async () => {
    void playModelLoadSound();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDeckRefreshToken((token) => token + 1);
  }, []);

  const openLibrary = (initialTab: ModelLibraryTab) => {
    setLibraryTab(initialTab);
    setShowLibrary(true);
  };

  const handleModeChange = (mode: ChatModelMode) => {
    if (pickerActionBusy) return;
    if (mode !== tab) {
      void Haptics.selectionAsync();
      setLocalSelectError(null);
    }
    setTab(mode);
  };

  const handleRemoteSelect = useCallback(
    async (modelId: string | null, options?: ModelSelectOptions) => {
      if (modelId === null) {
        pendingRemoteLoadIdRef.current = null;
        setRemoteLoadPending(false);
        await onRemoteSelect(null);
        animateClose();
        return;
      }

      if (isSameModelId(remoteModelId, modelId)) {
        if (options?.immediate) {
          pendingRemoteLoadIdRef.current = null;
          setRemoteLoadPending(false);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          animateClose();
          return;
        }
        pendingRemoteLoadIdRef.current = modelId;
        setRemoteLoadPending(true);
        return;
      }

      pendingRemoteLoadIdRef.current = modelId;
      closePickerAfterRemoteLoadRef.current = true;
      setRemoteLoadPending(true);
      try {
        await onRemoteSelect(modelId);
      } catch (error) {
        pendingRemoteLoadIdRef.current = null;
        closePickerAfterRemoteLoadRef.current = false;
        setRemoteLoadPending(false);
        setPickerSelectError(errorFromUnknown(error));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      if (options?.immediate) {
        pendingRemoteLoadIdRef.current = null;
        setRemoteLoadPending(false);
        animateClose();
      }
    },
    [remoteModelId, onRemoteSelect, animateClose]
  );

  const handleRemoteLoadComplete = useCallback(async () => {
    const modelId = pendingRemoteLoadIdRef.current;
    const shouldClose = closePickerAfterRemoteLoadRef.current;
    pendingRemoteLoadIdRef.current = null;
    closePickerAfterRemoteLoadRef.current = false;
    setRemoteLoadPending(false);
    if (!modelId) return;
    await refreshLoadedDeck();
    if (shouldClose) animateClose();
  }, [refreshLoadedDeck, animateClose]);

  const handleRequestClose = () => {
    if (pickerActionBusy) return;
    if (showLibrary) {
      setShowLibrary(false);
      return;
    }
    animateClose();
  };

  const handleRemoteEjected = useCallback(
    async (modelId: string) => {
      if (isSameModelId(remoteModelId, modelId)) {
        await onRemoteSelect(null);
      }
    },
    [remoteModelId, onRemoteSelect]
  );

  const handleLocalEjected = useCallback(
    async (key: string) => {
      if (localModelKey === key) {
        await onLocalSelect(null);
      }
    },
    [localModelKey, onLocalSelect]
  );

  const handleLocalSelect = async (key: string | null, options?: ModelSelectOptions) => {
    if (key === null) {
      await onLocalSelect(null);
      animateClose();
      return;
    }
    if (localBlocked) {
      setLocalSelectError(LOCAL_NATIVE_BUILD_MESSAGE);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const model = getLocalModelByKey(key);
    if (!model || !isModelDownloaded(model.filename)) {
      setLocalSelectError("Download this model from Model Library first.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (localModelKey === key && getLoadedOnDeviceModelKey() === key) {
      if (options?.immediate) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animateClose();
      }
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onLocalSelect(key);
    } catch (error) {
      setLocalSelectError(errorFromUnknown(error));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const loaded = await waitForOnDeviceModelLoaded(key);
    if (!loaded) {
      setLocalSelectError("Model failed to load on this device. Try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await refreshLoadedDeck();
    if (options?.immediate) {
      animateClose();
    }
  };

  const handleLoadedRemoteActivate = useCallback(
    async (modelId: string) => {
      try {
        if (onLoadedRemoteActivate) {
          await onLoadedRemoteActivate(modelId);
          animateClose();
          return;
        }
        await handleRemoteSelect(modelId, { immediate: true });
      } catch (error) {
        setPickerSelectError(errorFromUnknown(error));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [onLoadedRemoteActivate, handleRemoteSelect, animateClose]
  );

  const handleLoadedLocalActivate = useCallback(
    async (key: string) => {
      try {
        if (onLoadedLocalActivate) {
          await onLoadedLocalActivate(key);
          animateClose();
          return;
        }
        await handleLocalSelect(key, { immediate: true });
      } catch (error) {
        setPickerSelectError(errorFromUnknown(error));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [onLoadedLocalActivate, handleLocalSelect, animateClose]
  );

  return (
    <Modal
      visible={visible || sheetExiting}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
    >
      <GestureHandlerRootView style={modalStyles.sheetOverlayRoot}>
      <SwipeDismissSheet
        ref={sheetRef}
        direction="down"
        overlayPeel
        bottomSheet
        presented={visible}
        downStartZoneHeight={chooseModelDismissZone}
        scrollOffsetY={sheetScrollOffsetY}
        nestedScrollGesture={sheetScrollGesture}
        backdropColor={palette.overlayLight}
        onDismiss={handleSheetDismissed}
        onExitAnimateStart={handleSheetExitStart}
        style={styles.sheetRoot}
      >
      <View
        style={[
          modalStyles.pageContainer,
          styles.sheetPage,
          { paddingTop: modalPageTopPadding(insets.top) + 8 },
        ]}
      >
        <View style={modalStyles.pageHeader}>
          <DismissAffordance kind="down" colors={palette} onPress={handleRequestClose} />
          <Text style={modalStyles.pageTitle}>Choose Model</Text>
          <View style={modalStyles.pageHeaderBtn} />
        </View>

        {pickerSelectError ? (
          <ThemedError
            message={pickerSelectError}
            variant="inline"
            onDismiss={() => setPickerSelectError(null)}
          />
        ) : null}

        <GestureDetector gesture={sheetScrollGesture}>
        <AnimatedGHScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          onScroll={onSheetScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <LoadedModelDeck
            active={sheetContentLive && !showLibrary}
            remotePlatform={remotePlatform}
            remoteModelId={remoteModelId}
            refreshToken={deckRefreshToken}
            interactionsLocked={pickerActionBusy}
            onUseRemote={(modelId) => void handleLoadedRemoteActivate(modelId)}
            onUseLocal={(key) => void handleLoadedLocalActivate(key)}
            onRemoteEjected={handleRemoteEjected}
            onLocalEjected={handleLocalEjected}
            styles={styles}
            colors={palette}
          />

          <View pointerEvents={pickerActionBusy ? "none" : "auto"}>
            <Text style={styles.installedSectionLabel}>Installed models</Text>
            <View style={styles.tabsWrap}>
              <SegmentedTabs
                tabs={modeTabs}
                selected={tab}
                onChange={handleModeChange}
                colors={palette}
              />
            </View>

            {tab === "remote" ? (
              <RemoteModelList
                active={sheetContentLive && tab === "remote" && !showLibrary}
                prefetchedModels={prefetchedRemoteModels}
                selectedModelId={remoteModelId}
                onSelect={handleRemoteSelect}
                onActionComplete={() => void handleRemoteLoadComplete()}
                openLibraryOnUninstalledSelect={false}
                embedInParentScroll
                serverUrl={managementUrl ?? settings.baseUrl}
                platform={remotePlatform}
                bottomInset={0}
                suggestedLimit={8}
                hideSearch
                hideCatalog
                libraryLayout
                loadOnSelect
                greyUnselectedIcons
                hideLoadedSection
                showModalityFilters
                modalityFilter={capabilityFilter}
                onModalityFilterChange={setCapabilityFilter}
                onOpenSettings={() => {
                  animateClose();
                  onOpenSettings();
                }}
              />
            ) : (
              <LocalModelPanel
                active={sheetContentLive && tab === "local" && !showLibrary}
                activeChatMode={chatMode}
                selectedKey={localModelKey}
                onSelect={handleLocalSelect}
                embedInParentScroll
                blocked={localBlocked}
                selectError={localSelectError}
                onDismissSelectError={() => setLocalSelectError(null)}
                capabilityFilter={capabilityFilter}
                onCapabilityFilterChange={setCapabilityFilter}
                styles={styles}
                colors={palette}
                bottomInset={0}
              />
            )}
          </View>
        </AnimatedGHScrollView>
        </GestureDetector>

        {!showLibrary ? (
          <ChooseModelLibraryFooter
            colors={palette}
            styles={styles}
            bottomInset={insets.bottom}
            onPress={() => openLibrary(tab === "local" ? "device" : "system")}
          />
        ) : null}
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
    sheetRoot: {
      width: "100%",
      height: "100%",
    },
    sheetPage: {
      flex: 1,
      minHeight: 0,
    },
    sheetScroll: {
      flex: 1,
    },
    sheetScrollContent: {
      paddingBottom: 12,
    },
    libraryFooter: {
      paddingTop: 10,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    libraryFooterButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: radii.lg,
      backgroundColor: colors.primaryGlow,
      alignSelf: "stretch",
    },
    libraryFooterButtonPressed: {
      opacity: 0.86,
    },
    libraryFooterIcon: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    libraryFooterTextCol: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    libraryFooterTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    libraryFooterSubtitle: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
    },
    localPanelEmbedded: {
      width: "100%",
    },
    loadedDeck: {
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 10,
    },
    loadedDeckHeader: {
      gap: 3,
      paddingHorizontal: 4,
    },
    loadedDeckLabel: {
      ...createSectionSubtitleStyle(colors),
      marginBottom: 0,
    },
    loadedDeckHint: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.1,
    },
    loadedDeckViewport: {
      marginTop: 6,
      overflow: "hidden",
      minHeight: LOADED_DECK_ICON_SIZE + 108,
    },
    loadedDeckScrollContent: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    loadedDeckSlot: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    loadedDeckColumn: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 2,
      gap: 8,
      minWidth: 0,
      position: "relative",
      overflow: "hidden",
      borderRadius: radii.sm,
    },
    loadedDeckDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    loadedCardPressed: { opacity: 0.82 },
    loadedDeckSectionLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      textAlign: "center",
      width: "100%",
    },
    loadedDeckIconButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
    },
    loadedDeckIconButtonEmpty: {
      opacity: 0.72,
    },
    loadedDeckDetailsEmpty: {
      opacity: 0.85,
    },
    loadedDeckTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 19,
      textAlign: "center",
      flexShrink: 1,
      width: "100%",
    },
    loadedDeckTitleActive: { color: colors.primaryLight },
    loadedDeckIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 4,
      paddingRight: 2,
    },
    loadedDeckIconInner: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    loadedDeckRadialGlow: {
      position: "absolute",
    },
    loadedDeckRadialGlowLayer: {
      position: "absolute",
    },
    loadedDeckWifiBadge: {
      position: "absolute",
      right: -2,
      top: -2,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: colors.bgElevated,
    },
    loadedDeckDetails: {
      alignItems: "center",
      gap: 2,
      minWidth: 0,
      width: "100%",
      paddingHorizontal: 2,
    },
    loadedDeckStatsRow: {
      marginTop: 4,
      width: "100%",
    },
    loadedDeckHostHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      textAlign: "center",
      width: "100%",
    },
    loadedDeckMeta: {
      textAlign: "center",
      width: "100%",
      fontSize: 12,
      lineHeight: 16,
    },
    loadedDeckMetaProvider: {
      color: colors.textDim,
    },
    loadedDeckMetaSep: {
      color: colors.textDim,
    },
    loadedDeckMetaSize: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 17,
    },
    loadedCardStats: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    installedSectionLabel: {
      ...createSectionSubtitleStyle(colors),
      paddingHorizontal: 20,
      marginTop: 4,
      marginBottom: 2,
    },
    tabsWrap: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 },
    localCapabilityFilters: {
      paddingHorizontal: 0,
      paddingBottom: 4,
      marginBottom: 4,
    },
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
      width: 44,
      height: 44,
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
