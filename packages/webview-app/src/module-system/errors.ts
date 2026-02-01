// packages/webview-app/src/module-system/errors.ts
// provide webview-specific module error helpers w/ user-friendly messages

import {
  type ModuleErrorCode,
  type ModuleErrorData,
  type ModuleErrorOptions,
  getSuggestionsForCode,
  isModuleErrorData,
  ModuleError,
} from '@mdx-preview/shared';

// re-export for convenience
export {
  ModuleError,
  type ModuleErrorCode,
  type ModuleErrorData,
  isModuleErrorData,
};

// webview-only error codes (subset of ModuleErrorCode)
export type WebviewModuleErrorCode = 'E100' | 'E102' | 'E140' | 'E150';
export type WebviewModuleErrorOptions =
  ModuleErrorOptions<WebviewModuleErrorCode>;

// factory: module not found error
export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleError<WebviewModuleErrorCode> {
  return new ModuleError(
    `Cannot find module "${moduleId}"\nImported from: ${parentModuleId}`,
    {
      code: 'E100',
      moduleId,
      parentModuleId,
    }
  );
}

// factory: fetch failed error
export function createFetchFailedError(
  moduleId: string,
  parentModuleId: string,
  cause?: Error
): ModuleError<WebviewModuleErrorCode> {
  const baseSuggestions = getSuggestionsForCode('E140');
  const suggestions = [...baseSuggestions];

  // add specific error detail if available
  if (cause?.message) {
    suggestions.push(`Error details: ${cause.message}`);
  }

  return new ModuleError(
    `Failed to fetch module "${moduleId}"\nRequired by: ${parentModuleId}`,
    {
      code: 'E140',
      moduleId,
      parentModuleId,
      cause,
      suggestions,
    }
  );
}

// factory: evaluation failed error
export function createEvaluationFailedError(
  moduleId: string,
  cause: Error
): ModuleError<WebviewModuleErrorCode> {
  return new ModuleError(
    `Error executing module "${moduleId}": ${cause.message}`,
    {
      code: 'E150',
      moduleId,
      cause,
    }
  );
}

// factory: circular dependency error
export function createCircularDependencyError(
  moduleId: string,
  dependencyChain: string[]
): ModuleError<WebviewModuleErrorCode> {
  const chainStr = dependencyChain.join(' -> ');
  return new ModuleError(`Circular dependency detected: ${chainStr}`, {
    code: 'E102',
    moduleId,
  });
}

// factory: module depth exceeded error (stack overflow prevention)
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
