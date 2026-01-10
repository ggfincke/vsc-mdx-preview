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
  type MdxPreviewConfig,
  type ResolvedConfig,
} from './ConfigResolver';

export {
  resolveTypescriptConfig,
  findTsConfig,
  type TypeScriptConfiguration,
} from './TypeScriptConfigResolver';
