// packages/extension-host/src/features/preview/configuration/index.ts
// barrel export for config resolution modules

export {
  resolveConfig,
  onConfigChange,
  clearConfigCache,
  getConfigFileNames,
} from './ConfigResolver';

// re-export ConfigChangeType (enum value, not just type)
export { ConfigChangeType } from '../../../shared/config/ConfigCache';

export {
  resolveTypescriptConfig,
  resolveTypescriptConfigAsync,
  findTsConfig,
  clearTsConfigCache,
} from './TypeScriptConfigResolver';
