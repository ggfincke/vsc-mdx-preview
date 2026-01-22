// packages/webview-app/src/hooks/useAsyncEffect.ts
// hook for running async operations in useEffect w/ automatic cancellation

import { useEffect, useRef, DependencyList } from 'react';

// signal object passed to async functions to check cancellation status
export interface CancellationSignal {
  // check if the effect has been cancelled (due to unmount or deps change)
  isCancelled(): boolean;
}

// options for configuring the async effect behavior
export interface UseAsyncEffectOptions<T> {
  // called when the async operation completes successfully w/ a non-void result
  onSuccess?: (result: T) => void;
  // called when the async operation throws an error
  onError?: (error: unknown) => void;
  // called when loading state changes (true before work, false after)
  onLoadingChange?: (isLoading: boolean) => void;
}

// * hook for running async operations in useEffect w/ automatic cancellation
export function useAsyncEffect<T>(
  asyncFn: (signal: CancellationSignal) => Promise<T | void>,
  deps: DependencyList,
  options: UseAsyncEffectOptions<T> = {}
): void {
  const { onSuccess, onError, onLoadingChange } = options;

  // Store latest callbacks in ref to avoid requiring them in deps.
  // This ensures we always call the most recent callback without
  // needing the caller to memoize them.
  const callbacksRef = useRef({ onSuccess, onError, onLoadingChange });
  callbacksRef.current = { onSuccess, onError, onLoadingChange };

  useEffect(() => {
    let cancelled = false;
    const signal: CancellationSignal = {
      isCancelled: () => cancelled,
    };

    async function run() {
      // Set loading state before starting async work
      callbacksRef.current.onLoadingChange?.(true);

      try {
        const result = await asyncFn(signal);

        // Only call onSuccess if:
        // 1. Not cancelled (effect still active)
        // 2. Result is not undefined (asyncFn didn't return early)
        if (!cancelled && result !== undefined) {
          callbacksRef.current.onSuccess?.(result as T);
        }
      } catch (error) {
        // Only call onError if not cancelled
        if (!cancelled) {
          callbacksRef.current.onError?.(error);
        }
      } finally {
        // Only update loading state if not cancelled
        if (!cancelled) {
          callbacksRef.current.onLoadingChange?.(false);
        }
      }
    }

    run();

    // Cleanup function - mark as cancelled so pending async work
    // won't update state after unmount or deps change
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
