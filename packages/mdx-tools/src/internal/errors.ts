// shared error utilities

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// extract error message w/ robust object check
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Unknown error';
}

// convert any value to Error
export function normalizeError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  return new Error(String(error));
}
