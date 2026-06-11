import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { LocalModelInfo } from "./local-models";
import {
  localModelDownloadStore,
  LocalModelDownloadState,
} from "./local-model-download-store";

export type {
  LocalModelDownloadState,
  LocalModelDownloadStatus,
} from "./local-model-download-store";

export function useLocalModelDownloads(
  models: LocalModelInfo[],
  {
    blocked = false,
    active = true,
    hfToken,
  }: { blocked?: boolean; active?: boolean; hfToken?: string } = {}
) {
  const snapshot = useSyncExternalStore(
    localModelDownloadStore.subscribe,
    localModelDownloadStore.getSnapshot,
    localModelDownloadStore.getSnapshot
  );

  useEffect(() => {
    localModelDownloadStore.setBlocked(blocked);
  }, [blocked]);

  useEffect(() => {
    localModelDownloadStore.setHfToken(hfToken);
  }, [hfToken]);

  useEffect(() => {
    if (!active) return;
    localModelDownloadStore.syncInstalled(models);
  }, [active, models, snapshot.revision]);

  useEffect(() => {
    if (!active) return;
    const sync = () => localModelDownloadStore.syncInstalled(models);
    const onAppState = (next: AppStateStatus) => {
      if (next === "active") sync();
    };
    const subscription = AppState.addEventListener("change", onAppState);
    return () => subscription.remove();
  }, [active, models]);

  useEffect(() => {
    if (!active) return;
    const hasTransfer = models.some((model) => localModelDownloadStore.isActive(model.key));
    if (!hasTransfer) return;
    const interval = setInterval(() => {
      localModelDownloadStore.syncInstalled(models);
    }, 400);
    return () => clearInterval(interval);
  }, [active, models, snapshot.revision]);

  const getState = useCallback(
    (key: string): LocalModelDownloadState => snapshot.states[key] ?? localModelDownloadStore.getState(key),
    [snapshot.states]
  );

  const handleDownload = useCallback((model: LocalModelInfo) => {
    void localModelDownloadStore.start(model);
  }, []);

  const handlePause = useCallback((key: string) => {
    void localModelDownloadStore.pause(key);
  }, []);

  const handleResume = useCallback((model: LocalModelInfo) => {
    void localModelDownloadStore.resume(model);
  }, []);

  const handleCancel = useCallback((model: LocalModelInfo) => {
    void localModelDownloadStore.cancel(model);
  }, []);

  const clearError = useCallback((key: string, filename?: string) => {
    localModelDownloadStore.clearError(key, filename);
  }, []);

  const isActive = useCallback(
    (key: string) => localModelDownloadStore.isActive(key),
    [snapshot.revision]
  );

  const clearHfAccessPrompt = useCallback(() => {
    localModelDownloadStore.clearHfAccessPrompt();
  }, []);

  const acceptHfAccessAndRetry = useCallback(async () => {
    return localModelDownloadStore.acceptHfAccessAndRetry();
  }, []);

  return {
    getState,
    handleDownload,
    handlePause,
    handleResume,
    handleCancel,
    clearError,
    clearHfAccessPrompt,
    acceptHfAccessAndRetry,
    hfAccessPrompt: snapshot.hfAccessPrompt,
    isActive,
    revision: snapshot.revision,
  };
}
