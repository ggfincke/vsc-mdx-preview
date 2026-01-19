// packages/extension/module-system/resolver/strategies/index.ts
// Resolution strategy exports

export type { IResolutionStrategy } from './types';

export {
  FileProbeStrategy,
  getFileProbeStrategy,
} from './FileProbeStrategy';

export {
  TypeScriptPathStrategy,
  getTypeScriptPathStrategy,
} from './TypeScriptPathStrategy';

export {
  EnhancedResolveStrategy,
  getEnhancedResolveStrategy,
} from './EnhancedResolveStrategy';
