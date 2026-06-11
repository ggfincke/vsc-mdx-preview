// packages/contracts/src/errors/index.ts
// barrel export for module error types

export {
  type ModuleErrorCode,
  type ModuleErrorData,
  isModuleErrorData,
} from './module-error-types';

export { MODULE_ERROR_SUGGESTIONS, getSuggestionsForCode } from './suggestions';
export { ModuleError, type ModuleErrorOptions } from './module-error';

export {
  type ExtensionModuleErrorCode,
  type WebviewModuleErrorCode,
  createModuleNotFoundError,
  createOutsideWorkspaceError,
  createParseError,
  createTransformError,
  createCircularDependencyError,
  createFetchFailedError,
  createEvaluationFailedError,
  createModuleDepthExceededError,
} from './module-error-factories';
