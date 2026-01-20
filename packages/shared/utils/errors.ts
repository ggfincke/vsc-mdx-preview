// packages/shared/utils/errors.ts
// cross-environment error handling utilities (works in both Node.js & browser)

// type guard to check if a value is an Error instance
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// extract the error message from an unknown error value
export function extractErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

// extract the stack trace from an unknown error value
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
