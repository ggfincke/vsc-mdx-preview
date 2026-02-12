// packages/contracts/src/runtime/index.ts
// barrel export for runtime constants & preloaded module IDs

export {
  STANDARD_DEBOUNCE_MS,
  STANDARD_CACHE_TTL_MS,
  STANDARD_WATCHER_DEBOUNCE_MS,
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from './constants';

export {
  PRELOADED_MODULE_IDS,
  type PreloadedModuleId,
} from './preloaded-modules';
