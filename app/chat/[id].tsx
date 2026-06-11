import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlashListRef } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../../components/BrandLogo";
import ChatHeader from "../../components/chat/ChatHeader";
import { useHubNavigation } from "../../lib/hub-navigation";
import ChatMessagesList from "../../components/chat/ChatMessagesList";
import DotGridBackground from "../../components/DotGridBackground";
import ChatModelPicker from "../../components/ChatModelPicker";
import ModelModeBadgeIcon from "../../components/ModelModeBadgeIcon";
import { ModelCapabilityIcons } from "../../components/ModelCapabilityIcons";
import ThemedError from "../../components/ThemedError";
import { buildOnDeviceChatMessages } from "../../lib/chat-request";
import {
  buildRemoteEnsureKey,
  shouldSkipRemoteModelEnsure,
} from "../../lib/chat-model-ensure";
import {
  appendModelChangeMarker,
  inferChatMode,
} from "../../lib/chat-mode";
import {
  findRecentChatForModel,
  resolveChatRouteAfterMissingId,
} from "../../lib/chat-navigation";
import {
  defaultLocalModelKey,
  resolveNewChatModelTarget,
} from "../../lib/new-chat-init";
import {
  clearRemoteModelSelection,
  formatLoadError,
  fetchModels,
  isModelInMemory,
  isRemoteModelLoaded,
  loadRemoteModelOnSystem,
  resolveManagementApiKey,
  resolveModelControlUrl,
  resolveNewChatRemoteModel,
  streamChat,
} from "../../lib/api";
import {
  lmStudioVisionMimeType,
  normalizeImageMimeType,
  persistChatImage,
  resolveImageBase64,
} from "../../lib/image-attachments";
import { isSameModelId } from "../../lib/model-id";
import { useConversations, useSettings } from "../../lib/context";
import { useAppError } from "../../lib/error-context";
import {
  IS_EXPO_GO,
  clearOnDeviceModelSelection,
  getLocalModelByKey,
  localModelModalities,
  localModelSupportsThinking,
  localModelSupportsVideo,
  localModelSupportsVision,
  OnDeviceLLMState,
  useOnDeviceLLM,
} from "../../lib/local-models";
import { useRafStringBuffer } from "../../lib/raf-string-buffer";
import { generateId, generateTitle } from "../../lib/storage";
import { getSettingsPalette, ThemeColors, useTheme } from "../../lib/theme";
import {
  composerFieldStyles,
  createEmptyHeroStyles,
  createOdStyles,
  createMainChatStyles,
} from "../../components/chat/chatScreenStyles";
import {
  composerDockBottom,
  footerBottomPadding,
  useKeyboardInset,
} from "../../lib/use-keyboard-inset";
import {
  ChatModelMode,
  Conversation,
  isChatMessage,
  LMModel,
  Message,
  MessageImage,
  MessageStats,
} from "../../lib/types";
import {
  localVisionRequiredMessage,
  modelHasVisionCapability,
  modelSupportsThinking,
  modelSupportsVision,
  ModelModality,
  resolveModelModalities,
  selectVisionModelMessage,
  visionRequiredMessage,
} from "../../lib/vision-models";

// ─── Attachment types ─────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  type: "image" | "document";
  uri: string;
  name: string;
  size?: number;
  base64?: string;
  mimeType?: string;
}

const MAX_CHAT_ATTACHMENTS = 5;

const MODEL_PICKER_PROMPT_ERRORS = [
  "Select a model first — tap the model name below.",
  "Select an on-device model first.",
];

function attachmentLimitMessage(): string {
  return `You can attach up to ${MAX_CHAT_ATTACHMENTS} files at a time. Remove one to add more.`;
}

function imageAssetToAttachment(
  asset: ImagePicker.ImagePickerAsset,
  index = 0
): Attachment {
  return {
    id: generateId(),
    type: "image",
    uri: asset.uri,
    name: asset.fileName ?? `image_${Date.now()}_${index}.jpg`,
    size: asset.fileSize ?? undefined,
    mimeType: normalizeImageMimeType(asset.mimeType),
  };
}

function documentAssetToAttachment(asset: DocumentPicker.DocumentPickerAsset): Attachment {
  return {
    id: generateId(),
    type: "document",
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? undefined,
    mimeType: asset.mimeType ?? undefined,
  };
}

const composerBlurProps =
  Platform.OS === "android"
    ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
    : {};

function themeBgWithAlpha(bg: string, alpha: number): string {
  const hex = bg.replace("#", "");
  if (hex.length !== 6) return bg;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ComposerFieldShell({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  const frostedTint = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.38)";
  const webFallback = isDark ? "rgba(28,28,30,0.72)" : "rgba(255,255,255,0.78)";

  return (
    <View style={composerFieldStyles.shell}>
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={isDark ? 34 : 42}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFillObject}
          {...composerBlurProps}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: webFallback }]} />
      )}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: frostedTint }]}
      />
      <View style={composerFieldStyles.content}>{children}</View>
    </View>
  );
}


function AttachMenuPopover({
  isDark,
  colors,
  onPhotoLibrary,
  onCamera,
  onDocument,
  styles,
}: {
  isDark: boolean;
  colors: ThemeColors;
  onPhotoLibrary: () => void;
  onCamera: () => void;
  onDocument: () => void;
  styles: ReturnType<typeof createMainChatStyles>;
}) {
  const frostedTint = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.42)";
  const webFallback = isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.94)";

  const item = (
    icon: React.ComponentProps<typeof Ionicons>["name"],
    label: string,
    iconColor: string,
    onPress: () => void,
    showDivider: boolean
  ) => (
    <>
      {showDivider ? <View style={styles.attachMenuDivider} /> : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.attachMenuItem,
          pressed && styles.attachMenuItemPressed,
        ]}
      >
        <Ionicons name={icon} size={17} color={iconColor} />
        <Text style={styles.attachMenuItemText}>{label}</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.attachMenuPopover}>
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={isDark ? 52 : 64}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFillObject}
          {...composerBlurProps}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: webFallback }]} />
      )}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: frostedTint }]}
      />
      {item("images-outline", "Photo Library", colors.primaryLight, onPhotoLibrary, false)}
      {item("camera-outline", "Take Photo", colors.lmInner, onCamera, true)}
      {item("document-outline", "Document", colors.textMuted, onDocument, true)}
    </View>
  );
}

function formatAttachSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentFileExtension(name: string): string {
  const segment = name.split(/[/\\]/).pop() ?? name;
  const dot = segment.lastIndexOf(".");
  if (dot <= 0 || dot === segment.length - 1) return "FILE";
  return segment.slice(dot + 1).toUpperCase().slice(0, 6);
}

function fileExtensionAccent(ext: string, colors: ThemeColors): string {
  switch (ext) {
    case "PDF":
      return "#ef4444";
    case "DOC":
    case "DOCX":
      return "#3b82f6";
    case "XLS":
    case "XLSX":
    case "CSV":
      return "#22c55e";
    case "JSON":
    case "XML":
      return "#f59e0b";
    case "MD":
    case "TXT":
      return colors.textMuted;
    default:
      return colors.primaryLight;
  }
}

