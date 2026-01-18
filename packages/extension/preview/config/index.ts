// packages/extension/preview/config/index.ts
// barrel export for config resolution modules

export {
  resolveConfig,
  onConfigChange,
  clearConfigCache,
  disposeConfigWatchers,
  getConfigFileNames,
  type PluginSpec,
  type ComponentMapping,
  type FrameworkOptions,
  type MdxPreviewConfig,
  type ResolvedConfig,
} from './ConfigResolver';

// Re-export config change types from ConfigCache
export {
  ConfigChangeType,
  type ConfigChangeEvent,
  type ConfigChangeCallback,
} from '../../config/ConfigCache';

export {
  resolveTypescriptConfig,
  findTsConfig,
  type TypeScriptConfiguration,
} from './TypeScriptConfigResolver';
