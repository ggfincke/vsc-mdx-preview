// packages/shared/utils/errors.ts
// cross-environment error handling utilities (works in both Node.js and browser)

/**
 * Type guard to check if a value is an Error instance.
 * Works in both Node.js and browser environments.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Extract the error message from an unknown error value.
 * Returns the error's message property if it's an Error, otherwise stringifies the value.
 *
 * @example
 * try { ... } catch (error) {
 *   const message = extractErrorMessage(error);
 *   console.log(`Failed: ${message}`);
 * }
 */
export function extractErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract the stack trace from an unknown error value.
 * Returns the error's stack property if it's an Error, otherwise undefined.
 *
 * @example
 * try { ... } catch (error) {
 *   const stack = extractErrorStack(error);
 *   if (stack) console.error(stack);
 * }
 */
export function extractErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

/**
 * Normalize an unknown error value to an Error instance.
 * If the value is already an Error, returns it unchanged.
 * Otherwise, creates a new Error with the stringified value as the message.
 *
 * @example
 * try { ... } catch (error) {
 *   const normalizedError = normalizeError(error);
 *   errorReporter.report(normalizedError);
 * }
 */
export function normalizeError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Extracted error information with message and optional stack trace.
 */
export interface ErrorInfo {
  message: string;
  stack: string | undefined;
}

/**
 * Extract both message and stack from an unknown error.
 * Useful when you need both values at once.
 *
 * @example
 * try { ... } catch (error) {
 *   const { message, stack } = extractErrorInfo(error);
 *   onError({ message, stack });
 * }
 */
export function extractErrorInfo(error: unknown): ErrorInfo {
  return {
    message: extractErrorMessage(error),
    stack: extractErrorStack(error),
  };
}
