// packages/extension-host/src/shared/utils/validation/primitives.ts
// primitive type validators (string, boolean, number)

import { createTaggedLogger } from '../../logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  formatContext,
  getLogger,
  type ValidationOptions,
  type LogFn,
} from '../validation-factory';

const log = createTaggedLogger(LogTags.CONFIG);

// adapt tagged logger to LogFn for validation defaults
const defaultError: LogFn = (message, data?) => log.error(message, data);

// validate value is a string, optionally non-empty
export function validateString(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { allowEmpty?: boolean }
): string | undefined {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

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

// validate value is a boolean
export function validateBoolean(
  value: unknown,
  name: string,
  opts?: ValidationOptions
): boolean | undefined {
  const log = getLogger(opts, defaultError);
  const ctx = formatContext(opts?.context);

  if (typeof value !== 'boolean') {
    log(`${ctx}${name} must be a boolean`);
    return undefined;
  }

  return value;
}

// validate value is a number w/ optional constraints
export function validateNumber(
  value: unknown,
  name: string,
  opts?: ValidationOptions & {
    min?: number;
    max?: number;
    finite?: boolean;
    integer?: boolean;
  }
): number | undefined {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

  if (typeof value !== 'number') {
    log(`${ctx}${name} must be a number`, value);
    return undefined;
  }

  // finite check defaults to true
  if (opts?.finite !== false && !isFinite(value)) {
    log(`${ctx}${name} must be finite`, value);
    return undefined;
  }

  if (opts?.integer && !Number.isInteger(value)) {
    log(`${ctx}${name} must be an integer`, value);
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
