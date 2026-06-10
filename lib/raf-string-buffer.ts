import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

/** Batch rapid string appends to one update per animation frame. */
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

  const append = useCallback(
    (token: string) => {
      bufferRef.current += token;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const chunk = bufferRef.current;
        bufferRef.current = "";
        setValue((prev) => prev + chunk);
      });
    },
    [setValue]
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
