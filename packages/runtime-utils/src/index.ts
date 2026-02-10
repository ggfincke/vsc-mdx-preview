// packages/runtime-utils/src/index.ts
// pure runtime utilities shared by extension & webview

export { LRUCache, type LRUCacheOptions } from './cache/lru-cache';
export {
  ContentHashCache,
  type ContentHashCacheOptions,
} from './cache/content-hash-cache';
export { Semaphore } from './async/semaphore';
export {
  normalizePlantUmlServerUrl,
  getPlantUmlServerOrigin,
  getPlantUmlRenderEndpoints,
} from './diagrams/plantuml-server';
export {
  isError,
  extractErrorMessage,
  extractErrorStack,
  normalizeError,
  extractErrorInfo,
  extractErrorChain,
  formatErrorWithCause,
  type ErrorInfo,
} from './errors/normalize';
export {
  NPM_MODULE_PREFIX,
  isNpmModuleId,
  isBareImport,
  parseNpmModuleId,
  createNpmModuleId,
  hasUrlScheme,
  isValidModuleRequest,
  URL_SCHEME_PATTERN,
  type ParsedNpmModuleId,
} from './module-id/module-id';
export {
  isString,
  isNonEmptyString,
  isBoolean,
  isNumber,
  isFiniteNumber,
  isFunction,
  isObject,
  isArray,
  isArrayOf,
  isOneOf,
  isOptional,
  asString,
  asNonEmptyString,
  asBoolean,
  asNumber,
} from './validation/validation';
