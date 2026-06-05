// tests/resolution/cache-invalidation.test.ts
// prove resolver cache invalidation gap (MR-1): clearResolverCache leaves
// statCache + compiledIndexCache stale; invalidateResolution clears them

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import {
  clearResolverCache,
  invalidateResolution,
} from '../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory';
import {
  setCachedStat,
  getCachedStat,
  clearStatCache,
} from '../../packages/extension-host/src/features/module-runtime/resolution/file-prober';
import {
  getResolutionCandidates,
  clearCompiledIndexCache,
  getCompiledIndexCacheSize,
} from '../../packages/extension-host/src/features/module-runtime/resolution/strategies/TypeScriptPathStrategy';

const STAT_PATH = '/workspace/src/stale-dep/index.ts';

// seed compiledIndexCache by running a tsconfig-paths resolution
function seedCompiledIndexCache(): void {
  getResolutionCandidates('@utils/helpers', {
    baseDir: '/workspace/src',
    workspaceRoot: '/workspace',
    tsConfig: {
      configPath: '/workspace/tsconfig.json',
      baseUrl: '.',
      paths: { '@utils/*': ['./src/utils/*'] },
    },
  });
}

describe('resolution cache invalidation (MR-1)', () => {
  beforeEach(() => {
    clearStatCache();
    clearCompiledIndexCache();
  });

  it('statCache survives clearResolverCache but is cleared by invalidateResolution', () => {
    setCachedStat(STAT_PATH, { isFile: () => true, isDirectory: () => false } as never);
    expect(getCachedStat(STAT_PATH)).not.toBeNull();

    // bug: clearResolverCache does NOT clear statCache
    clearResolverCache();
    expect(getCachedStat(STAT_PATH)).not.toBeNull();

    // fix: invalidateResolution clears statCache
    invalidateResolution();
    expect(getCachedStat(STAT_PATH)).toBeNull();
  });

  it('compiledIndexCache survives clearResolverCache but is cleared by invalidateResolution', () => {
    seedCompiledIndexCache();
    expect(getCompiledIndexCacheSize()).toBeGreaterThan(0);

    // bug: clearResolverCache does NOT clear compiledIndexCache
    clearResolverCache();
    expect(getCompiledIndexCacheSize()).toBeGreaterThan(0);

    // fix: invalidateResolution clears compiledIndexCache
    invalidateResolution();
    expect(getCompiledIndexCacheSize()).toBe(0);
  });
});
