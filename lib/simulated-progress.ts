/** Browser-style indeterminate progress while waiting on a long-running task. */
export function runSimulatedProgress(onProgress: (progress: number) => void): () => void {
  const start = Date.now();
  onProgress(0.04);

  const interval = setInterval(() => {
    const elapsed = Date.now() - start;
    // Ease toward ~90% — slows as it approaches, never reaches 1 until stopped.
    const next = Math.min(0.9, 1 - Math.exp(-elapsed / 7000));
    onProgress(Math.max(0.04, next));
  }, 80);

  return () => {
    clearInterval(interval);
    onProgress(1);
  };
}
