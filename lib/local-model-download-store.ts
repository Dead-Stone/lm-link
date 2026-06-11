import {
  createDownloadResumable,
  type DownloadResumable,
} from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";
import { errorFromUnknown, isDownloadCancelledError } from "./errors";
import {
  classifyLocalHfDownloadError,
  formatHfDownloadFailureMessage,
  HfAccessPrompt,
  requestHfModelAccess,
} from "./huggingface-gated";
import { huggingFaceAuthHeaders } from "./huggingface-api";
import {
  deleteModelFile,
  IS_EXPO_GO,
  isValidModelFileOnDisk,
  LocalModelInfo,
  MIN_GGUF_MODEL_BYTES,
  resolveMinFileBytesForFilename,
  modelFile,
  modelFileSize,
  waitForValidModelFileOnDisk,
} from "./local-models";

export type LocalModelDownloadStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "paused"
  | "ready"
  | "error";

export type LocalModelDownloadState = {
  status: LocalModelDownloadStatus;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  speedMBs: number;
  etaSecs: number;
  error?: string;
};

type StoreSnapshot = {
  states: Record<string, LocalModelDownloadState>;
  hfAccessPrompt: HfAccessPrompt | null;
  revision: number;
};

type Listener = () => void;

function defaultState(): LocalModelDownloadState {
  return {
    status: "idle",
    progress: 0,
    bytesWritten: 0,
    totalBytes: 0,
    speedMBs: 0,
    etaSecs: 0,
  };
}

function formatLocalDownloadError(err: unknown): string {
  const raw = errorFromUnknown(
    err,
    "Download didn't finish. Check your connection and try again."
  );
  if (/network|fetch|timeout|offline/i.test(raw)) {
    return "Couldn't reach the download server. Check your internet connection and try again.";
  }
  if (/storage|space|disk|enospc/i.test(raw)) {
    return "Not enough free storage on this device. Free up space, then try again.";
  }
  return raw;
}