function ComposerAttachmentsBar({
  attachments,
  onRemove,
  colors,
  styles,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createMainChatStyles>;
}) {
  const footerBg = colors.bg;

  return (
    <View style={styles.attachmentsBar}>
      <LinearGradient
        pointerEvents="none"
        colors={[themeBgWithAlpha(footerBg, 0), footerBg]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        horizontal
        style={styles.attachmentsBarScroll}
        contentContainerStyle={styles.attachmentsBarContent}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {attachments.map((att) => (
          <View key={att.id} style={styles.stageTile}>
            {att.type === "image" ? (
              <Image source={{ uri: att.uri }} style={styles.stageTileImage} resizeMode="cover" />
            ) : (
              <View style={styles.stageFileTile}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={fileExtensionAccent(attachmentFileExtension(att.name), colors)}
                />
                <Text
                  style={[
                    styles.stageFileExt,
                    { color: fileExtensionAccent(attachmentFileExtension(att.name), colors) },
                  ]}
                  numberOfLines={1}
                >
                  {attachmentFileExtension(att.name)}
                </Text>
              </View>
            )}
            <Pressable
              style={styles.stageRemoveBtn}
              onPress={() => onRemove(att.id)}
              hitSlop={4}
              accessibilityLabel="Remove attachment"
            >
              <Ionicons name="close" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── On-device status bar ─────────────────────────────────────────────────────

type ChatMode = "remote" | "local";

function formatRemoteModelLabel(modelId?: string | null): string {
  if (!modelId) return "Select Model";
  return modelId.split("/").pop() ?? modelId;
}

function getLocalModelLabelByKey(key: string | null): string {
  if (!key) return "Select model";
  return getLocalModelByKey(key)?.name ?? key;
}

async function waitForConversationRef(
  read: () => Conversation | null,
  opts?: { attempts?: number; intervalMs?: number }
): Promise<Conversation | null> {
  const attempts = opts?.attempts ?? 40;
  const intervalMs = opts?.intervalMs ?? 50;
  for (let i = 0; i < attempts; i++) {
    const current = read();
    if (current) return current;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return read();
}

const HERO_BADGE_SIZE = 54;

type ModelHeroBadgeProps = {
  mode: ChatModelMode;
  baseUrl?: string | null;
  modelId?: string | null;
  provider?: string | null;
  label?: string | null;
  hasActiveModel: boolean;
};

function ModelHeroBadge({
  mode,
  baseUrl,
  modelId,
  provider,
  label,
  hasActiveModel,
}: ModelHeroBadgeProps) {
  const { colors, chatColors } = useTheme();
  const badgeColor = hasActiveModel ? chatColors.modelAccent : colors.textMuted;

  return (
    <ModelModeBadgeIcon
      mode={mode}
      baseUrl={baseUrl}
      modelId={modelId}
      provider={provider}
      label={label}
      size={HERO_BADGE_SIZE}
      color={badgeColor}
      monochrome={!hasActiveModel}
    />
  );
}

function EmptyModelHero({
  label,
  onPress,
  mode,
  baseUrl,
  modelId,
  provider,
  hasActiveModel,
}: {
  label: string;
  onPress?: () => void;
} & ModelHeroBadgeProps) {
  const { colors, isDark } = useTheme();
  const heroColors = useMemo(() => getSettingsPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createEmptyHeroStyles(), []);
  const sweep = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [sweep]);

  const beamX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-size.width * 0.55, size.width * 1.05],
  });

  const nameStyle = [styles.name, { color: heroColors.primaryLight }];

  return (
    <View style={styles.container}>
      <ModelHeroBadge
        mode={mode}
        baseUrl={baseUrl}
        modelId={modelId}
        provider={provider}
        label={mode === "local" ? label : undefined}
        hasActiveModel={hasActiveModel}
      />
      <Pressable
        style={({ pressed }) => [styles.nameWrap, onPress && pressed && styles.pressed]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? "Select model" : undefined}
      >
        <View
          style={styles.nameMeasure}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) setSize({ width, height });
          }}
        >
        <Text style={[styles.name, { color: heroColors.primaryLight }, styles.nameSizer]} numberOfLines={2} ellipsizeMode="tail">
          {label}
        </Text>

        {size.width > 0 ? (
          <MaskedView
            style={[styles.masked, { width: size.width, height: size.height }]}
            maskElement={
              <Text style={[styles.name, styles.nameMask]} numberOfLines={2} ellipsizeMode="tail">
                {label}
              </Text>
            }
          >
            <View style={{ width: size.width, height: size.height, overflow: "hidden" }}>
              <LinearGradient
                colors={[
                  heroColors.lmOuter,
                  heroColors.primaryLight,
                  heroColors.lmCenter,
                  heroColors.primaryLight,
                  heroColors.lmOuter,
                ]}
                locations={[0, 0.35, 0.5, 0.65, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Animated.View
                style={[
                  styles.shineSweep,
                  {
                    width: Math.max(56, size.width * 0.38),
                    transform: [{ translateX: beamX }],
                  },
                ]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.95)", "rgba(255,255,255,0)"]}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </View>
          </MaskedView>
        ) : (
          <Text style={nameStyle} numberOfLines={2} ellipsizeMode="tail">
            {label}
          </Text>
        )}
        </View>
      </Pressable>
    </View>
  );
}


function OnDeviceStatusBar({
  llm,
  modelKey,
}: {
  llm: OnDeviceLLMState;
  modelKey: string | null;
}) {
  const { colors } = useTheme();
  const odStyles = useMemo(() => createOdStyles(colors), [colors]);
  const modelInfo = getLocalModelByKey(modelKey);

  if (!llm.isAvailable) {
    return (
      <View style={odStyles.bar}>
        <Ionicons name="warning-outline" size={12} color="#f59e0b" />
        <Text style={[odStyles.text, { color: "#f59e0b" }]} numberOfLines={1}>
          Requires native build — run{" "}
          <Text style={{ fontFamily: "Courier" }}>npx expo run:android</Text>
        </Text>
      </View>
    );
  }

  if (!modelKey) {
    return (
      <View style={odStyles.bar}>
        <Ionicons name="information-circle-outline" size={12} color={colors.textDim} />
        <Text style={odStyles.text}>Select a model below</Text>
      </View>
    );
  }

  if (llm.error) {
    return (
      <View style={odStyles.bar}>
        <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
        <Text style={[odStyles.text, { color: colors.error }]} numberOfLines={1}>{llm.error}</Text>
      </View>
    );
  }

  if (llm.isLoading) {
    const pct = Math.round(llm.loadProgress * 100);
    return (
      <View style={odStyles.barCol}>
        <View style={odStyles.barRow}>
          <Ionicons name="hourglass-outline" size={12} color={colors.primary} />
          <Text style={[odStyles.text, { color: colors.primary }]}>
            Loading {modelInfo?.name ?? modelKey}… {pct}%
          </Text>
        </View>
        <View style={odStyles.progressTrack}>
          <View
            style={[
              odStyles.progressFill,
              { width: `${pct}%` as `${number}%` },
            ]}
          />
        </View>
      </View>
    );
  }

  if (llm.isReady) {
    return (
      <View style={odStyles.bar}>
        <View style={odStyles.dot} />
        <Text style={[odStyles.text, { color: colors.primaryLight }]}>
          {modelInfo?.name ?? modelKey} — on-device
        </Text>
        {llm.contextTokens > 0 && (
          <Text style={odStyles.ctx}>
            {llm.contextTokens}/{llm.contextLimit} tok
          </Text>
        )}
      </View>
    );
  }

  return null;
}


// ─── Chat screen ──────────────────────────────────────────────────────────────

/** Stable initial dock height so list padding does not jump before first layout. */
const COMPOSER_DOCK_HEIGHT_ESTIMATE = 112;

export default function ChatScreen() {
  const { id, localModel: localModelParam } = useLocalSearchParams<{ id: string; localModel?: string }>();
  const router = useRouter();
  const { openConversations, openSettings, setGestureEnabled } = useHubNavigation();
  const [screenFocused, setScreenFocused] = useState(true);
  const insets = useSafeAreaInsets();
  const { keyboardHeight, composerLift } = useKeyboardInset();
  const composerBottom = composerDockBottom(insets.bottom, keyboardHeight, composerLift);
  const inputFooterBottom = 6;
  const footerSolidStripHeight = footerBottomPadding(
    insets.bottom,
    keyboardHeight,
    inputFooterBottom
  );
  const [composerChromeHeight, setComposerChromeHeight] = useState(COMPOSER_DOCK_HEIGHT_ESTIMATE);
  const listBottomInset = composerChromeHeight + composerBottom;
  const emptyHeroBottomPad = composerChromeHeight + composerBottom;
  const { settings, updateSettings, account, isLoading } = useSettings();
  const {
    activeConversation,
    setActiveConversation,
    createConversation,
    updateConversation,
    removeConversation,
    conversations,
  } = useConversations();
  const { showError } = useAppError();
  const { colors, chatColors, isDark } = useTheme();
  const styles = useMemo(
    () => createMainChatStyles(colors, chatColors, isDark),
    [colors, chatColors, isDark]
  );

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const {
    append: appendStreamingContent,
    flush: flushStreamingContent,
    reset: resetStreamingBuffer,
  } = useRafStringBuffer(setStreamingContent);
  const clearStreamingContent = useCallback(() => {
    resetStreamingBuffer();
    setStreamingContent("");
  }, [resetStreamingBuffer]);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const openModelPicker = useCallback(() => {
    Keyboard.dismiss();
    setShowAttachMenu(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowModelPicker(true);
  }, []);

  const closeModelPicker = useCallback(() => {
    setShowModelPicker(false);
    setError((prev) => {
      if (!prev) return prev;
      if (MODEL_PICKER_PROMPT_ERRORS.includes(prev)) return null;
      return prev;
    });
  }, []);
  const attachBtnRotate = useRef(new Animated.Value(0)).current;
  const [remoteModelCatalog, setRemoteModelCatalog] = useState<LMModel[]>([]);

  // Mode
  const [chatMode, setChatMode] = useState<ChatMode>(
    localModelParam ? "local" : "remote"
  );
  const [localModelKey, setLocalModelKey] = useState<string | null>(localModelParam ?? null);
  const conversationRef = useRef(conversation);
  const loadedChatIdRef = useRef<string | undefined>(undefined);
  const systemPromptText = conversation?.systemPrompt || settings.defaultSystemPrompt;
  const systemBadgeAnim = useRef(new Animated.Value(0)).current;
  const [systemPromptPeek, setSystemPromptPeek] = useState(false);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    if (chatMode !== "remote" || !settings.baseUrl?.trim()) {
      setRemoteModelCatalog([]);
      return;
    }
    const catalogUrl = resolveModelControlUrl(settings) ?? settings.baseUrl;
    const catalogKey = resolveManagementApiKey(settings, account);
    let cancelled = false;
    fetchModels(catalogUrl, catalogKey)
      .then((models) => {
        if (!cancelled) setRemoteModelCatalog(models);
      })
      .catch(() => {
        if (!cancelled) setRemoteModelCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chatMode, settings, account, conversation?.model]);

  const remoteModelEnsureKeyRef = useRef<string | null>(null);
  const newChatInitGenerationRef = useRef(0);
  const promotingNewChatRef = useRef(false);
  const localGenerationChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (chatMode !== "remote") {
      remoteModelEnsureKeyRef.current = null;
      return;
    }
    const modelId = conversation?.model?.trim();
    if (!modelId || !settings.baseUrl?.trim()) {
      remoteModelEnsureKeyRef.current = null;
      return;
    }

    const ensureKey = buildRemoteEnsureKey(conversation?.id ?? "", modelId);

    let cancelled = false;
    (async () => {
      try {
        const controlUrl = resolveModelControlUrl(settings);
        if (!controlUrl) return;

        const mgmtKey = resolveManagementApiKey(settings, account);
        const models = await fetchModels(controlUrl, mgmtKey);
        if (cancelled) return;

        setRemoteModelCatalog(models);
        if (shouldSkipRemoteModelEnsure(models, modelId, remoteModelEnsureKeyRef.current, ensureKey)) {
          return;
        }

        const row = models.find((m) => isSameModelId(m.id, modelId));
        if (row && isModelInMemory(row)) {
          remoteModelEnsureKeyRef.current = ensureKey;
          return;
        }

        remoteModelEnsureKeyRef.current = null;
        await loadRemoteModelOnSystem(settings, modelId, {
          previousModelId: modelId,
          accountToken: account?.token,
        });
        if (cancelled) return;

        remoteModelEnsureKeyRef.current = ensureKey;
        const refreshed = await fetchModels(controlUrl, mgmtKey);
        if (!cancelled) setRemoteModelCatalog(refreshed);
      } catch (e: unknown) {
        if (!cancelled) setError(formatLoadError(e, settings));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chatMode,
    conversation?.id,
    conversation?.model,
    settings,
    account,
  ]);

  useEffect(() => {
    if (chatMode !== "remote" || !systemPromptText?.trim() || showModelPicker) {
      systemBadgeAnim.setValue(0);
      setSystemPromptPeek(false);
      return;
    }

    setSystemPromptPeek(true);
    systemBadgeAnim.setValue(0);

    let fadeOutTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    Animated.timing(systemBadgeAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (cancelled) return;
      fadeOutTimer = setTimeout(() => {
        Animated.timing(systemBadgeAnim, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished && !cancelled) setSystemPromptPeek(false);
        });
      }, 2800);
    });

    return () => {
      cancelled = true;
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
    };
  }, [chatMode, systemPromptText, conversation?.id, showModelPicker, systemBadgeAnim]);

  // Stats (remote)
  const streamStartRef = useRef<number>(0);
  const firstTokenRef = useRef<number>(0);
  const tokenCountRef = useRef<number>(0);
  const lastStatsAtRef = useRef<number>(0);
  const [liveStats, setLiveStats] = useState<{
    tokensPerSec: number;
    totalTokens: number;
    elapsedMs: number;
  } | null>(null);

  const flatListRef = useRef<FlashListRef<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  // On-device LLM
  const onDeviceLLM = useOnDeviceLLM(localModelKey, chatMode === "local");

  useEffect(() => {
    if (chatMode !== "local") {
      localGenerationChatIdRef.current = null;
      return;
    }
    if (onDeviceLLM.isGenerating) {
      localGenerationChatIdRef.current = conversationRef.current?.id ?? null;
    }
  }, [chatMode, onDeviceLLM.isGenerating]);

  useEffect(() => {
    if (chatMode !== "local") return;
    const targetId = localGenerationChatIdRef.current;
    if (!targetId || conversationRef.current?.id !== targetId) return;
    setStreamingContent(onDeviceLLM.response);
  }, [onDeviceLLM.response, chatMode]);

  const prevIsGeneratingRef = useRef(false);
  useEffect(() => {
    if (chatMode !== "local") return;
    const wasGenerating = prevIsGeneratingRef.current;
    prevIsGeneratingRef.current = onDeviceLLM.isGenerating;

    if (!wasGenerating || onDeviceLLM.isGenerating || !onDeviceLLM.response) return;

    const targetId = localGenerationChatIdRef.current;
    const current = conversationRef.current;
    if (!targetId || !current || current.id !== targetId) {
      clearStreamingContent();
      setIsStreaming(false);
      setShowTypingIndicator(false);
      localGenerationChatIdRef.current = null;
      return;
    }

    const fullText = onDeviceLLM.response;
    clearStreamingContent();
    setIsStreaming(false);
    setShowTypingIndicator(false);
    localGenerationChatIdRef.current = null;

    const stats: MessageStats = {
      tokensPerSec: onDeviceLLM.tokensPerSec,
      totalTokens: onDeviceLLM.contextTokens,
      timeToFirstTokenMs: 0,
      totalTimeMs: 0,
    };

    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: fullText,
      createdAt: Date.now(),
      stats,
    };
    const final: Conversation = {
      ...current,
      messages: [...current.messages, assistantMsg],
      updatedAt: Date.now(),
    };
    conversationRef.current = final;
    setConversation(final);
    void updateConversation(final);
  }, [onDeviceLLM.isGenerating, onDeviceLLM.response, chatMode, updateConversation, clearStreamingContent]);

  // Errors persist until the user taps the banner to dismiss (or starts a new
  // action) — auto-hiding made load/streaming failures impossible to read.

  // Cleanup: delete empty conversations when leaving the screen
  useEffect(() => {
    const convId = conversation?.id;
    return () => {
      if (!convId) return;
      setConversation((prev) => {
        if (prev && prev.id === convId && !prev.messages.some(isChatMessage)) {
          removeConversation(convId);
        }
        return prev;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Abort any in-flight remote stream when the screen unmounts (e.g. user navigates away).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Load / create conversation — only reset UI when navigating to a different chat.
  // Do not abort streaming when `conversations` updates (e.g. after saving a message).
  useEffect(() => {
    const chatIdChanged = loadedChatIdRef.current !== id;

    if (chatIdChanged) {
      const isNewChatPromotion = promotingNewChatRef.current;
      promotingNewChatRef.current = false;
      loadedChatIdRef.current = id;
      abortRef.current?.abort();
      onDeviceLLM.interrupt();
      localGenerationChatIdRef.current = null;
      if (!isNewChatPromotion) {
        setInput("");
        setAttachments([]);
        setError(null);
      }
      clearStreamingContent();
      setIsStreaming(false);
      setShowTypingIndicator(false);
      setShowAttachMenu(false);
      setLiveStats(null);
    }

    if (id === "new") {
      const initGeneration = ++newChatInitGenerationRef.current;
      let cancelled = false;

      const finishNewChat = async (
        conv: Conversation,
        opts?: { openModelPicker?: boolean }
      ) => {
        if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
        conversationRef.current = conv;
        setConversation(conv);
        setActiveConversation(conv);
        await updateConversation(conv);
        promotingNewChatRef.current = true;
        router.replace(`/chat/${conv.id}` as `/chat/${string}`);
        if (opts?.openModelPicker) {
          setShowModelPicker(true);
        }
      };

      void (async () => {
        const conv = createConversation();

        if (localModelParam) {
          const fromParam = defaultLocalModelKey(localModelParam);
          if (fromParam) {
            conv.localModelKey = fromParam;
            if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
            setChatMode("local");
            setLocalModelKey(fromParam);
            await finishNewChat(conv);
            return;
          }
          if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
          setChatMode("local");
          setLocalModelKey(null);
          await finishNewChat(conv, { openModelPicker: true });
          return;
        }

        const target = resolveNewChatModelTarget(conversations, settings);
        if (!target) {
          if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
          setChatMode("remote");
          setLocalModelKey(null);
          await finishNewChat(conv, { openModelPicker: true });
          return;
        }

        if (target.mode === "local") {
          const localKey = target.localKey ?? null;
          if (!localKey || !defaultLocalModelKey(localKey)) {
            if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
            setChatMode("local");
            setLocalModelKey(null);
            await finishNewChat(conv, { openModelPicker: true });
            return;
          }
          conv.localModelKey = localKey;
          if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
          setChatMode("local");
          setLocalModelKey(localKey);
          await finishNewChat(conv);
          return;
        }

        let catalog: LMModel[] = [];
        if (settings.baseUrl?.trim()) {
          try {
            const controlUrl = resolveModelControlUrl(settings) ?? settings.baseUrl;
            catalog = await fetchModels(controlUrl, resolveManagementApiKey(settings, account));
            if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
            setRemoteModelCatalog(catalog);
          } catch {
            catalog = [];
          }
        }

        const preferredRemoteId = target.remoteModelId ?? null;
        const { modelId, pickFrom } = resolveNewChatRemoteModel(catalog, {
          preferredId: preferredRemoteId,
        });

        const canAutoPickRemote =
          !!modelId &&
          pickFrom.length === 0 &&
          (!preferredRemoteId || isSameModelId(modelId, preferredRemoteId));

        if (canAutoPickRemote) {
          conv.model = modelId;
          if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
          setChatMode("remote");
          setLocalModelKey(null);
          await finishNewChat(conv);
          return;
        }

        if (cancelled || initGeneration !== newChatInitGenerationRef.current) return;
        setChatMode("remote");
        setLocalModelKey(null);
        await finishNewChat(conv, { openModelPicker: true });
      })();

      return () => {
        cancelled = true;
      };
    }

    const found = conversations.find((c) => c.id === id);
    if (found) {
      conversationRef.current = found;
      if (chatIdChanged || conversation?.id !== id) {
        const { mode, localKey } = inferChatMode(found);
        setChatMode(mode);
        setLocalModelKey(localKey);
        setConversation(found);
        setActiveConversation(found);
      }
      return;
    }

    if (!found && id !== "new") {
      if (isLoading) return;

      const inMemoryConv =
        (conversationRef.current?.id === id ? conversationRef.current : null) ??
        (activeConversation?.id === id ? activeConversation : null);

      if (inMemoryConv || promotingNewChatRef.current) {
        if (inMemoryConv) {
          conversationRef.current = inMemoryConv;
          if (chatIdChanged || conversation?.id !== id) {
            const { mode, localKey } = inferChatMode(inMemoryConv);
            setChatMode(mode);
            setLocalModelKey(localKey);
            setConversation(inMemoryConv);
            setActiveConversation(inMemoryConv);
          }
        }
        return;
      }

      conversationRef.current = null;
      setConversation(null);
      router.replace(resolveChatRouteAfterMissingId(conversations, activeConversation));
      return;
    }
  }, [
    id,
    localModelParam,
    createConversation,
    conversations,
    activeConversation,
    conversation?.id,
    setActiveConversation,
    updateConversation,
    router,
    settings,
    account,
    isLoading,
  ]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const prevKeyboardHeightRef = useRef(0);
  useEffect(() => {
    const opened = keyboardHeight > 0 && prevKeyboardHeightRef.current === 0;
    prevKeyboardHeightRef.current = keyboardHeight;
    if (opened && conversationRef.current?.messages.some(isChatMessage)) {
      scrollToBottom(true);
    }
  }, [keyboardHeight, scrollToBottom]);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      const redrawTimer = setTimeout(() => {
        if (conversationRef.current?.messages.some(isChatMessage)) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 0);
      return () => {
        setScreenFocused(false);
        clearTimeout(redrawTimer);
      };
    }, [])
  );

  const resolveConversationForSelection = useCallback(async (): Promise<Conversation | null> => {
    if (conversationRef.current) return conversationRef.current;

    if (id === "new") {
      const waited = await waitForConversationRef(() => conversationRef.current);
      if (waited) return waited;
    }

    const conv = createConversation();
    conversationRef.current = conv;
    setConversation(conv);
    setActiveConversation(conv);
    await updateConversation(conv);
    router.replace(`/chat/${conv.id}` as `/chat/${string}`);
    return conv;
  }, [
    id,
    createConversation,
    updateConversation,
    setActiveConversation,
    router,
  ]);

  const applyModelSelection = useCallback(
    async (
      mode: ChatMode,
      opts?: {
        remoteModelId?: string | null;
        localKey?: string | null;
        skipRemoteLoad?: boolean;
      }
    ) => {
      try {
        const currentForCheck = conversationRef.current;

        const switchingModeOnly =
          mode !== chatMode &&
          opts?.remoteModelId === undefined &&
          opts?.localKey === undefined;
        if (switchingModeOnly) {
          return;
        }

        if (mode === "remote" && opts?.remoteModelId === null) {
          setError(null);
          await clearRemoteModelSelection(settings, remoteModelCatalog, account?.token);
        } else if (
          mode === "remote" &&
          opts?.remoteModelId &&
          chatMode === "remote" &&
          isSameModelId(currentForCheck?.model, opts.remoteModelId) &&
          !opts.skipRemoteLoad
        ) {
          const loadedRow = remoteModelCatalog.find((m) =>
            isSameModelId(m.id, opts.remoteModelId)
          );
          if (loadedRow && isRemoteModelLoaded(loadedRow)) {
            return;
          }
        }

        if (mode === "local" && opts?.localKey === null) {
          await clearOnDeviceModelSelection();
        } else if (
          mode === "local" &&
          opts?.localKey !== undefined &&
          chatMode === "local" &&
          opts.localKey === localModelKey
        ) {
          return;
        }

        if (mode === "remote" && opts?.remoteModelId && !opts.skipRemoteLoad) {
          setError(null);
          try {
            await loadRemoteModelOnSystem(settings, opts.remoteModelId, {
              previousModelId: conversationRef.current?.model,
              accountToken: account?.token,
            });
          } catch (e: unknown) {
            setError(formatLoadError(e, settings));
            return;
          }
        }

        if (mode === "remote") {
          if (opts?.remoteModelId) {
            await updateSettings({ defaultModel: opts.remoteModelId });
          } else if (opts?.remoteModelId === null) {
            await updateSettings({ defaultModel: "" });
          }
        } else if (mode === "local") {
          if (opts?.localKey) {
            await updateSettings({ defaultLocalModel: opts.localKey });
          } else if (opts?.localKey === null) {
            await updateSettings({ defaultLocalModel: "" });
          }
        }

        if (opts?.localKey !== undefined) {
          setLocalModelKey(opts.localKey);
        }
        if (mode !== chatMode) setChatMode(mode);

        const clearingRemote = mode === "remote" && opts?.remoteModelId === null;
        const clearingLocal = mode === "local" && opts?.localKey === null;
        const nextRemoteModelId = clearingRemote
          ? undefined
          : opts?.remoteModelId ?? conversationRef.current?.model;

        const dropsImages =
          clearingRemote ||
          clearingLocal ||
          mode === "local" ||
          (mode === "remote" &&
            nextRemoteModelId &&
            !modelSupportsVision(nextRemoteModelId, remoteModelCatalog));
        if (dropsImages) {
          setAttachments((prev) => prev.filter((a) => a.type !== "image"));
        }

        const current = await resolveConversationForSelection();
        if (!current) return;

        const label =
          mode === "remote"
            ? clearingRemote
              ? "Select Model"
              : formatRemoteModelLabel(opts?.remoteModelId ?? current.model)
            : clearingLocal
              ? "Select model"
              : getLocalModelLabelByKey(opts?.localKey ?? localModelKey ?? null);

        let next: Conversation = {
          ...current,
          updatedAt: Date.now(),
          ...(mode === "remote"
            ? clearingRemote
              ? { model: undefined, localModelKey: undefined }
              : opts?.remoteModelId
                ? { model: opts.remoteModelId, localModelKey: undefined }
                : {}
            : clearingLocal
              ? { localModelKey: undefined, model: undefined }
              : {
                  localModelKey: opts?.localKey ?? localModelKey ?? undefined,
                  model: undefined,
                }),
        };
        if (!clearingRemote && !clearingLocal) {
          next = appendModelChangeMarker(next, label, mode, generateId);
        }
        conversationRef.current = next;
        setConversation(next);
        await updateConversation(next);
        scrollToBottom();
      } catch (e: unknown) {
        const message = formatLoadError(e, settings);
        setError(message);
        throw new Error(message);
      }
    },
    [
      chatMode,
      localModelKey,
      remoteModelCatalog,
      settings,
      account?.token,
      updateConversation,
      updateSettings,
      scrollToBottom,
      resolveConversationForSelection,
    ]
  );

  const navigateToChatForLoadedModel = useCallback(
    async (
      mode: ChatMode,
      opts: { remoteModelId?: string; localKey?: string }
    ) => {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const onCurrentChat =
          mode === "local"
            ? chatMode === "local" && !!opts.localKey && localModelKey === opts.localKey
            : chatMode === "remote" &&
              !!opts.remoteModelId &&
              isSameModelId(conversationRef.current?.model, opts.remoteModelId);

        if (onCurrentChat) {
          scrollToBottom(true);
          return;
        }

        const recent = findRecentChatForModel(conversations, mode, opts);
        if (recent) {
          conversationRef.current = recent;
          setConversation(recent);
          setActiveConversation(recent);
          const { mode: recentMode, localKey } = inferChatMode(recent);
          setChatMode(recentMode);
          setLocalModelKey(localKey);
          router.replace(`/chat/${recent.id}` as `/chat/${string}`);
          return;
        }

        const conv = createConversation();
        if (mode === "local" && opts.localKey) {
          conv.localModelKey = opts.localKey;
          setChatMode("local");
          setLocalModelKey(opts.localKey);
          await updateSettings({ defaultLocalModel: opts.localKey });
        } else if (mode === "remote" && opts.remoteModelId) {
          conv.model = opts.remoteModelId;
          setChatMode("remote");
          setLocalModelKey(null);
          await updateSettings({ defaultModel: opts.remoteModelId });
        }
        conversationRef.current = conv;
        setConversation(conv);
        await updateConversation(conv);
        setActiveConversation(conv);
        router.replace(`/chat/${conv.id}` as `/chat/${string}`);
      } catch (e: unknown) {
        const message = formatLoadError(e, settings);
        setError(message);
        throw new Error(message);
      }
    },
    [
      chatMode,
      localModelKey,
      conversations,
      scrollToBottom,
      setConversation,
      setActiveConversation,
      router,
      createConversation,
      updateConversation,
      updateSettings,
      settings,
    ]
  );

  const streamScrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!streamingContent) return;
    if (streamScrollRafRef.current !== null) return;
    streamScrollRafRef.current = requestAnimationFrame(() => {
      streamScrollRafRef.current = null;
      scrollToBottom(false);
    });
    return () => {
      if (streamScrollRafRef.current !== null) {
        cancelAnimationFrame(streamScrollRafRef.current);
        streamScrollRafRef.current = null;
      }
    };
  }, [streamingContent, scrollToBottom]);

  const animateSend = useCallback(() => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
  }, [sendScale]);

  // ─── Attachment pickers ────────────────────────────────────────────────────

  const imageAttachmentError = useCallback((): string | null => {
    if (chatMode === "local") return localVisionRequiredMessage();
    const modelId = conversationRef.current?.model?.trim();
    if (!modelId) return selectVisionModelMessage();
    if (!modelSupportsVision(modelId, remoteModelCatalog)) {
      return visionRequiredMessage(modelId);
    }
    return null;
  }, [chatMode, remoteModelCatalog]);

  const stagePickedAttachments = useCallback(
    (incoming: Attachment[]) => {
      if (incoming.length === 0) return;
      let atCap = false;
      let overflow = false;
      setAttachments((prev) => {
        const remaining = MAX_CHAT_ATTACHMENTS - prev.length;
        if (remaining <= 0) {
          atCap = true;
          return prev;
        }
        const toAdd = incoming.slice(0, remaining);
        overflow = incoming.length > remaining;
        return [...prev, ...toAdd];
      });
      if (atCap) {
        showError(attachmentLimitMessage(), { kind: "general" });
      } else if (overflow) {
        showError(
          `Only ${MAX_CHAT_ATTACHMENTS} attachments allowed. Extra files were skipped.`,
          { kind: "general" }
        );
      }
    },
    [showError]
  );

  const attachPickedImages = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      const attachError = imageAttachmentError();
      if (attachError) {
        showError(attachError, { kind: "general" });
        return;
      }
      stagePickedAttachments(assets.map((asset, index) => imageAssetToAttachment(asset, index)));
    },
    [imageAttachmentError, showError, stagePickedAttachments]
  );

  const remainingAttachmentSlots = MAX_CHAT_ATTACHMENTS - attachments.length;

  const pickFromLibrary = useCallback(async () => {
    setShowAttachMenu(false);
    const attachError = imageAttachmentError();
    if (attachError) {
      showError(attachError, { kind: "general" });
      return;
    }
    if (remainingAttachmentSlots <= 0) {
      showError(attachmentLimitMessage(), { kind: "general" });
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: remainingAttachmentSlots,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!result.canceled && result.assets.length > 0) {
        attachPickedImages(result.assets);
      }
    } catch {
      showError("Could not read that image. Try another photo.");
    }
  }, [
    attachPickedImages,
    imageAttachmentError,
    remainingAttachmentSlots,
    showError,
  ]);

  const pickFromCamera = useCallback(async () => {
    setShowAttachMenu(false);
    const attachError = imageAttachmentError();
    if (attachError) {
      showError(attachError, { kind: "general" });
      return;
    }
    if (remainingAttachmentSlots <= 0) {
      showError(attachmentLimitMessage(), { kind: "general" });
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showError("Camera access is required to take photos.", {
          title: "Permission needed",
          kind: "general",
        });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        attachPickedImages([result.assets[0]]);
      }
    } catch {
      showError("Could not read that photo. Try again.");
    }
  }, [
    attachPickedImages,
    imageAttachmentError,
    remainingAttachmentSlots,
    showError,
  ]);

  const pickDocument = useCallback(async () => {
    setShowAttachMenu(false);
    if (remainingAttachmentSlots <= 0) {
      showError(attachmentLimitMessage(), { kind: "general" });
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        stagePickedAttachments(result.assets.map(documentAssetToAttachment));
      }
    } catch {
      showError("Could not open document picker.");
    }
  }, [remainingAttachmentSlots, showError, stagePickedAttachments]);

  const removeAttachment = useCallback((attachId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachId));
  }, []);

  // ─── Generate assistant reply ─────────────────────────────────────────────

  const generateReplyForConversation = useCallback(
    async (conv: Conversation) => {
      if (chatMode === "remote" && !conv.model?.trim()) {
        setError("Select a model first — tap the model name below.");
        return;
      }

      if (chatMode === "local") {
        if (!onDeviceLLM.isAvailable) {
          setError(
            IS_EXPO_GO
              ? "On-device inference requires a native build: npx expo run:android"
              : "On-device inference unavailable."
          );
          return;
        }
        if (!onDeviceLLM.isReady) {
          if (onDeviceLLM.isLoading) {
            setError("Model is still loading. Please wait.");
          } else if (!localModelKey) {
            setError("Select an on-device model first.");
          } else {
            setError(onDeviceLLM.error ?? "Model not ready.");
          }
          return;
        }
      }

      setShowTypingIndicator(true);
      scrollToBottom();
      setIsStreaming(true);
      clearStreamingContent();
      setError(null);

      if (chatMode === "local") {
        setShowTypingIndicator(false);
        const localModel = getLocalModelByKey(localModelKey);
        const chatHistory = await buildOnDeviceChatMessages({
          messages: conv.messages,
          systemPrompt: conv.systemPrompt ?? settings.defaultSystemPrompt,
          modelKey: localModelKey,
          modelFilename: localModel?.filename,
          modelName: localModel?.name,
        });

        onDeviceLLM.generate(chatHistory).catch((err: Error) => {
          setIsStreaming(false);
          clearStreamingContent();
          setError(err.message);
        });
        return;
      }

      streamStartRef.current = Date.now();
      firstTokenRef.current = 0;
      tokenCountRef.current = 0;
      lastStatsAtRef.current = 0;
      setLiveStats(null);
      abortRef.current = new AbortController();

      const effectiveSettings = {
        ...settings,
        defaultModel: conv.model ?? "",
        defaultSystemPrompt: conv.systemPrompt ?? settings.defaultSystemPrompt,
      };

      try {
        await streamChat(
          effectiveSettings,
          conv.messages,
          abortRef.current.signal,
          {
            onToken: (token) => {
              const now = Date.now();
              if (firstTokenRef.current === 0) firstTokenRef.current = now;
              tokenCountRef.current += 1;

              setShowTypingIndicator(false);
              appendStreamingContent(token);

              // Throttle live-stats to ~5/s — the buffered text already drives the
              // visible stream; a per-token state update just adds re-renders.
              if (now - lastStatsAtRef.current >= 200) {
                lastStatsAtRef.current = now;
                const elapsed = now - streamStartRef.current;
                const tps = elapsed > 0 ? tokenCountRef.current / (elapsed / 1000) : 0;
                setLiveStats({
                  tokensPerSec: tps,
                  totalTokens: tokenCountRef.current,
                  elapsedMs: elapsed,
                });
              }
            },
            onDone: async (fullText) => {
              flushStreamingContent();
              const endTime = Date.now();
              const totalTimeMs = endTime - streamStartRef.current;
              const ttftMs =
                firstTokenRef.current > 0 ? firstTokenRef.current - streamStartRef.current : 0;

              const finalStats: MessageStats = {
                tokensPerSec:
                  tokenCountRef.current > 0 && totalTimeMs > 0
                    ? tokenCountRef.current / (totalTimeMs / 1000)
                    : 0,
                totalTokens: tokenCountRef.current,
                timeToFirstTokenMs: ttftMs,
                totalTimeMs,
              };

              setIsStreaming(false);
              clearStreamingContent();
              setShowTypingIndicator(false);
              setLiveStats(null);

              const assistantMsg: Message = {
                id: generateId(),
                role: "assistant",
                content: fullText,
                createdAt: Date.now(),
                stats: finalStats,
              };
              const finalConv: Conversation = {
                ...conv,
                messages: [...conv.messages, assistantMsg],
                updatedAt: Date.now(),
              };
              conversationRef.current = finalConv;
              setConversation(finalConv);
              await updateConversation(finalConv);
              scrollToBottom();
            },
            onError: (err) => {
              setIsStreaming(false);
              clearStreamingContent();
              setShowTypingIndicator(false);
              setLiveStats(null);
              if (err.name !== "AbortError") setError(err.message);
            },
          },
          { modelCatalog: remoteModelCatalog }
        );
      } catch (err: unknown) {
        setIsStreaming(false);
        clearStreamingContent();
        setShowTypingIndicator(false);
        setLiveStats(null);
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      }
    },
    [
      chatMode,
      localModelKey,
      onDeviceLLM,
      scrollToBottom,
      settings,
      updateConversation,
      remoteModelCatalog,
    ]
  );

  const handleCopyMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(content);
    await Haptics.selectionAsync();
  }, []);

  const handleEditUserMessage = useCallback(
    async (messageId: string) => {
      const conv = conversationRef.current;
      if (!conv || isStreaming) return;

      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const msg = conv.messages[idx];
      if (msg.role !== "user" || !isChatMessage(msg)) return;

      const truncated: Conversation = {
        ...conv,
        messages: conv.messages.slice(0, idx),
        updatedAt: Date.now(),
      };
      conversationRef.current = truncated;
      setConversation(truncated);
      await updateConversation(truncated);
      setInput(msg.content);
      setAttachments([]);
      setError(null);
    },
    [isStreaming, updateConversation]
  );

  const handleRetryUserMessage = useCallback(
    async (userId: string) => {
      const conv = conversationRef.current;
      if (!conv || isStreaming) return;

      const idx = conv.messages.findIndex((m) => m.id === userId);
      if (idx < 0) return;
      const msg = conv.messages[idx];
      if (msg.role !== "user" || !isChatMessage(msg)) return;

      const truncated: Conversation = {
        ...conv,
        messages: conv.messages.slice(0, idx + 1),
        updatedAt: Date.now(),
      };

      conversationRef.current = truncated;
      setConversation(truncated);
      await updateConversation(truncated);
      await generateReplyForConversation(truncated);
    },
    [isStreaming, updateConversation, generateReplyForConversation]
  );

  const handleRetryAssistantMessage = useCallback(
    async (assistantId: string) => {
      const conv = conversationRef.current;
      if (!conv || isStreaming) return;

      const idx = conv.messages.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;

      const truncated: Conversation = {
        ...conv,
        messages: conv.messages.slice(0, idx),
        updatedAt: Date.now(),
      };

      const lastChat = [...truncated.messages].reverse().find(isChatMessage);
      if (!lastChat || lastChat.role !== "user") return;

      conversationRef.current = truncated;
      setConversation(truncated);
      await updateConversation(truncated);
      await generateReplyForConversation(truncated);
    },
    [isStreaming, updateConversation, generateReplyForConversation]
  );

  const openNewChat = useCallback(() => {
    router.replace("/chat/new");
  }, [router]);

  useEffect(() => {
    setGestureEnabled(!showModelPicker && !showAttachMenu);
  }, [setGestureEnabled, showModelPicker, showAttachMenu]);

  useEffect(() => {
    Animated.spring(attachBtnRotate, {
      toValue: showAttachMenu ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 140,
      mass: 0.9,
      overshootClamping: true,
    }).start();
  }, [showAttachMenu, attachBtnRotate]);

  const attachIconRotate = attachBtnRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    const conv = conversationRef.current;
    if ((!trimmedInput && attachments.length === 0) || isStreaming || !conv) {
      return;
    }

    if (chatMode === "remote" && !conv.model?.trim()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError("Select a model first — tap the model name below.");
      openModelPicker();
      return;
    }

    if (chatMode === "local") {
      if (!onDeviceLLM.isAvailable) {
        setError(
          IS_EXPO_GO
            ? "On-device inference requires a native build: npx expo run:android"
            : "On-device inference unavailable."
        );
        return;
      }
      if (!onDeviceLLM.isReady) {
        if (onDeviceLLM.isLoading) {
          setError("Model is still loading. Please wait.");
        } else if (!localModelKey) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setError("Select an on-device model first.");
          openModelPicker();
        } else {
          setError(onDeviceLLM.error ?? "Model not ready.");
        }
        return;
      }
    }

    // Build message content including attachments
    let content = trimmedInput;
    let pendingImages: MessageImage[] = [];

    const imageAttachments = attachments.filter((a) => a.type === "image");
    const docAttachments = attachments.filter((a) => a.type === "document");

    if (imageAttachments.length > 0) {
      const attachError = imageAttachmentError();
      if (attachError) {
        setError(attachError);
        return;
      }

      try {
        pendingImages = await Promise.all(
          imageAttachments.map(async (a) => {
            const base64 = await resolveImageBase64(a.uri, a.base64);
            if (!base64) {
              throw new Error("missing base64");
            }
            const mimeType = lmStudioVisionMimeType(a.mimeType, base64);
            return persistChatImage(a.uri, a.name, mimeType);
          })
        );
      } catch {
        setError("Could not read image data. Remove the attachment and try again.");
        return;
      }
    }

    if (docAttachments.length > 0) {
      const descs = docAttachments
        .map((a) => `[Document: ${a.name}${a.size ? ` (${formatAttachSize(a.size)})` : ""}]`)
        .join("\n");
      content = content ? `${content}\n\n${descs}` : descs;
    }

    if (!content && pendingImages.length === 0) return;

    setInput("");
    setAttachments([]);
    setError(null);
    animateSend();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content,
      createdAt: Date.now(),
      ...(pendingImages.length > 0 ? { images: pendingImages } : {}),
    };

    const isFirst = conv.messages.filter(isChatMessage).length === 0;
    const updatedConv: Conversation = {
      ...conv,
      messages: [...conv.messages, userMsg],
      title: isFirst ? generateTitle(trimmedInput || (attachments[0]?.name ?? "Attachment")) : conv.title,
      updatedAt: Date.now(),
    };

    conversationRef.current = updatedConv;
    setConversation(updatedConv);
    await updateConversation(updatedConv);
    await generateReplyForConversation(updatedConv);
  }, [
    input,
    attachments,
    isStreaming,
    settings,
    chatMode,
    localModelKey,
    onDeviceLLM,
    animateSend,
    updateConversation,
    imageAttachmentError,
    generateReplyForConversation,
    openModelPicker,
  ]);

  const stopStreaming = useCallback(() => {
    if (chatMode === "local") {
      onDeviceLLM.interrupt();
      setIsStreaming(false);
      setShowTypingIndicator(false);
      if (streamingContent && conversation) {
        const msg: Message = {
          id: generateId(),
          role: "assistant",
          content: streamingContent + " _(stopped)_",
          createdAt: Date.now(),
        };
        const final = { ...conversation, messages: [...conversation.messages, msg], updatedAt: Date.now() };
        setConversation(final);
        clearStreamingContent();
        updateConversation(final);
      }
      return;
    }

    abortRef.current?.abort();
    setIsStreaming(false);
    setShowTypingIndicator(false);
    setLiveStats(null);
    if (streamingContent && conversation) {
      const msg: Message = {
        id: generateId(),
        role: "assistant",
        content: streamingContent + " _(stopped)_",
        createdAt: Date.now(),
      };
      const final: Conversation = {
        ...conversation,
        messages: [...conversation.messages, msg],
        updatedAt: Date.now(),
      };
      setConversation(final);
      clearStreamingContent();
      updateConversation(final);
    }
  }, [streamingContent, conversation, updateConversation, chatMode, onDeviceLLM]);

  // Header label
  const remoteModelLabel = formatRemoteModelLabel(conversation?.model);

  const localModelInfo = getLocalModelByKey(localModelKey);
  const localModelLabel = localModelInfo?.name ?? "Select model";
  const activeModelLabel = chatMode === "remote" ? remoteModelLabel : localModelLabel;
  const hasActiveModel =
    chatMode === "remote" ? !!conversation?.model?.trim() : !!localModelKey;

  const activeModelCapabilities = useMemo((): {
    thinking: boolean;
    vision: boolean;
    video: boolean;
    modalities: ModelModality[];
  } => {
    if (chatMode === "local") {
      if (!localModelInfo) {
        return { thinking: false, vision: false, video: false, modalities: ["text"] };
      }
      const modalities = localModelModalities(localModelInfo);
      return {
        thinking: localModelSupportsThinking(localModelInfo),
        vision: localModelSupportsVision(localModelInfo),
        video: localModelSupportsVideo(localModelInfo),
        modalities,
      };
    }
    const modelId = conversation?.model?.trim() ?? "";
    if (!modelId) {
      return { thinking: false, vision: false, video: false, modalities: ["text"] };
    }
    const modalities = resolveModelModalities(modelId, remoteModelCatalog);
    return {
      thinking: modelSupportsThinking(modelId, remoteModelCatalog),
      vision: modelHasVisionCapability(modelId, remoteModelCatalog),
      video: modalities.includes("video"),
      modalities,
    };
  }, [chatMode, localModelInfo, conversation?.model, remoteModelCatalog]);

  const showOnDeviceStatus =
    chatMode === "local" &&
    (!localModelKey ||
      onDeviceLLM.isLoading ||
      !!onDeviceLLM.error ||
      !onDeviceLLM.isReady);

  const hasInput = input.trim().length > 0 || attachments.length > 0;
  const messages = conversation?.messages ?? [];
  const showEmptyHero = !messages.some(isChatMessage) && !streamingContent;

  const gridMood = useMemo(() => {
    if (isStreaming) return 1;
    if (showTypingIndicator) return 0.84;
    if (hasInput) return 0.3;
    const chatMsgs = messages.filter(isChatMessage);
    if (chatMsgs.length === 0) return 0.5;
    const last = chatMsgs[chatMsgs.length - 1];
    return last.role === "user" ? 0.36 : 0.58;
  }, [isStreaming, showTypingIndicator, hasInput, messages]);

  const streamingStats = useMemo(() => {
    if (!isStreaming) return null;
    if (liveStats) return liveStats;
    if (chatMode === "local" && onDeviceLLM.isGenerating) {
      return {
        tokensPerSec: onDeviceLLM.tokensPerSec,
        totalTokens: onDeviceLLM.contextTokens,
        elapsedMs: 0,
      };
    }
    return { tokensPerSec: 0, totalTokens: 0, elapsedMs: 0 };
  }, [
    isStreaming,
    liveStats,
    chatMode,
    onDeviceLLM.isGenerating,
    onDeviceLLM.tokensPerSec,
    onDeviceLLM.contextTokens,
  ]);

  const systemBadgeRevealStyle = useMemo(
    () => ({
      height: systemBadgeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 50],
      }),
      opacity: systemBadgeAnim.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.6, 1],
      }),
    }),
    [systemBadgeAnim]
  );

  const systemBadgeStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: systemBadgeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-22, 0],
          }),
        },
      ],
    }),
    [systemBadgeAnim]
  );

  return (
    <View style={styles.container}>
      <View style={styles.dotBgLayer} pointerEvents="none">
        <DotGridBackground
          mood={gridMood}
          fadeTop={insets.top + 96}
          fadeBottom={insets.bottom + 148}
          active={screenFocused}
        />
        <View
          style={[
            styles.dotTopCap,
            { height: insets.top + 54, backgroundColor: colors.bg },
          ]}
        />
      </View>
      <ChatHeader
        title={conversation?.title || "New Chat"}
        paddingTop={insets.top}
        colors={colors}
        onOpenConversations={openConversations}
        onNewChat={openNewChat}
        onOpenSettings={openSettings}
      />

      {systemPromptPeek ? (
        <Animated.View
          style={[styles.systemBannerReveal, systemBadgeRevealStyle]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.systemBanner, systemBadgeStyle]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={colors.textDim}
              style={styles.systemBannerIcon}
            />
            <View style={styles.systemBannerBody}>
              <Text style={styles.systemBannerLabel}>System prompt</Text>
              <Text style={styles.systemBannerText} numberOfLines={1} ellipsizeMode="tail">
                {systemPromptText}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {showOnDeviceStatus && (
        <OnDeviceStatusBar llm={onDeviceLLM} modelKey={localModelKey} />
      )}

      <View style={styles.chatBody}>
        {showAttachMenu ? (
          <Pressable
            style={styles.attachMenuScrim}
            onPress={() => setShowAttachMenu(false)}
            accessibilityLabel="Dismiss attachment menu"
          />
        ) : null}

        {/* Messages / empty state */}
        {showEmptyHero ? (
          <View style={{ flex: 1, paddingBottom: emptyHeroBottomPad }}>
            <EmptyModelHero
              label={activeModelLabel}
              onPress={openModelPicker}
              mode={chatMode}
              baseUrl={settings.baseUrl}
              modelId={chatMode === "remote" ? conversation?.model : undefined}
              provider={chatMode === "local" ? localModelInfo?.provider : undefined}
              hasActiveModel={hasActiveModel}
            />
          </View>
        ) : (
          <ChatMessagesList
            listRef={flatListRef}
            messages={messages}
            streamingContent={streamingContent}
            showTypingIndicator={showTypingIndicator}
            streamingStats={streamingStats}
            bottomInset={listBottomInset}
            onRetryUser={handleRetryUserMessage}
            onRetryAssistant={handleRetryAssistantMessage}
            onCopy={handleCopyMessage}
            onEdit={handleEditUserMessage}
          />
        )}

        <View
          pointerEvents="none"
          style={[styles.composerBottomFill, { height: composerBottom }]}
        />

        <View
          style={[
            styles.composerDock,
            { bottom: composerBottom },
            showAttachMenu && styles.composerDockFront,
          ]}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            if (next > 0) setComposerChromeHeight(next);
          }}
        >
        {/* Error banner */}
        <ThemedError
          variant="banner"
          message={error}
          onDismiss={() => setError(null)}
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputFooter,
            attachments.length > 0 && styles.inputFooterWithAttachments,
          ]}
        >
          {attachments.length > 0 ? (
            <ComposerAttachmentsBar
              attachments={attachments}
              onRemove={removeAttachment}
              colors={colors}
              styles={styles}
            />
          ) : null}
          <View style={styles.inputBarSurface}>
          <View style={[styles.inputBar, attachments.length > 0 && styles.inputBarWithAttachments]}>
            <View style={styles.inputRow}>
              <View style={styles.attachAnchor}>
                <Pressable
                  onPress={() => setShowAttachMenu((open) => !open)}
                  style={({ pressed }) => [
                    styles.attachBtn,
                    attachments.length > 0 && styles.attachBtnStaged,
                    pressed && styles.attachBtnPressed,
                  ]}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showAttachMenu, expanded: showAttachMenu }}
                  accessibilityLabel="Add attachment"
                >
                  <Animated.View style={{ transform: [{ rotate: attachIconRotate }] }}>
                    <Ionicons
                      name="add"
                      size={22}
                      color={
                        attachments.length > 0 ? chatColors.modelAccent : chatColors.inputIcon
                      }
                    />
                  </Animated.View>
                </Pressable>
                {showAttachMenu ? (
                  <AttachMenuPopover
                    isDark={isDark}
                    colors={colors}
                    styles={styles}
                    onPhotoLibrary={pickFromLibrary}
                    onCamera={pickFromCamera}
                    onDocument={pickDocument}
                  />
                ) : null}
              </View>

              <ComposerFieldShell isDark={isDark}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  style={styles.textInput}
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
              </ComposerFieldShell>

              <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                {isStreaming ? (
                  <Pressable onPress={stopStreaming} style={styles.stopBtn}>
                    <View style={styles.stopIcon} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={sendMessage}
                    disabled={!hasInput}
                    style={[styles.sendBtn, hasInput && styles.sendBtnActive]}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={20}
                      color={hasInput ? chatColors.sendIconActive : chatColors.sendIcon}
                    />
                  </Pressable>
                )}
              </Animated.View>
            </View>

            <View style={styles.inputMetaRow}>
              <Pressable
                onPress={openModelPicker}
                style={({ pressed }) => [
                  styles.footerModelPicker,
                  pressed && styles.footerModelPickerPressed,
                ]}
                hitSlop={6}
              >
                <ModelModeBadgeIcon
                  mode={chatMode}
                  baseUrl={settings.baseUrl}
                  modelId={chatMode === "remote" ? conversation?.model : undefined}
                  provider={chatMode === "local" ? localModelInfo?.provider : undefined}
                  label={chatMode === "local" ? localModelLabel : undefined}
                  size={16}
                  color={chatColors.modelAccent}
                  monochrome={
                    (chatMode === "local" && !localModelKey) ||
                    (chatMode === "remote" && !hasActiveModel)
                  }
                />
                <Text style={styles.footerModelName} numberOfLines={1} ellipsizeMode="tail">
                  {activeModelLabel}
                </Text>
                <View style={styles.footerModelTrailing}>
                  <Ionicons
                    name="chevron-down"
                    size={15}
                    color={chatColors.modelAccent}
                    style={styles.footerModelChevron}
                  />
                  <ModelCapabilityIcons
                    thinking={activeModelCapabilities.thinking}
                    vision={activeModelCapabilities.vision}
                    video={activeModelCapabilities.video}
                    colors={colors}
                    highlighted={hasActiveModel}
                    size={13}
                  />
                </View>
              </Pressable>
              <View style={styles.poweredByRow}>
                <Text style={styles.poweredByText}>Powered by</Text>
                <BrandLogo size={11} flat showLink={false} />
                <Text style={styles.poweredByBrand}>LM Studio</Text>
              </View>
            </View>
            <View style={[styles.footerSolidStrip, { height: footerSolidStripHeight }]} />
          </View>
          </View>
        </View>
        </View>
      </View>
      <ChatModelPicker
        visible={showModelPicker}
        onClose={closeModelPicker}
        chatMode={chatMode}
        prefetchedRemoteModels={remoteModelCatalog}
        remoteModelId={conversation?.model}
        onRemoteSelect={async (modelId) => {
          await applyModelSelection("remote", {
            remoteModelId: modelId,
            skipRemoteLoad: true,
          });
        }}
        localModelKey={localModelKey}
        onLocalSelect={async (key) => {
          await applyModelSelection("local", { localKey: key });
        }}
        onLoadedRemoteActivate={async (modelId) => {
          await navigateToChatForLoadedModel("remote", { remoteModelId: modelId });
        }}
        onLoadedLocalActivate={async (key) => {
          await navigateToChatForLoadedModel("local", { localKey: key });
        }}
        onOpenSettings={openSettings}
        disableLocal={IS_EXPO_GO}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

