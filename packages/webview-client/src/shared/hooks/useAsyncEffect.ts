// packages/webview-client/src/shared/hooks/useAsyncEffect.ts
// hook for running async operations in useEffect w/ automatic cancellation

import { useEffect, useRef, DependencyList } from 'react';

// signal object passed to async functions to check cancellation status
export interface CancellationSignal {
  // check if the effect has been cancelled (due to unmount or deps change)
  isCancelled(): boolean;
}

// async effect behavior options
export interface UseAsyncEffectOptions<T> {
  // success callback w/ result
  onSuccess?: (result: T) => void;
  // error callback
  onError?: (error: unknown) => void;
  // loading state callback
  onLoadingChange?: (isLoading: boolean) => void;
}

// hook for running async operations in useEffect w/ automatic cancellation
export function useAsyncEffect<T>(
  asyncFn: (signal: CancellationSignal) => Promise<T | void>,
  deps: DependencyList,
  options: UseAsyncEffectOptions<T> = {}
): void {
  const { onSuccess, onError, onLoadingChange } = options;

  // store latest callbacks in ref to avoid requiring them in deps
  // ensure we always call the most recent callback w/o needing the caller to memoize them
  const callbacksRef = useRef({ onSuccess, onError, onLoadingChange });
  callbacksRef.current = { onSuccess, onError, onLoadingChange };

  useEffect(() => {
    let cancelled = false;
    const signal: CancellationSignal = {
      isCancelled: () => cancelled,
    };

    async function run() {
      // set loading state before starting async work
      callbacksRef.current.onLoadingChange?.(true);

      try {
        const result = await asyncFn(signal);

        // only call onSuccess if not cancelled & result is not undefined
        if (!cancelled && result !== undefined) {
          callbacksRef.current.onSuccess?.(result as T);
        }
      } catch (error: unknown) {
        // only call onError if not cancelled
        if (!cancelled) {
          callbacksRef.current.onError?.(error);
        }
      } finally {
        // only update loading state if not cancelled
        if (!cancelled) {
          callbacksRef.current.onLoadingChange?.(false);
        }
      }
    }

    run();

    // cleanup function - mark as cancelled so pending async work won't update state
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
