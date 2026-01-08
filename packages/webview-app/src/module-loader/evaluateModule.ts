// packages/webview-app/src/module-loader/evaluateModule.ts
// * module evaluator - evaluates module code using new Function()
// ONLY used in Trusted Mode when canExecute is true
//
// supports two module formats:
// 1. MDX function-body: expects runtime in arguments[0], returns { default: Component }
// 2. CJS-style: uses require/exports/module.exports pattern

import type { ModuleRuntime } from './types';

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
): any {
  // CJS-style module context
  const module = { exports: {} as any };
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
    // re-throw w/ module context for better error messages
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error evaluating module "${moduleId}": ${message}`);
  }
}