class LocalModelDownloadStore {
  private downloadStartedAt: Record<string, number> = {};
  private states: Record<string, LocalModelDownloadState> = {};
  private jobs: Record<string, DownloadResumable> = {};
  /** Keys being cancelled — suppresses late progress/errors from cancelAsync. */
  private abortingKeys = new Set<string>();
  private listeners = new Set<Listener>();
  private revision = 0;
  private blocked = false;
  private hfToken?: string;
  private hfAccessPrompt: HfAccessPrompt | null = null;
  private pendingLocalRetry: LocalModelInfo | null = null;
  private snapshot: StoreSnapshot = {
    states: this.states,
    hfAccessPrompt: this.hfAccessPrompt,
    revision: this.revision,
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  setBlocked(blocked: boolean) {
    this.blocked = blocked;
  }

  setHfToken(token?: string) {
    this.hfToken = token?.trim() || undefined;
  }

  private downloadHeaders(): Record<string, string> {
    return {
      ...huggingFaceAuthHeaders({ hfToken: this.hfToken }),
      "User-Agent": "LM-Link/1.0",
    };
  }

  private invalidDownloadMessage(model: LocalModelInfo): string {
    const size = modelFileSize(model.filename);
    const minBytes = model.minFileBytes ?? MIN_GGUF_MODEL_BYTES;
    if (size > 0 && size < minBytes) {
      if (!this.hfToken && /huggingface\.co/i.test(model.downloadUrl)) {
        return (
          "Download didn't finish — the file may be incomplete. " +
          "Check your connection and retry. If it keeps failing, add a Hugging Face token under Settings → Connection → Advanced keys."
        );
      }
      return "Download looks incomplete or corrupted. Try again on a stable connection.";
    }
    return "Download didn't finish. Check your connection and try again.";
  }

  private resolveLocalError(model: LocalModelInfo, err: unknown): string {
    const raw = errorFromUnknown(
      err,
      "Download didn't finish. Check your connection and try again."
    );
    const issue = classifyLocalHfDownloadError(raw, model.downloadUrl, this.hfToken);
    if (issue) {
      this.hfAccessPrompt = { modelId: model.key, issue };
      this.pendingLocalRetry = model;
      return issue.message;
    }
    const hfMessage = formatHfDownloadFailureMessage(raw, model.downloadUrl, this.hfToken);
    if (hfMessage) return hfMessage;
    return formatLocalDownloadError(err);
  }

  clearHfAccessPrompt() {
    if (this.hfAccessPrompt === null && this.pendingLocalRetry === null) return;
    this.hfAccessPrompt = null;
    this.pendingLocalRetry = null;
    this.emit();
  }

  async acceptHfAccessAndRetry(): Promise<{ ok: true } | { ok: false; message: string }> {
    const prompt = this.hfAccessPrompt;
    const model = this.pendingLocalRetry;
    if (!prompt || !model) {
      return { ok: false, message: "Nothing to retry." };
    }

    if (prompt.issue.kind === "acceptance_required") {
      const result = await requestHfModelAccess(prompt.issue.repoId, {
        hfToken: this.hfToken,
      });
      if (!result.ok) return result;
    }

    this.hfAccessPrompt = null;
    this.pendingLocalRetry = null;
    this.emit();
    if (IS_EXPO_GO || this.blocked) {
      return {
        ok: false,
        message: IS_EXPO_GO
          ? "On-device downloads require a native build."
          : "Downloads are disabled for this connection.",
      };
    }
    await this.start(model);
    const status = this.getState(model.key).status;
    if (status === "downloading" || status === "ready") {
      return { ok: true };
    }
    return {
      ok: false,
      message: this.getState(model.key).error ?? "Could not start download.",
    };
  }

  reset(): void {
    for (const key of Object.keys(this.jobs)) {
      const job = this.jobs[key];
      if (!job) continue;
      this.abortingKeys.add(key);
      void job.cancelAsync().catch(() => {});
      delete this.jobs[key];
      this.abortingKeys.delete(key);
    }
    this.states = {};
    this.jobs = {};
    this.abortingKeys.clear();
    this.downloadStartedAt = {};
    this.hfAccessPrompt = null;
    this.pendingLocalRetry = null;
    this.blocked = false;
    this.bumpRevision();
  }

  private dropInvalidDownload(filename: string, minBytes = MIN_GGUF_MODEL_BYTES) {
    if (!modelFile(filename).exists) return;
    if (isValidModelFileOnDisk(filename)) return;
    const size = modelFileSize(filename);
    if (size > 0 && size < minBytes) {
      deleteModelFile(filename);
    }
  }

  /** Wait for a valid GGUF on disk and mark ready — never error if the file checks out. */
  private async finalizeDownload(
    key: string,
    filename: string,
    waitOpts?: { maxMs?: number; intervalMs?: number }
  ): Promise<boolean> {
    if (await this.markReadyIfOnDisk(key, filename, waitOpts)) return true;
    if (isValidModelFileOnDisk(filename)) {
      return this.markReadyIfOnDisk(key, filename, { maxMs: 2000, intervalMs: 50 });
    }
    this.dropInvalidDownload(filename, resolveMinFileBytesForFilename(filename));
    return false;
  }

  /** Delete file and reset store so lists stop showing the model as installed. */
  async removeInstalled(model: LocalModelInfo): Promise<void> {
    const key = model.key;
    if (this.isActive(key)) {
      await this.cancel(model);
      return;
    }
    delete this.jobs[key];
    deleteModelFile(model.filename);
    this.patch(key, {
      status: "idle",
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      speedMBs: 0,
      etaSecs: 0,
      error: undefined,
    });
    this.bumpRevision();
  }

  getState(key: string): LocalModelDownloadState {
    return this.states[key] ?? defaultState();
  }

  isActive(key: string): boolean {
    const status = this.getState(key).status;
    return status === "downloading" || status === "paused";
  }

  private emit() {
    this.snapshot = {
      states: this.states,
      hfAccessPrompt: this.hfAccessPrompt,
      revision: this.revision,
    };
    for (const listener of this.listeners) listener();
  }

  private patch(key: string, patch: Partial<LocalModelDownloadState>) {
    this.states = {
      ...this.states,
      [key]: { ...(this.states[key] ?? defaultState()), ...patch },
    };
    this.emit();
  }

  private resetToIdle(key: string) {
    this.patch(key, {
      status: "idle",
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      speedMBs: 0,
      etaSecs: 0,
      error: undefined,
    });
  }

  private shouldSuppressDownloadError(key: string, err?: unknown): boolean {
    if (this.abortingKeys.has(key)) return true;
    const status = this.getState(key).status;
    if (status === "idle" || status === "ready") return true;
    if (err != null && isDownloadCancelledError(err)) return true;
    return false;
  }

  private bumpRevision() {
    this.revision += 1;
    this.emit();
  }

  /** File on disk is the source of truth — clears stale downloading/error UI. */
  private async markReadyIfOnDisk(
    key: string,
    filename: string,
    waitOpts?: { maxMs?: number; intervalMs?: number }
  ): Promise<boolean> {
    const ready = await waitForValidModelFileOnDisk(filename, waitOpts);
    if (!ready) return false;
    const cur = this.states[key] ?? defaultState();
    if (cur.status === "ready") return true;
    delete this.jobs[key];
    const size = modelFileSize(filename) || cur.totalBytes;
    this.patch(key, {
      status: "ready",
      progress: 1,
      bytesWritten: size || cur.bytesWritten,
      totalBytes: size || cur.totalBytes,
      speedMBs: 0,
      etaSecs: 0,
      error: undefined,
    });
    this.bumpRevision();
    return true;
  }

  syncInstalled(models: LocalModelInfo[]) {
    let changed = false;
    for (const model of models) {
      const cur = this.states[model.key] ?? defaultState();
      const transferActive =
        cur.status === "downloading" || cur.status === "paused" || !!this.jobs[model.key];
      if (transferActive) continue;

      const onDisk = isValidModelFileOnDisk(model.filename);

      if (onDisk) {
        if (cur.status !== "ready") {
          this.states = {
            ...this.states,
            [model.key]: {
              ...cur,
              status: "ready",
              progress: 1,
              speedMBs: 0,
              etaSecs: 0,
              error: undefined,
            },
          };
          changed = true;
        }
      } else if (cur.status === "ready") {
        this.states = {
          ...this.states,
          [model.key]: { ...cur, status: "idle", progress: 0 },
        };
        changed = true;
      }
    }
    if (changed) {
      this.bumpRevision();
    }
  }

  async start(model: LocalModelInfo): Promise<void> {
    if (IS_EXPO_GO || this.blocked) return;

    const key = model.key;
    this.abortingKeys.delete(key);
    const cur = this.getState(key);
    if (cur.status === "paused" && this.jobs[key]) {
      return this.resume(model);
    }
    if (cur.status === "downloading") return;

    const destination = new File(Paths.document, model.filename);
    if (destination.exists) {
      if (isValidModelFileOnDisk(model.filename)) {
        await this.finalizeDownload(key, model.filename);
        return;
      }
      const minBytes = resolveMinFileBytesForFilename(model.filename);
      const partialBytes = modelFileSize(model.filename);
      if (partialBytes === 0 || partialBytes < minBytes / 8) {
        destination.delete();
      }
    }

    this.downloadStartedAt[key] = Date.now();
    this.patch(key, {
      status: "downloading",
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      speedMBs: 0,
      etaSecs: 0,
      error: undefined,
    });

    const resumable = createDownloadResumable(
      model.downloadUrl,
      destination.uri,
      { headers: this.downloadHeaders() },
      (progress) => {
        if (this.abortingKeys.has(key) || !this.jobs[key]) return;
        const total = progress.totalBytesExpectedToWrite ?? 0;
        const written = progress.totalBytesWritten ?? 0;
        const ratio =
          total > 0
            ? written >= total
              ? 1
              : Math.min(written / total, 0.995)
            : 0;
        const startedAt = this.downloadStartedAt[key] ?? Date.now();
        const elapsedSecs = Math.max((Date.now() - startedAt) / 1000, 0.25);
        const speedMBs = written > 0 ? written / elapsedSecs / (1024 * 1024) : 0;
        const etaSecs =
          total > written && speedMBs > 0
            ? (total - written) / (speedMBs * 1024 * 1024)
            : 0;
        // Throttle: this callback fires per network chunk (many/sec) and each
        // emit re-renders the whole library. Skip unless the visible % changed.
        const prev = this.states[key];
        if (
          prev &&
          prev.status === "downloading" &&
          Math.round((prev.progress ?? 0) * 100) === Math.round(ratio * 100)
        ) {
          return;
        }
        this.patch(key, {
          status: "downloading",
          progress: ratio,
          bytesWritten: written,
          totalBytes: total,
          speedMBs,
          etaSecs,
        });
      }
    );
    this.jobs[key] = resumable;

    try {
      const result = await resumable.downloadAsync();
      delete this.jobs[key];
      if (this.shouldSuppressDownloadError(key)) return;
      if (this.getState(key).status === "paused") return;

      if (await this.finalizeDownload(key, model.filename)) return;

      if (result && result.status >= 400) {
        this.patch(key, {
          status: "error",
          error: this.resolveLocalError(
            model,
            `Download server returned an error (${result.status}).`
          ),
        });
      } else {
        this.patch(key, {
          status: "error",
          error: this.invalidDownloadMessage(model),
        });
      }
    } catch (e) {
      delete this.jobs[key];
      if (this.shouldSuppressDownloadError(key, e)) {
        if (this.getState(key).status !== "idle") this.resetToIdle(key);
        return;
      }
      if (this.getState(key).status === "paused") return;
      if (await this.finalizeDownload(key, model.filename)) return;
      this.dropInvalidDownload(model.filename, model.minFileBytes);
      this.patch(key, {
        status: "error",
        error: this.resolveLocalError(model, e),
      });
    }
  }

  async pause(key: string) {
    const job = this.jobs[key];
    if (!job || this.getState(key).status !== "downloading") return;
    try {
      await job.pauseAsync();
      this.patch(key, { status: "paused" });
    } catch (e) {
      this.patch(key, {
        status: "error",
        error: formatLocalDownloadError(e),
      });
    }
  }

  async resume(model: LocalModelInfo): Promise<void> {
    if (IS_EXPO_GO || this.blocked) return;
    const key = model.key;
    this.abortingKeys.delete(key);
    const job = this.jobs[key];
    if (!job || this.getState(key).status !== "paused") {
      return this.start(model);
    }

    this.patch(key, { status: "downloading", error: undefined });
    try {
      const result = await job.resumeAsync();
      delete this.jobs[key];
      if (this.shouldSuppressDownloadError(key)) return;
      if (this.getState(key).status === "paused") return;

      if (await this.finalizeDownload(key, model.filename)) return;

      if (result && result.status >= 400) {
        this.patch(key, {
          status: "error",
          error: this.resolveLocalError(
            model,
            `Download server returned an error (${result.status}).`
          ),
        });
      } else {
        this.patch(key, {
          status: "error",
          error: this.invalidDownloadMessage(model),
        });
      }
    } catch (e) {
      delete this.jobs[key];
      if (this.shouldSuppressDownloadError(key, e)) {
        if (this.getState(key).status !== "idle") this.resetToIdle(key);
        return;
      }
      if (await this.finalizeDownload(key, model.filename)) return;
      this.dropInvalidDownload(model.filename, model.minFileBytes);
      this.patch(key, {
        status: "error",
        error: this.resolveLocalError(model, e),
      });
    }
  }

  async cancel(model: LocalModelInfo) {
    const key = model.key;
    this.abortingKeys.add(key);
    const job = this.jobs[key];
    if (job) {
      try {
        await job.cancelAsync();
      } catch {
        /* ignore */
      }
      delete this.jobs[key];
    }
    deleteModelFile(model.filename);
    this.resetToIdle(key);
    this.bumpRevision();
  }

  clearError(key: string, filename?: string) {
    if (filename && isValidModelFileOnDisk(filename)) {
      void this.markReadyIfOnDisk(key, filename, { maxMs: 500, intervalMs: 50 });
      return;
    }
    this.patch(key, { status: "idle", error: undefined, progress: 0 });
  }
}

export const localModelDownloadStore = new LocalModelDownloadStore();
