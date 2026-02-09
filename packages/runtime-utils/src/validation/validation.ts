// packages/runtime-utils/src/validation/validation.ts
// pure validation utilities w/o logging dependencies

// validate value is a string, optionally non-empty
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// validate value is a non-empty string
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

// validate value is a boolean
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// validate value is a number
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

// validate value is a finite number
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

// validate value is a function
export function isFunction(
  value: unknown
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

// validate value is an object (not null, not array)
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// validate value is an array
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// validate value is an array of a specific type
export function isArrayOf<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemValidator);
}

// validate value is one of the allowed values
export function isOneOf<T extends string | number>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return allowed.includes(value as T);
}

// validate optional value (undefined passes)
export function isOptional<T>(
  value: unknown,
  validator: (v: unknown) => v is T
): value is T | undefined {
  return value === undefined || validator(value);
}

// coerce value to string or return undefined
export function asString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

// coerce value to non-empty string or return undefined
export function asNonEmptyString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

// coerce value to boolean or return undefined
export function asBoolean(value: unknown): boolean | undefined {
  return isBoolean(value) ? value : undefined;
}

// coerce value to number or return undefined
export function asNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}
