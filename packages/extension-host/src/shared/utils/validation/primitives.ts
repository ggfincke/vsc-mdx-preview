// packages/extension-host/src/shared/utils/validation/primitives.ts
// primitive type validators (string, boolean, number, function)

import { createTaggedLogger } from '../../logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  formatContext,
  getLogger,
  createPrimitiveValidator,
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

// validate value is a boolean (factory-generated)
export const validateBoolean = createPrimitiveValidator<boolean>({
  typeName: 'boolean',
  typeCheck: (v): v is boolean => typeof v === 'boolean',
  defaultLog: defaultError,
  logValue: false,
});

// validate value is a number w/ optional constraints
export function validateNumber(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { min?: number; max?: number; finite?: boolean }
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

// callable function type (avoids ESLint no-unsafe-function-type)
type CallableFunction = (...args: unknown[]) => unknown;

// validate value is a function (factory-generated)
export const validateFunction = createPrimitiveValidator<CallableFunction>({
  typeName: 'function',
  typeCheck: (v): v is CallableFunction => typeof v === 'function',
});
