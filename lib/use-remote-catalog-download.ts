import { useCallback, useSyncExternalStore } from "react";
import * as Haptics from "expo-haptics";
import { Settings } from "./types";
import { remoteCatalogDownloadStore } from "./remote-catalog-download-store";
import { LibraryDownloadSource } from "./remote-model-library";

export function useRemoteCatalogDownloads(
  settings: Pick<Settings, "baseUrl" | "localServerUrl" | "hfToken">
) {
  const snapshot = useSyncExternalStore(
    remoteCatalogDownloadStore.subscribe,
    remoteCatalogDownloadStore.getSnapshot,
    remoteCatalogDownloadStore.getSnapshot
  );
  const startDownload = useCallback(
    async (
      modelId: string,
      options: {
        managementUrl: string;
        apiKey?: string;
        downloadSource?: LibraryDownloadSource;
        onComplete?: () => void | Promise<unknown>;
      }
    ) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      remoteCatalogDownloadStore.clearError(modelId);
      await remoteCatalogDownloadStore.start(modelId, {
        ...options,
        settings: {
          baseUrl: settings.baseUrl,
          localServerUrl: settings.localServerUrl,
          hfToken: settings.hfToken,
        },
      });
    },
    [settings.baseUrl, settings.localServerUrl, settings.hfToken]
  );

  const dismissDownload = useCallback((modelId: string) => {
    remoteCatalogDownloadStore.dismiss(modelId);
  }, []);

  const clearError = useCallback((modelId?: string) => {
    remoteCatalogDownloadStore.clearError(modelId);
  }, []);

  const clearHfAccessPrompt = useCallback(() => {
    remoteCatalogDownloadStore.clearHfAccessPrompt();
  }, []);

  const acceptHfAccessAndRetry = useCallback(async () => {
    return remoteCatalogDownloadStore.acceptHfAccessAndRetry();
  }, []);

  const isActive = useCallback(
    (modelId: string) => remoteCatalogDownloadStore.isActive(modelId),
    [snapshot.revision]
  );

  return {
    downloads: snapshot.downloads,
    errors: snapshot.errors,
    hfAccessPrompt: snapshot.hfAccessPrompt,
    revision: snapshot.revision,
    startDownload,
    dismissDownload,
    clearError,
    clearHfAccessPrompt,
    acceptHfAccessAndRetry,
    isActive,
  };
}
