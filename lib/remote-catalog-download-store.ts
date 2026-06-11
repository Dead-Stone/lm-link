import {
  downloadLmStudioModel,
  getLmStudioDownloadStatus,
  isDownloadSuccessStatus,
  parseDownloadError,
} from "./api";
import {
  HfAccessPrompt,
  requestHfModelAccess,
} from "./huggingface-gated";
import { Settings } from "./types";
import {
  findCuratedRemoteLibraryEntry,
  LibraryDownloadSource,
  resolveRemoteEntryDownloadModel,
  resolveRemoteEntryDownloadSource,
} from "./remote-model-library";
import { getPcDownloadFromPhoneEnabledSync } from "./pc-download-consent";

export type RemoteCatalogDownloadEntry = {
  jobId: string;
  progress: number | null;
};

type StoreSnapshot = {
  downloads: Record<string, RemoteCatalogDownloadEntry>;
  errors: Record<string, string>;
  hfAccessPrompt: HfAccessPrompt | null;
  revision: number;
};

type Listener = () => void;

type StartOptions = {
  managementUrl: string;
  apiKey?: string;
  settings: Pick<Settings, "baseUrl" | "localServerUrl" | "hfToken">;
  downloadSource?: LibraryDownloadSource;
  onComplete?: () => void | Promise<unknown>;
};

type DownloadContext = {
  options: StartOptions;
  effectiveSource: LibraryDownloadSource;
  apiModel: string;
};

