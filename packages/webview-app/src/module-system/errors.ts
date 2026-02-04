// packages/webview-app/src/module-system/errors.ts
// provide webview-specific module error helpers w/ user-friendly messages

import type {
  ModuleErrorOptions,
  WebviewModuleErrorCode,
} from '@mdx-preview/shared';

// re-export core types from shared
export {
  ModuleError,
  type ModuleErrorCode,
  type ModuleErrorData,
  isModuleErrorData,
} from '@mdx-preview/shared';

// re-export webview error factories from shared
export {
  type WebviewModuleErrorCode,
  createModuleNotFoundError,
  createCircularDependencyError,
  createFetchFailedError,
  createEvaluationFailedError,
  createModuleDepthExceededError,
} from '@mdx-preview/shared';

// local type alias for convenience
export type WebviewModuleErrorOptions =
  ModuleErrorOptions<WebviewModuleErrorCode>;
