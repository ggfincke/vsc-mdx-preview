// packages/shared/errors/module-error-factories.ts
// module error factory functions for extension & webview

import { ModuleError } from './module-error';
import { getSuggestionsForCode } from './suggestions';

// error code subsets by environment
export type ExtensionModuleErrorCode = 'E100' | 'E101' | 'E110' | 'E120';
export type WebviewModuleErrorCode = 'E100' | 'E102' | 'E140' | 'E150';

// shared factories

export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleError<'E100'> {
  return new ModuleError(
    `Cannot find module "${moduleId}"\nImported from: ${parentModuleId}`,
    { code: 'E100', moduleId, parentModuleId }
  );
}

// extension-only factories

export function createOutsideWorkspaceError(
  moduleId: string,
  parentModuleId?: string
): ModuleError<'E101'> {
  return new ModuleError(`Module "${moduleId}" is outside workspace folders`, {
    code: 'E101',
    moduleId,
    parentModuleId,
  });
}

export function createParseError(
  moduleId: string,
  cause?: Error
): ModuleError<'E110'> {
  const message = cause
    ? `Syntax error in "${moduleId}": ${cause.message}`
    : `Syntax error in "${moduleId}"`;
  return new ModuleError(message, { code: 'E110', moduleId, cause });
}

export function createTransformError(
  moduleId: string,
  parentModuleId?: string,
  cause?: Error
): ModuleError<'E120'> {
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

// webview-only factories

export function createCircularDependencyError(
  moduleId: string,
  dependencyChain: string[]
): ModuleError<'E102'> {
  const chainStr = dependencyChain.join(' -> ');
  return new ModuleError(`Circular dependency detected: ${chainStr}`, {
    code: 'E102',
    moduleId,
  });
}

export function createFetchFailedError(
  moduleId: string,
  parentModuleId: string,
  cause?: Error
): ModuleError<'E140'> {
  const baseSuggestions = getSuggestionsForCode('E140');
  const suggestions = [...baseSuggestions];
  if (cause?.message) {
    suggestions.push(`Error details: ${cause.message}`);
  }
  return new ModuleError(
    `Failed to fetch module "${moduleId}"\nRequired by: ${parentModuleId}`,
    { code: 'E140', moduleId, parentModuleId, cause, suggestions }
  );
}

export function createEvaluationFailedError(
  moduleId: string,
  cause: Error
): ModuleError<'E150'> {
  return new ModuleError(
    `Error executing module "${moduleId}": ${cause.message}`,
    { code: 'E150', moduleId, cause }
  );
}

export function createModuleDepthExceededError(
  moduleId: string,
  depth: number
): Error {
  const error = new Error(
    `Module load depth exceeded: "${moduleId}" at depth ${depth}. ` +
      `This may indicate circular dependencies or an extremely deep dependency tree.`
  );
  error.name = 'ModuleDepthExceededError';
  return error;
}
