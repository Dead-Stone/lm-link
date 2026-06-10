import { useEffect, useRef, useState } from "react";

const MIN_CHARS_PER_FRAME = 1;
const MAX_CHARS_PER_FRAME = 16;

/**
 * Reveals streamed text progressively for a typewriter feel.
 * Catches up faster when the model outpaces the display.
 */
export function useSmoothStreamingText(target: string, active: boolean): string {
  const [displayed, setDisplayed] = useState("");
  const displayedRef = useRef("");
  const targetRef = useRef(target);
  const activeRef = useRef(active);
  const frameRef = useRef<number | null>(null);

  targetRef.current = target;
  activeRef.current = active;

  useEffect(() => {
    const stopLoop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    if (!active) {
      stopLoop();
      displayedRef.current = targetRef.current;
      setDisplayed(targetRef.current);
      return;
    }

    const tick = () => {
      if (!activeRef.current) {
        frameRef.current = null;
        return;
      }

      const tgt = targetRef.current;
      let cur = displayedRef.current;

      if (tgt.length < cur.length || (tgt.length === 0 && cur.length > 0)) {
        cur = "";
        displayedRef.current = "";
        setDisplayed("");
      }

      if (cur.length < tgt.length) {
        const behind = tgt.length - cur.length;
        const step = Math.max(
          MIN_CHARS_PER_FRAME,
          Math.min(MAX_CHARS_PER_FRAME, Math.ceil(behind / 3))
        );
        cur = tgt.slice(0, cur.length + step);
        displayedRef.current = cur;
        setDisplayed(cur);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(tick);
    }

    return stopLoop;
  }, [active]);

  return active ? displayed : target;
}
