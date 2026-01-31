// packages/webview-app/src/module-system/eval/evaluateModule.ts
// module evaluator - evaluates module code using new Function()
// ONLY used in Trusted Mode when canExecute is true
//
// supports two module formats:
// 1. MDX function-body: expects runtime in arguments[0], returns { default: Component }
// 2. CJS-style: uses require/exports/module.exports pattern

import type { ModuleRuntime } from '../types';
import { normalizeError } from '@mdx-preview/shared';

// evaluate a module string
// for MDX function-body output (outputFormat: 'function-body'):
//   - runtime is passed as arguments[0]
//   - returns { default: MDXContent }
// for CJS-style modules:
//   - uses require/exports/module.exports
//   - returns module.exports
export function evaluateModule(
  code: string,
  moduleId: string,
  runtime: ModuleRuntime
): Record<string, unknown> {
  // CJS-style module context
  const module = { exports: {} as Record<string, unknown> };
  const exports = module.exports;

  try {
    // create the function
    // MDX function-body reads from arguments[0]
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

    // MDX function-body returns { default: MDXContent }
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

    // ES2022 cause for tooling that supports it
    (contextualError as { cause?: Error }).cause = originalError;

    // also include original stack in the stack property for display
    if (originalError.stack) {
      contextualError.stack = `${contextualError.message}\n    caused by: ${originalError.stack}`;
    }

    throw contextualError;
  }
}
