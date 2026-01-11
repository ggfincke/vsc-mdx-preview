// packages/extension/framework/index.ts
// * re-exports for framework module

export {
  FrameworkDetector,
  type Framework,
  type FrameworkInfo,
} from './FrameworkDetector';

export {
  getAliasesForFramework,
  resolveAlias,
  isBuiltInShim,
  parseShimPath,
  SHIM_PREFIX,
  type AliasConfig,
} from './alias-resolver';
