// packages/webview-app/src/module-system/errors.ts
// provide webview-specific module error helpers w/ user-friendly messages

import type {
  ModuleErrorOptions,
  WebviewModuleErrorCode,
} from '@mdx-preview/contracts';

// re-export core types from shared
export {
  type ModuleErrorCode,
  type ModuleErrorData,
  ModuleError,
  isModuleErrorData,
} from '@mdx-preview/contracts';

// re-export webview error factories from shared
export {
  type WebviewModuleErrorCode,
  createCircularDependencyError,
  createEvaluationFailedError,
  createFetchFailedError,
  createModuleDepthExceededError,
  createModuleNotFoundError,
} from '@mdx-preview/contracts';

// local type alias for convenience
export type WebviewModuleErrorOptions =
  ModuleErrorOptions<WebviewModuleErrorCode>;
