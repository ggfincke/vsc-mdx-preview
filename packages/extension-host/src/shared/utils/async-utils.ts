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
