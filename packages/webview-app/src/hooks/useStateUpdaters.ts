// packages/webview-app/src/hooks/useStateUpdaters.ts
// Factory hooks for creating memoized state field setters w/ debug logging

import { useCallback, Dispatch, SetStateAction } from 'react';
import { debug } from '../utils/debug';

// create memoized setter for a single field in state
export function useFieldSetter<S extends object, K extends keyof S>(
  setState: Dispatch<SetStateAction<S>>,
  field: K,
  logTag: string
): (value: S[K]) => void {
  return useCallback(
    (value: S[K]) => {
      debug(`[${logTag}] set${capitalize(String(field))} called`, value);
      setState((prev) => ({ ...prev, [field]: value }));
    },
    // setState is stable, field & logTag are constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

// create memoized setter that sets a field to a constant value
export function useFieldResetter<S extends object, K extends keyof S>(
  setState: Dispatch<SetStateAction<S>>,
  field: K,
  value: S[K],
  logTag: string,
  actionName: string
): () => void {
  return useCallback(() => {
    debug(`[${logTag}] ${actionName} called`);
    setState((prev) => ({ ...prev, [field]: value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// create memoized setter w/ custom debug message formatting
export function useFieldSetterWithFormat<S extends object, K extends keyof S>(
  setState: Dispatch<SetStateAction<S>>,
  field: K,
  logTag: string,
  formatMessage: (value: S[K]) => string
): (value: S[K]) => void {
  return useCallback(
    (value: S[K]) => {
      debug(`[${logTag}] ${formatMessage(value)}`);
      setState((prev) => ({ ...prev, [field]: value }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
