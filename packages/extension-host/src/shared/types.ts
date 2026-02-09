// shared cross-layer type barrel

export * from './config/types';
export {
  ConfigChangeType,
  type ConfigChangeEvent,
  type ConfigChangeCallback,
} from '../features/preview/types/watcher';
export type { ConfigurationState } from '../features/preview/types/preview';
