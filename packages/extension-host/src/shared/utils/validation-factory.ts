// packages/extension-host/src/shared/utils/validation-factory.ts
// factory utilities for creating type validators w/ consistent boilerplate handling

import { createTaggedLogger } from '../logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// log function type for validation errors
export type LogFn = (message: string, data?: unknown) => void;

const log = createTaggedLogger(LogTags.CONFIG);

// adapt tagged logger to LogFn for validation defaults
const defaultWarn: LogFn = (message, data?) => log.warn(message, data);

// options for validation functions
export interface ValidationOptions {
  // log function to use (defaults to defaultWarn)
  log?: LogFn;
  // context for error messages (e.g., "fetch", "openDocument")
  context?: string;
}

// format error message context consistently
export function formatContext(context?: string): string {
  return context ? `${context}: ` : '';
}

// get the log function w/ fallback to default
export function getLogger(
  opts?: ValidationOptions,
  defaultLog: LogFn = defaultWarn
): LogFn {
  return opts?.log ?? defaultLog;
}

// create a validator for optional values (undefined passes through w/o logging)
export function createOptionalValidator<
  T,
  O extends ValidationOptions = ValidationOptions,
>(
  baseValidator: (value: unknown, name: string, opts?: O) => T | undefined
): (value: unknown, name: string, opts?: O) => T | undefined {
  return (value: unknown, name: string, opts?: O): T | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return baseValidator(value, name, opts);
  };
}
