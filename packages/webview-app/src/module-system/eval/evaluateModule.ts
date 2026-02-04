// packages/webview-app/src/module-system/eval/evaluateModule.ts
// module evaluator - evaluate module code using new Function()
// ONLY used in Trusted Mode when canExecute is true
//
// support two module formats
// 1. MDX function-body: expect runtime in arguments[0], return { default: Component }
// 2. CJS-style: use require/exports/module.exports pattern

import type { ModuleRuntime } from '../types';
import { normalizeError } from '@mdx-preview/shared';

// evaluate a module string
// MDX function-body format
//   - pass runtime as arguments[0]
//   - return { default: MDXContent }
// for CJS-style modules
//   - use require/exports/module.exports
//   - return module.exports
export function evaluateModule(
  code: string,
  moduleId: string,
  runtime: ModuleRuntime
): Record<string, unknown> {
  // cjs-style module context
  const module = { exports: {} as Record<string, unknown> };
  const exports = module.exports;

  try {
    // create the function
    // MDX function-body read from arguments[0]
    // we pass runtime as first arg & also inject require as local variable for CJS compat
    const fn = new Function(
      'runtime',
      'exports',
      'module',
      '__filename',
      // inject require as local variable for CJS compatibility
      `const require = runtime.require;\n${code}`
    );

    // execute the function
    const result = fn(runtime, exports, module, moduleId);

    // MDX function-body return { default: MDXContent }
    // CJS modules populate module.exports
    // return whichever is populated
    if (result !== undefined) {
      return result;
    }

    return module.exports;
  } catch (error) {
    // preserve original error chain using Error.cause (ES2022)
    const originalError = normalizeError(error);
    const contextualError = new Error(
      `Error evaluating module "${moduleId}": ${originalError.message}`
    );

    // es2022 cause for tooling that support it
    (contextualError as { cause?: Error }).cause = originalError;

    // also include original stack in the stack property for display
    if (originalError.stack) {
      contextualError.stack = `${contextualError.message}\n    caused by: ${originalError.stack}`;
    }

    throw contextualError;
  }
}
