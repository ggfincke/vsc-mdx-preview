// packages/extension/utils/validation.ts
// input validation utilities for RPC & other external inputs

import { warn as logWarn, error as logError } from '../logging';

type LogFn = typeof logWarn;

export interface ValidationOptions {
  // log function to use (defaults to logWarn)
  log?: LogFn;
  // context for error messages (e.g., "fetch", "openDocument")
  context?: string;
}

// validates value is a string, optionally non-empty
export function validateString(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { allowEmpty?: boolean }
): string | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'string') {
    log(`${ctx}${name} must be a string`, value);
    return undefined;
  }

  if (!opts?.allowEmpty && value.trim() === '') {
    log(`${ctx}${name} cannot be empty`, value);
    return undefined;
  }

  return value;
}

// validates value is a boolean
export function validateBoolean(
  value: unknown,
  name: string,
  opts?: ValidationOptions
): boolean | undefined {
  const log = opts?.log ?? logError;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'boolean') {
    log(`${ctx}${name} must be a boolean`);
    return undefined;
  }

  return value;
}

// validates value is a number w/ optional constraints
export function validateNumber(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { min?: number; max?: number; finite?: boolean }
): number | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'number') {
    log(`${ctx}${name} must be a number`, value);
    return undefined;
  }

  // finite check defaults to true
  if (opts?.finite !== false && !isFinite(value)) {
    log(`${ctx}${name} must be finite`, value);
    return undefined;
  }

  if (opts?.min !== undefined && value < opts.min) {
    log(`${ctx}${name} must be >= ${opts.min}`, value);
    return undefined;
  }

  if (opts?.max !== undefined && value > opts.max) {
    log(`${ctx}${name} must be <= ${opts.max}`, value);
    return undefined;
  }

  return value;
}

// validates & parses a URL string
export function validateUrl(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { allowedSchemes?: string[] }
): URL | undefined {
  const str = validateString(value, name, opts);
  if (str === undefined) {return undefined;}

  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  let parsed: URL;
  try {
    parsed = new URL(str);
  } catch {
    log(`${ctx}failed to parse ${name}`, str);
    return undefined;
  }

  if (opts?.allowedSchemes && !opts.allowedSchemes.includes(parsed.protocol)) {
    log(`${ctx}disallowed scheme for ${name}`, parsed.protocol);
    return undefined;
  }

  return parsed;
}

// validates an optional number parameter (used for line/column in openDocument)
// returns the validated number, or undefined if the value is undefined or invalid
// does not log for undefined values (they're optional)
export function validateOptionalNumber(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { min?: number }
): number | undefined {
  // optional: undefined is valid
  if (value === undefined) {
    return undefined;
  }

  return validateNumber(value, name, opts);
}
