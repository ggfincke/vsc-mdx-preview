// packages/shared/utils/errors.ts
// cross-environment error handling utilities (works in both Node.js & browser)

// check if value is an Error instance (type guard)
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// extract error message from an unknown error value
export function extractErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

// extract stack trace from an unknown error value
export function extractErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

// normalize an unknown error value to an Error instance
export function normalizeError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  return new Error(String(error));
}

// extracted error information w/ message & optional stack trace
export interface ErrorInfo {
  message: string;
  stack: string | undefined;
}

// extract both message & stack from an unknown error
export function extractErrorInfo(error: unknown): ErrorInfo {
  return {
    message: extractErrorMessage(error),
    stack: extractErrorStack(error),
  };
}

// extract full error chain including causes (ES2022)
// walks the cause chain & returns all errors in order
export function extractErrorChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;

  while (current) {
    const normalized = normalizeError(current);
    chain.push(normalized);
    current = (normalized as { cause?: unknown }).cause;
  }

  return chain;
}

// format error w/ full cause chain for logging/display
export function formatErrorWithCause(error: unknown): string {
  const chain = extractErrorChain(error);
  return chain
    .map((err, i) => {
      const prefix = i === 0 ? '' : '\nCaused by: ';
      return `${prefix}${err.message}`;
    })
    .join('');
}
