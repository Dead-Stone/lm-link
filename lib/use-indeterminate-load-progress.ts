import { useEffect, useState } from "react";
import { MODEL_ROW_ACTION_MIN_MS } from "./model-row-action";

/** Ramps 0.03 → ~0.92 while a row load has no real progress signal. */
export function useIndeterminateLoadProgress(active: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }

    const started = Date.now();
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - started;
      const t = Math.min(1, elapsed / MODEL_ROW_ACTION_MIN_MS);
      setProgress(0.03 + t * 0.89);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return progress;
}
