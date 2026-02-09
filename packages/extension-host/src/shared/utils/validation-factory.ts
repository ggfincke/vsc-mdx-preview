// packages/extension/utils/validation-factory.ts
// factory utilities for creating type validators w/ consistent boilerplate handling

import { warn as logWarn } from '../logging/logger';

// log function type for validation errors
export type LogFn = (message: string, data?: unknown) => void;

// options for validation functions
export interface ValidationOptions {
  // log function to use (defaults to logWarn)
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
  defaultLog: LogFn = logWarn
): LogFn {
  return opts?.log ?? defaultLog;
}

// type check function signature for primitive validators
type TypeChecker<T> = (value: unknown) => value is T;

// configuration for creating a primitive type validator
export interface PrimitiveValidatorConfig<T> {
  // type name for error messages (e.g., "string", "boolean")
  typeName: string;
  // type guard function
  typeCheck: TypeChecker<T>;
  // default log function (defaults to logWarn)
  defaultLog?: LogFn;
  // include value in log output (defaults to true)
  logValue?: boolean;
}

// create a primitive type validator function
export function createPrimitiveValidator<T>(
  config: PrimitiveValidatorConfig<T>
): (value: unknown, name: string, opts?: ValidationOptions) => T | undefined {
  const { typeName, typeCheck, defaultLog = logWarn, logValue = true } = config;

  return (
    value: unknown,
    name: string,
    opts?: ValidationOptions
  ): T | undefined => {
    const log = getLogger(opts, defaultLog);
    const ctx = formatContext(opts?.context);

    if (!typeCheck(value)) {
      if (logValue) {
        log(`${ctx}${name} must be a ${typeName}`, value);
      } else {
        log(`${ctx}${name} must be a ${typeName}`);
      }
      return undefined;
    }

    return value;
  };
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
