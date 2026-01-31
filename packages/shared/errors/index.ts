// packages/shared/errors/index.ts
// barrel export for shared module error types

export {
  type ModuleErrorCode,
  type ModuleErrorData,
  MODULE_ERROR_LABELS,
  isModuleErrorData,
  formatModuleErrorDisplay,
} from './module-error-types';

export { MODULE_ERROR_SUGGESTIONS, getSuggestionsForCode } from './suggestions';
export { ModuleError, type ModuleErrorOptions } from './module-error';
