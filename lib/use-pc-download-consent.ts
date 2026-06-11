import { useCallback, useSyncExternalStore } from "react";
import {
  getPcDownloadFromPhoneEnabledSync,
  hydratePcDownloadFromPhoneEnabled,
  setPcDownloadFromPhoneEnabled,
  subscribePcDownloadFromPhoneEnabled,
} from "./pc-download-consent";

export function usePcDownloadFromPhoneConsent() {
  const enabled = useSyncExternalStore(
    subscribePcDownloadFromPhoneEnabled,
    getPcDownloadFromPhoneEnabledSync,
    () => false
  );

  const enable = useCallback(async () => {
    await setPcDownloadFromPhoneEnabled(true);
  }, []);

  const disable = useCallback(async () => {
    await setPcDownloadFromPhoneEnabled(false);
  }, []);

  return { enabled, enable, disable, hydrate: hydratePcDownloadFromPhoneEnabled };
}
