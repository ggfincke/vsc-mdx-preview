// packages/extension/utils/async-utils.ts
// async utilities for common patterns

interface RaceTimeoutOptionsBase {
  timeoutMs: number;
  errorMessage?: string;
}

interface RaceTimeoutThrowOptions extends RaceTimeoutOptionsBase {
  behavior?: 'throw';
}

interface RaceTimeoutNullOptions extends RaceTimeoutOptionsBase {
  behavior: 'return-null';
}

export function raceTimeout<T>(
  promise: Promise<T>,
  options: RaceTimeoutThrowOptions
): Promise<T>;
export function raceTimeout<T>(
  promise: Promise<T>,
  options: RaceTimeoutNullOptions
): Promise<T | null>;

// race promise against timeout using throw or null behavior
export async function raceTimeout<T>(
  promise: Promise<T>,
  options: RaceTimeoutThrowOptions | RaceTimeoutNullOptions
): Promise<T | null> {
  const { timeoutMs, errorMessage, behavior = 'throw' } = options;
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise =
    behavior === 'return-null'
      ? new Promise<null>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
        })
      : new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  errorMessage ?? `Operation timed out after ${timeoutMs}ms`
                )
              ),
            timeoutMs
          );
        });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

// try async operation, fall back to sync on failure or timeout
// useful when async is preferred but sync is an acceptable fallback
export async function withSyncFallback<T>(
  asyncFn: () => Promise<T>,
  syncFn: () => T,
  options?: {
    // timeout ms before sync fallback
    timeoutMs?: number;
    // fallback to sync on error
    fallbackOnError?: boolean;
  }
): Promise<T> {
  const { timeoutMs, fallbackOnError = true } = options ?? {};

  try {
    if (timeoutMs === undefined) {
      return await asyncFn();
    }

    return await raceTimeout(asyncFn(), {
      timeoutMs,
      errorMessage: 'Operation timed out',
    });
  } catch {
    if (fallbackOnError) {
      return syncFn();
    }
    throw new Error('Async operation failed and fallback is disabled');
  }
}

// retry async operation with exponential backoff
export async function withRetry<T>(
  asyncFn: () => Promise<T>,
  options?: {
    // max retries
    maxRetries?: number;
    // initial delay ms
    initialDelayMs?: number;
    // backoff multiplier
    backoffMultiplier?: number;
    // max delay ms
    maxDelayMs?: number;
    // check if error is retryable
    isRetryable?: (error: unknown) => boolean;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    backoffMultiplier = 2,
    maxDelayMs = 5000,
    isRetryable = () => true,
  } = options ?? {};

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error: unknown) {
      lastError = error;

      // don't retry on last attempt or if not retryable
      if (attempt === maxRetries || !isRetryable(error)) {
        break;
      }

      // wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}