class RemoteCatalogDownloadStore {
  private downloads: Record<string, RemoteCatalogDownloadEntry> = {};
  private errors: Record<string, string> = {};
  private hfAccessPrompt: HfAccessPrompt | null = null;
  private pendingRetry: { modelId: string; options: StartOptions } | null = null;
  private contexts = new Map<string, DownloadContext>();
  private revision = 0;
  private pollIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private completeHandlers = new Map<string, () => void | Promise<unknown>>();
  private listeners = new Set<Listener>();
  private snapshot: StoreSnapshot = {
    downloads: this.downloads,
    errors: this.errors,
    hfAccessPrompt: this.hfAccessPrompt,
    revision: this.revision,
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  isActive(modelId: string): boolean {
    return !!this.downloads[modelId];
  }

  private emit() {
    this.snapshot = {
      downloads: this.downloads,
      errors: this.errors,
      hfAccessPrompt: this.hfAccessPrompt,
      revision: this.revision,
    };
    for (const listener of this.listeners) listener();
  }

  private bumpRevision() {
    this.revision += 1;
    this.emit();
  }

  private isTracking(modelId: string): boolean {
    return !!this.downloads[modelId] || this.contexts.has(modelId);
  }

  private stopPolling(modelId: string) {
    const interval = this.pollIntervals.get(modelId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(modelId);
    }
  }

  private errorContext(modelId: string): DownloadErrorContextForParse | undefined {
    const ctx = this.contexts.get(modelId);
    if (!ctx) return undefined;
    return {
      modelId,
      downloadSource: ctx.effectiveSource,
      resolvedModel: ctx.apiModel,
      hfToken: ctx.options.settings.hfToken,
    };
  }

  private applyDownloadError(modelId: string, error: unknown) {
    const ctx = this.contexts.get(modelId);
    const settings = ctx?.options.settings ?? {
      baseUrl: "",
      localServerUrl: "",
      hfToken: undefined,
    };
    const parsed = parseDownloadError(error, settings, this.errorContext(modelId));
    this.errors = { ...this.errors, [modelId]: parsed.message };
    if (parsed.hfIssue && ctx) {
      this.hfAccessPrompt = {
        modelId,
        downloadSource: ctx.effectiveSource,
        issue: parsed.hfIssue,
      };
      this.pendingRetry = { modelId, options: ctx.options };
    } else {
      this.hfAccessPrompt = null;
      this.pendingRetry = null;
    }
  }

  clearError(modelId?: string) {
    let changed = false;
    if (modelId) {
      if (!(modelId in this.errors)) return;
      const next = { ...this.errors };
      delete next[modelId];
      this.errors = next;
      changed = true;
    } else if (Object.keys(this.errors).length > 0) {
      this.errors = {};
      changed = true;
    }
    if (this.hfAccessPrompt !== null && (!modelId || this.hfAccessPrompt.modelId === modelId)) {
      this.hfAccessPrompt = null;
      changed = true;
    }
    if (
      this.pendingRetry !== null &&
      (!modelId || this.pendingRetry.modelId === modelId)
    ) {
      this.pendingRetry = null;
      changed = true;
    }
    if (changed) this.emit();
  }

  clearHfAccessPrompt() {
    if (this.hfAccessPrompt === null && this.pendingRetry === null) return;
    this.hfAccessPrompt = null;
    this.pendingRetry = null;
    this.emit();
  }

  async acceptHfAccessAndRetry(): Promise<{ ok: true } | { ok: false; message: string }> {
    const prompt = this.hfAccessPrompt;
    const pending = this.pendingRetry;
    if (!prompt || !pending) {
      return { ok: false, message: "Nothing to retry." };
    }

    if (prompt.issue.kind === "acceptance_required") {
      const result = await requestHfModelAccess(prompt.issue.repoId, {
        hfToken: pending.options.settings.hfToken,
      });
      if (!result.ok) return result;
    }

    this.hfAccessPrompt = null;
    this.pendingRetry = null;
    const nextErrors = { ...this.errors };
    delete nextErrors[pending.modelId];
    this.errors = nextErrors;
    this.emit();

    await this.start(pending.modelId, pending.options);
    return { ok: true };
  }

  private async finish(modelId: string) {
    this.stopPolling(modelId);
    this.contexts.delete(modelId);
    const onComplete = this.completeHandlers.get(modelId);
    this.completeHandlers.delete(modelId);
    const next = { ...this.downloads };
    delete next[modelId];
    this.downloads = next;
    this.bumpRevision();
    if (onComplete) await onComplete();
  }

  private poll(
    modelId: string,
    jobId: string,
    managementUrl: string,
    apiKey?: string
  ) {
    this.stopPolling(modelId);

    const interval = setInterval(async () => {
      if (!this.isTracking(modelId)) {
        this.stopPolling(modelId);
        return;
      }

      try {
        const status = await getLmStudioDownloadStatus(managementUrl, jobId, apiKey);
        if (!this.isTracking(modelId)) return;

        const total = status.total_size_bytes ?? 0;
        const done = status.downloaded_bytes ?? 0;
        const progress = total > 0 ? done / total : null;

        const prev = this.downloads[modelId];
        if (prev?.progress === progress && prev?.jobId === jobId) return;
        this.downloads = {
          ...this.downloads,
          [modelId]: { jobId, progress },
        };
        this.emit();

        if (isDownloadSuccessStatus(status.status)) {
          await this.finish(modelId);
        } else if (status.status === "failed" || status.status === "error") {
          this.stopPolling(modelId);
          this.completeHandlers.delete(modelId);
          const next = { ...this.downloads };
          delete next[modelId];
          this.downloads = next;
          if (this.contexts.has(modelId)) {
            this.applyDownloadError(
              modelId,
              new Error(status.error ?? `Download failed for ${modelId}`)
            );
            this.contexts.delete(modelId);
          }
          this.bumpRevision();
        }
      } catch (e: unknown) {
        if (!this.isTracking(modelId)) return;
        this.stopPolling(modelId);
        this.completeHandlers.delete(modelId);
        const next = { ...this.downloads };
        delete next[modelId];
        this.downloads = next;
        if (this.contexts.has(modelId)) {
          this.applyDownloadError(modelId, e);
          this.contexts.delete(modelId);
        }
        this.bumpRevision();
      }
    }, 1500);
    this.pollIntervals.set(modelId, interval);
  }

  async start(modelId: string, options: StartOptions) {
    if (!getPcDownloadFromPhoneEnabledSync()) {
      throw new Error(
        "Mac/PC downloads from your phone are turned off. Open Settings → Models to review the terms and enable them."
      );
    }

    const { managementUrl, apiKey, settings, downloadSource, onComplete } = options;
    if (this.downloads[modelId]) return;

    this.hfAccessPrompt = null;
    this.pendingRetry = null;
    const nextErrors = { ...this.errors };
    delete nextErrors[modelId];
    this.errors = nextErrors;
    this.downloads = {
      ...this.downloads,
      [modelId]: { jobId: "", progress: 0 },
    };
    if (onComplete) this.completeHandlers.set(modelId, onComplete);
    this.emit();

    try {
      const curated = findCuratedRemoteLibraryEntry(modelId);
      const entry = curated ?? { id: modelId, downloadSource };
      const effectiveSource = resolveRemoteEntryDownloadSource(entry);
      const apiModel = resolveRemoteEntryDownloadModel({
        ...entry,
        downloadSource: effectiveSource,
      });
      this.contexts.set(modelId, { options, effectiveSource, apiModel });
      const job = await downloadLmStudioModel(managementUrl, apiModel, apiKey, {
        downloadSource: effectiveSource,
        hfToken: settings.hfToken,
      });
      if (!this.isTracking(modelId)) return;
      if (isDownloadSuccessStatus(job.status)) {
        await this.finish(modelId);
        return;
      }
      if (!job.job_id) {
        throw new Error("Download started but no job ID was returned from LM Studio");
      }
      if (!this.isTracking(modelId)) return;
      this.downloads = {
        ...this.downloads,
        [modelId]: { jobId: job.job_id, progress: 0 },
      };
      this.emit();
      this.poll(modelId, job.job_id, managementUrl, apiKey);
    } catch (e: unknown) {
      if (!this.isTracking(modelId)) return;
      const next = { ...this.downloads };
      delete next[modelId];
      this.downloads = next;
      this.completeHandlers.delete(modelId);
      this.applyDownloadError(modelId, e);
      this.contexts.delete(modelId);
      this.bumpRevision();
    }
  }

  /** Stop tracking on this device — download may continue on the Mac. */
  dismiss(modelId: string) {
    if (!this.downloads[modelId] && !this.pollIntervals.has(modelId)) return;
    this.stopPolling(modelId);
    this.completeHandlers.delete(modelId);
    this.contexts.delete(modelId);
    const next = { ...this.downloads };
    delete next[modelId];
    this.downloads = next;

    if (modelId in this.errors) {
      const nextErrors = { ...this.errors };
      delete nextErrors[modelId];
      this.errors = nextErrors;
    }
    if (this.hfAccessPrompt?.modelId === modelId) {
      this.hfAccessPrompt = null;
      this.pendingRetry = null;
    } else if (this.pendingRetry?.modelId === modelId) {
      this.pendingRetry = null;
    }

    this.emit();
  }

  reset(): void {
    for (const interval of this.pollIntervals.values()) {
      clearInterval(interval);
    }
    this.pollIntervals.clear();
    this.contexts.clear();
    this.completeHandlers.clear();
    this.downloads = {};
    this.errors = {};
    this.hfAccessPrompt = null;
    this.pendingRetry = null;
    this.bumpRevision();
  }
}

type DownloadErrorContextForParse = {
  modelId: string;
  downloadSource: LibraryDownloadSource;
  resolvedModel: string;
  hfToken?: string;
};

export const remoteCatalogDownloadStore = new RemoteCatalogDownloadStore();
