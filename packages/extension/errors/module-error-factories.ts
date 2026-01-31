// packages/extension/errors/module-error-factories.ts
// create module fetch errors

import { ModuleError, type ModuleFetchErrorCode } from './index';

// factory: module not found error
export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleError<ModuleFetchErrorCode> {
  return new ModuleError(
    `Cannot find module "${moduleId}"\nImported from: ${parentModuleId}`,
    {
      code: 'E100',
      moduleId,
      parentModuleId,
    }
  );
}

// factory: outside workspace error
export function createOutsideWorkspaceError(
  moduleId: string,
  parentModuleId?: string
): ModuleError<ModuleFetchErrorCode> {
  return new ModuleError(`Module "${moduleId}" is outside workspace folders`, {
    code: 'E101',
    moduleId,
    parentModuleId,
  });
}

// factory: parse error
export function createParseError(
  moduleId: string,
  cause?: Error
): ModuleError<ModuleFetchErrorCode> {
  const message = cause
    ? `Syntax error in "${moduleId}": ${cause.message}`
    : `Syntax error in "${moduleId}"`;
  return new ModuleError(message, { code: 'E110', moduleId, cause });
}

// factory: transform error
export function createTransformError(
  moduleId: string,
  parentModuleId?: string,
  cause?: Error
): ModuleError<ModuleFetchErrorCode> {
  const message = cause
    ? `Failed to compile "${moduleId}": ${cause.message}`
    : `Failed to compile "${moduleId}"`;
  return new ModuleError(message, {
    code: 'E120',
    moduleId,
    parentModuleId,
    cause,
  });
}
