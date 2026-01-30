// packages/extension/errors/module-error-factories.ts
// factory functions for creating ModuleFetchError instances

import { ModuleFetchError } from './index';

// factory: module not found error
export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleFetchError {
  return new ModuleFetchError(
    `Cannot find module "${moduleId}"\nImported from: ${parentModuleId}`,
    'E100',
    moduleId,
    parentModuleId
  );
}

// factory: outside workspace error
export function createOutsideWorkspaceError(
  moduleId: string,
  parentModuleId?: string
): ModuleFetchError {
  return new ModuleFetchError(
    `Module "${moduleId}" is outside workspace folders`,
    'E101',
    moduleId,
    parentModuleId
  );
}

// factory: parse error
export function createParseError(
  moduleId: string,
  cause?: Error
): ModuleFetchError {
  const message = cause
    ? `Syntax error in "${moduleId}": ${cause.message}`
    : `Syntax error in "${moduleId}"`;
  return new ModuleFetchError(message, 'E110', moduleId, undefined, { cause });
}

// factory: transform error
export function createTransformError(
  moduleId: string,
  parentModuleId?: string,
  cause?: Error
): ModuleFetchError {
  const message = cause
    ? `Failed to compile "${moduleId}": ${cause.message}`
    : `Failed to compile "${moduleId}"`;
  return new ModuleFetchError(message, 'E120', moduleId, parentModuleId, {
    cause,
  });
}
