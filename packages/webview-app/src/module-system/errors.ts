// packages/webview-app/src/module-system/errors.ts
// webview-specific error class w/ user-friendly messages

import {
  type ModuleErrorCode,
  type ModuleErrorData,
  getSuggestionsForCode,
  formatModuleErrorDisplay,
  isModuleErrorData,
} from '@mdx-preview/shared';

// re-export for convenience
export { type ModuleErrorCode, type ModuleErrorData, isModuleErrorData };

// webview-only error codes (subset of ModuleErrorCode)
export type WebviewModuleErrorCode = 'E100' | 'E102' | 'E140' | 'E150';

export interface ModuleLoadErrorOptions {
  code: WebviewModuleErrorCode;
  moduleId: string;
  parentModuleId?: string;
  cause?: Error;
  suggestions?: string[];
}

// webview-specific error for module loading failures
// provides user-friendly messages without referencing extension-only resources
export class ModuleLoadError extends Error {
  readonly code: WebviewModuleErrorCode;
  readonly moduleId: string;
  readonly parentModuleId?: string;
  readonly suggestions: string[];
  readonly recoverable: boolean;

  constructor(message: string, options: ModuleLoadErrorOptions) {
    super(message);
    this.name = 'ModuleLoadError';
    this.code = options.code;
    this.moduleId = options.moduleId;
    this.parentModuleId = options.parentModuleId;
    this.suggestions =
      options.suggestions ??
      getSuggestionsForCode(options.code as ModuleErrorCode);
    this.recoverable = true; // module errors are generally fixable by the user

    // ES2022 cause support
    if (options.cause) {
      (this as { cause?: Error }).cause = options.cause;
    }

    // Ensure prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // serialize to shared ModuleErrorData
  toModuleErrorData(): ModuleErrorData {
    return {
      code: this.code as ModuleErrorCode,
      message: this.message,
      moduleId: this.moduleId,
      parentModuleId: this.parentModuleId,
      suggestions: this.suggestions,
      recoverable: this.recoverable,
      stack: this.stack,
      causeMessage: (this as { cause?: Error }).cause?.message,
    };
  }

  // format for display w/ suggestions
  toDisplayMessage(): string {
    return formatModuleErrorDisplay(this.toModuleErrorData());
  }
}

// factory: module not found error
export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleLoadError {
  return new ModuleLoadError(
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
): ModuleLoadError {
  const baseSuggestions = getSuggestionsForCode('E140');
  const suggestions = [...baseSuggestions];

  // add specific error detail if available
  if (cause?.message) {
    suggestions.push(`Error details: ${cause.message}`);
  }

  return new ModuleLoadError(
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
): ModuleLoadError {
  return new ModuleLoadError(
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
): ModuleLoadError {
  const chainStr = dependencyChain.join(' -> ');
  return new ModuleLoadError(`Circular dependency detected: ${chainStr}`, {
    code: 'E102',
    moduleId,
  });
}
