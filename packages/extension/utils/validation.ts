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
  if (str === undefined) {
    return undefined;
  }

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

// validates value is an array, optionally validating each element
// elementValidator receives each element and its index, returns validated value or undefined
export function validateArray<T>(
  value: unknown,
  name: string,
  elementValidator?: (el: unknown, index: number) => T | undefined,
  opts?: ValidationOptions
): T[] | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (!Array.isArray(value)) {
    log(`${ctx}${name} must be an array`, value);
    return undefined;
  }

  if (!elementValidator) {
    return value as T[];
  }

  const result: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const validated = elementValidator(value[i], i);
    if (validated === undefined) {
      log(`${ctx}${name}[${i}] is invalid`);
      return undefined;
    }
    result.push(validated);
  }

  return result;
}

// validates value is a plain object (not null, not array)
export function validateObject(
  value: unknown,
  name: string,
  opts?: ValidationOptions
): Record<string, unknown> | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    log(`${ctx}${name} must be an object`, value);
    return undefined;
  }

  return value as Record<string, unknown>;
}

// validates value is a Record<string, T> with value type checking
// valueValidator receives each value and its key, returns validated value or undefined
export function validateRecord<T>(
  value: unknown,
  name: string,
  valueValidator: (v: unknown, key: string) => T | undefined,
  opts?: ValidationOptions
): Record<string, T> | undefined {
  const obj = validateObject(value, name, opts);
  if (!obj) {
    return undefined;
  }

  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';
  const result: Record<string, T> = {};

  for (const [key, val] of Object.entries(obj)) {
    const validated = valueValidator(val, key);
    if (validated === undefined) {
      log(`${ctx}${name}.${key} is invalid`);
      return undefined;
    }
    result[key] = validated;
  }

  return result;
}

// validates value is one of allowed enum string values
export function validateEnumValue<T extends string>(
  value: unknown,
  name: string,
  allowedValues: readonly T[],
  opts?: ValidationOptions
): T | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'string') {
    log(`${ctx}${name} must be a string`, value);
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    log(`${ctx}${name} must be one of: ${allowedValues.join(', ')}`, value);
    return undefined;
  }

  return value as T;
}

// validates value is a function

export function validateFunction(
  value: unknown,
  name: string,
  opts?: ValidationOptions
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
): Function | undefined {
  const log = opts?.log ?? logWarn;
  const ctx = opts?.context ? `${opts.context}: ` : '';

  if (typeof value !== 'function') {
    log(`${ctx}${name} must be a function`, typeof value);
    return undefined;
  }

  return value;
}
