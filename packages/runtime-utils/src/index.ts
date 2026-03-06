// packages/runtime-utils/src/index.ts
// pure runtime utilities shared by extension & webview

export { LRUCache, type LRUCacheOptions } from './cache/lru-cache';
export {
  ContentHashCache,
  type ContentHashCacheOptions,
} from './cache/content-hash-cache';
export { Semaphore } from './async/semaphore';
export {
  createLazyValueLoader,
  type LazyValueLoader,
  type LazyValueLoaderOptions,
} from './async/lazy-value-loader';
export { getPlantUmlRenderEndpoints } from './diagrams/plantuml-server';
export {
  extractErrorMessage,
  normalizeError,
  extractErrorInfo,
  type ErrorInfo,
} from './errors/normalize';
export {
  isNpmModuleId,
  isBareImport,
  isValidModuleRequest,
} from './module-id/module-id';
