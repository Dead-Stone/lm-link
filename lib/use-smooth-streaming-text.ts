import { useEffect, useRef, useState } from "react";

const MIN_CHARS_PER_FRAME = 1;
const MAX_CHARS_PER_FRAME = 10;
const TARGET_FRAME_MS = 1000 / 60;

/**
 * Reveals streamed text progressively for a typewriter feel.
 * rAF-driven with time-based pacing — smooth catch-up without jank.
 */
export function useSmoothStreamingText(target: string, active: boolean): string {
  const [displayed, setDisplayed] = useState("");
  const displayedRef = useRef("");
  const targetRef = useRef(target);
  const activeRef = useRef(active);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const carryRef = useRef(0);

  targetRef.current = target;
  activeRef.current = active;

  useEffect(() => {
    const stopLoop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = 0;
      carryRef.current = 0;
    };

    if (!active) {
      stopLoop();
      displayedRef.current = targetRef.current;
      setDisplayed(targetRef.current);
      return;
    }

    const tick = (now: number) => {
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
        carryRef.current = 0;
        lastFrameRef.current = now;
      }

      if (cur.length < tgt.length) {
        const dt =
          lastFrameRef.current > 0
            ? Math.min(48, Math.max(8, now - lastFrameRef.current))
            : TARGET_FRAME_MS;
        lastFrameRef.current = now;

        const behind = tgt.length - cur.length;
        const rate = behind > 48 ? 22 : behind > 16 ? 16 : 11;
        carryRef.current += (rate * dt) / 1000;
        const step = Math.max(
          MIN_CHARS_PER_FRAME,
          Math.min(MAX_CHARS_PER_FRAME, Math.floor(carryRef.current))
        );
        if (step > 0) {
          carryRef.current -= step;
          cur = tgt.slice(0, cur.length + step);
          displayedRef.current = cur;
          setDisplayed(cur);
        }
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
