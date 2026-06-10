import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import ThemedError from "../components/ThemedError";
import { ErrorKind } from "./errors";

interface ShowErrorOptions {
  kind?: ErrorKind;
  title?: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

interface ErrorContextValue {
  showError: (message: string, options?: ShowErrorOptions) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<ShowErrorOptions>({});

  const showError = useCallback((msg: string, opts: ShowErrorOptions = {}) => {
    setMessage(msg);
    setOptions(opts);
  }, []);

  const clearError = useCallback(() => {
    setMessage(null);
    setOptions({});
  }, []);

  const value = useMemo(() => ({ showError, clearError }), [showError, clearError]);

  return (
    <ErrorContext.Provider value={value}>
      {children}
      <ThemedError
        variant="modal"
        visible={!!message}
        message={message}
        kind={options.kind}
        title={options.title}
        hint={options.hint}
        onDismiss={clearError}
        onRetry={
          options.onRetry
            ? () => {
                clearError();
                options.onRetry?.();
              }
            : undefined
        }
        retryLabel={options.retryLabel}
      />
    </ErrorContext.Provider>
  );
}

export function useAppError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error("useAppError must be used within ErrorProvider");
  return ctx;
}
