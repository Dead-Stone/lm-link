import { useEffect, useRef, useState } from "react";

type Options = {
  text: string;
  active?: boolean;
  delay?: number;
  charMs?: number;
  replayKey?: string | number;
};

/**
 * Time-based typing reveal — one rAF loop, state updates only when length changes.
 * Lighter than per-character setTimeout chains.
 */
export function useTypingReveal({
  text,
  active = true,
  delay = 80,
  charMs = 14,
  replayKey = text,
}: Options): number {
  const [visible, setVisible] = useState(0);
  const visibleRef = useRef(0);

  useEffect(() => {
    if (!active) {
      visibleRef.current = 0;
      setVisible(0);
      return;
    }

    visibleRef.current = 0;
    setVisible(0);

    let cancelled = false;
    let raf = 0;
    const startAt = performance.now() + delay;

    const tick = (now: number) => {
      if (cancelled) return;

      const elapsed = now - startAt;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const next =
        text.length === 0 ? 0 : Math.min(text.length, Math.max(0, Math.floor(elapsed / charMs)));

      if (next !== visibleRef.current) {
        visibleRef.current = next;
        setVisible(next);
      }

      if (next < text.length) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [text, replayKey, delay, charMs, active]);

  return active ? visible : 0;
}
