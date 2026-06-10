import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

/** Batch rapid string appends to animation-frame updates (drains while tokens keep arriving). */
export function useRafStringBuffer(setValue: Dispatch<SetStateAction<string>>) {
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (!bufferRef.current) return;
    const chunk = bufferRef.current;
    bufferRef.current = "";
    setValue((prev) => prev + chunk);
  }, [setValue]);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current !== null) return;

    const loop = () => {
      const chunk = bufferRef.current;
      bufferRef.current = "";
      if (chunk) {
        setValue((prev) => prev + chunk);
      }
      if (bufferRef.current) {
        frameRef.current = requestAnimationFrame(loop);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(loop);
  }, [setValue]);

  const append = useCallback(
    (token: string) => {
      if (!token) return;
      bufferRef.current += token;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const reset = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  return { append, flush, reset };
}
