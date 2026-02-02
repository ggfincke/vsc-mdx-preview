// packages/extension/utils/async-utils.ts
// async utilities for common patterns

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

  // create timeout promise if timeoutMs is set
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise =
    timeoutMs !== undefined
      ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Operation timed out')),
            timeoutMs
          );
        })
      : null;

  try {
    // race async against timeout (if configured)
    const result = timeoutPromise
      ? await Promise.race([asyncFn(), timeoutPromise])
      : await asyncFn();
    return result;
  } catch {
    if (fallbackOnError) {
      return syncFn();
    }
    throw new Error('Async operation failed and fallback is disabled');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// run async operation with timeout
// throws if operation times out
export async function withTimeout<T>(
  asyncFn: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`)
        ),
      timeoutMs
    );
  });

  try {
    return await Promise.race([asyncFn(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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
    } catch (error) {
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
