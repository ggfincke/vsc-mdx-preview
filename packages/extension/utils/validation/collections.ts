// packages/extension/utils/validation/collections.ts
// collection validators (array, object, record)

import {
  formatContext,
  getLogger,
  type ValidationOptions,
} from '../validation-factory';

// validates value is an array, optionally validating each element
// elementValidator receives each element & its index, returns validated value or undefined
export function validateArray<T>(
  value: unknown,
  name: string,
  elementValidator?: (el: unknown, index: number) => T | undefined,
  opts?: ValidationOptions
): T[] | undefined {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

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
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    log(`${ctx}${name} must be an object`, value);
    return undefined;
  }

  return value as Record<string, unknown>;
}

// validates value is a Record<string, T> w/ value type checking
// valueValidator receives each value & its key, returns validated value or undefined
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

  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);
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
