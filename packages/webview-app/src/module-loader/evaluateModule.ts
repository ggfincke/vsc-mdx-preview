/**
 * Module Evaluator
 *
 * Evaluates module code using new Function().
 * ONLY used in Trusted Mode when canExecute is true.
 *
 * Supports two module formats:
 * 1. MDX function-body: expects runtime in arguments[0], returns { default: Component }
 * 2. CJS-style: uses require/exports/module.exports pattern
 */

import type { ModuleRuntime } from './types';

/**
 * Evaluate a module string.
 *
 * For MDX function-body output (outputFormat: 'function-body'):
 *   - Runtime is passed as arguments[0]
 *   - Returns { default: MDXContent }
 *
 * For CJS-style modules:
 *   - Uses require/exports/module.exports
 *   - Returns module.exports
 *
 * @param code - The module code to evaluate
 * @param moduleId - The module identifier (for debugging/errors)
 * @param runtime - The runtime object providing jsx functions and require
 * @returns The module exports
 *
 * @throws Error if code execution fails
 */
export function evaluateModule(
  code: string,
  moduleId: string,
  runtime: ModuleRuntime
): any {
  // CJS-style module context
  const module = { exports: {} as any };
  const exports = module.exports;

  try {
    // Create the function
    // MDX function-body reads from arguments[0]
    // We pass runtime as first arg and also inject require as local variable for CJS compat
    const fn = new Function(
      'runtime',
      'exports',
      'module',
      '__filename',
      // Inject require as local variable for CJS compatibility
      `const require = runtime.require;\n${code}`
    );

    // Execute the function
    const result = fn(runtime, exports, module, moduleId);

    // MDX function-body returns { default: MDXContent }
    // CJS modules populate module.exports
    // Return whichever is populated
    if (result !== undefined) {
      return result;
    }

    return module.exports;
  } catch (error) {
    // Re-throw with module context for better error messages
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error evaluating module "${moduleId}": ${message}`);
  }
}
