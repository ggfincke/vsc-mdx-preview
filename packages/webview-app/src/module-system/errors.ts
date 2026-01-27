// packages/webview-app/src/module-system/errors.ts
// webview-specific error classes with user-friendly messages
// these errors provide actionable suggestions appropriate for the webview context

export type ModuleLoadErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'FETCH_FAILED'
  | 'CIRCULAR_DEPENDENCY'
  | 'EVALUATION_FAILED';

export interface ModuleLoadErrorOptions {
  code: ModuleLoadErrorCode;
  moduleId: string;
  parentModuleId?: string;
  cause?: Error;
  suggestions?: string[];
}

// webview-specific error for module loading failures
// provides user-friendly messages without referencing extension-only resources
export class ModuleLoadError extends Error {
  readonly code: ModuleLoadErrorCode;
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
    this.suggestions = options.suggestions ?? [];
    this.recoverable = true; // module errors are generally fixable by the user

    // ES2022 cause support
    if (options.cause) {
      (this as { cause?: Error }).cause = options.cause;
    }

    // Ensure prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Format for display in webview with suggestions
  toDisplayMessage(): string {
    let msg = this.message;
    if (this.suggestions.length > 0) {
      msg += '\n\nTry:\n' + this.suggestions.map((s) => `  - ${s}`).join('\n');
    }
    return msg;
  }
}

// factory function: module not found error
export function createModuleNotFoundError(
  moduleId: string,
  parentModuleId: string
): ModuleLoadError {
  return new ModuleLoadError(
    `Cannot find module "${moduleId}"\nImported from: ${parentModuleId}`,
    {
      code: 'MODULE_NOT_FOUND',
      moduleId,
      parentModuleId,
      suggestions: [
        'Check that the import path is correct',
        'Verify the file exists in your workspace',
        'For npm packages, ensure they are installed',
        'Check your .mdx-previewrc.json component mappings',
      ],
    }
  );
}

// factory function: fetch failed error
export function createFetchFailedError(
  moduleId: string,
  parentModuleId: string,
  cause?: Error
): ModuleLoadError {
  const suggestions = [
    'Check that the file path is valid',
    'Verify file permissions allow reading',
    'If using TypeScript paths, ensure tsconfig.json is correct',
  ];

  // Add specific error detail if available
  if (cause?.message) {
    suggestions.push(`Error details: ${cause.message}`);
  }

  return new ModuleLoadError(
    `Failed to fetch module "${moduleId}"\nRequired by: ${parentModuleId}`,
    {
      code: 'FETCH_FAILED',
      moduleId,
      parentModuleId,
      cause,
      suggestions,
    }
  );
}

// factory function: evaluation failed error
export function createEvaluationFailedError(
  moduleId: string,
  cause: Error
): ModuleLoadError {
  return new ModuleLoadError(
    `Error executing module "${moduleId}": ${cause.message}`,
    {
      code: 'EVALUATION_FAILED',
      moduleId,
      cause,
      suggestions: [
        'Check for syntax errors in the module',
        'Verify all imports are available',
        'Look for runtime errors in the code',
      ],
    }
  );
}

// factory function: circular dependency error
export function createCircularDependencyError(
  moduleId: string,
  dependencyChain: string[]
): ModuleLoadError {
  const chainStr = dependencyChain.join(' -> ');
  return new ModuleLoadError(
    `Circular dependency detected: ${chainStr}`,
    {
      code: 'CIRCULAR_DEPENDENCY',
      moduleId,
      suggestions: [
        'Break the circular import by restructuring your modules',
        'Move shared code to a separate file that both modules can import',
        'Consider using lazy imports or dynamic imports',
      ],
    }
  );
}
