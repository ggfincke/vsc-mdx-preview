// tests/resolution/unified-resolver.test.ts
// verify representative module resolution strategy selection

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

const mockTypeScriptStrategy = {
  name: 'TypeScript',
  resolve: vi.fn(),
  resolveAsync: vi.fn(),
};
const mockEnhancedResolveStrategy = {
  name: 'EnhancedResolve',
  resolve: vi.fn(),
};
const mockFileProbeStrategy = {
  name: 'FileProbe',
  resolve: vi.fn(),
  resolveAsync: vi.fn(),
};

vi.mock(
  '../../packages/extension-host/src/features/module-runtime/resolution/strategies',
  () => ({
    getTypeScriptPathStrategy: () => mockTypeScriptStrategy,
    getEnhancedResolveStrategy: () => mockEnhancedResolveStrategy,
    getFileProbeStrategy: () => mockFileProbeStrategy,
  })
);

import {
  UnifiedResolver,
  getUnifiedResolver,
  resetUnifiedResolver,
} from '../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import { ResolutionStrategy } from '../../packages/extension-host/src/types';

describe('UnifiedResolver', () => {
  let resolver: UnifiedResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resetUnifiedResolver();
    resolver = getUnifiedResolver();
    mockTypeScriptStrategy.resolve.mockReturnValue(null);
    mockTypeScriptStrategy.resolveAsync.mockResolvedValue(null);
    mockEnhancedResolveStrategy.resolve.mockReturnValue(null);
    mockFileProbeStrategy.resolve.mockReturnValue(null);
    mockFileProbeStrategy.resolveAsync.mockResolvedValue(null);
  });

  it('resolves framework aliases to built-in shims first', () => {
    const result = resolver.resolveSync('@theme/Tabs', {
      baseDir: '/workspace/docs',
      workspaceRoot: '/workspace',
      framework: 'docusaurus' as const,
      shimsEnabled: true,
    });

    expect(result?.isBuiltInShim).toBe(true);
    expect(result?.fsPath).toContain('@mdx-preview/shims');
  });

  it('uses the TypeScript strategy for configured path aliases', async () => {
    mockTypeScriptStrategy.resolveAsync.mockResolvedValue({
      fsPath: '/workspace/src/utils/helpers.ts',
      specifier: '@utils/helpers',
      strategy: ResolutionStrategy.TypeScript,
      isBuiltInShim: false,
    });

    const result = await resolver.resolveAsync('@utils/helpers', {
      baseDir: '/workspace/src',
      workspaceRoot: '/workspace',
      tsConfig: {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: { '@utils/*': ['./src/utils/*'] },
      },
    });

    expect(result?.strategy).toBe(ResolutionStrategy.TypeScript);
    expect(mockTypeScriptStrategy.resolveAsync).toHaveBeenCalled();
  });

  it('falls back to enhanced-resolve for bare imports', async () => {
    mockEnhancedResolveStrategy.resolve.mockReturnValue({
      fsPath: '/workspace/node_modules/react/index.js',
      specifier: 'react',
      strategy: ResolutionStrategy.EnhancedResolve,
      isBuiltInShim: false,
    });

    const result = await resolver.resolveAsync('react', {
      baseDir: '/workspace/src',
      workspaceRoot: '/workspace',
      tsConfig: {
        configPath: '/workspace/tsconfig.json',
        baseUrl: '.',
        paths: {},
      },
    });

    expect(result?.strategy).toBe(ResolutionStrategy.EnhancedResolve);
    expect(mockEnhancedResolveStrategy.resolve).toHaveBeenCalled();
  });

  it('uses file-probe for relative imports', async () => {
    mockFileProbeStrategy.resolveAsync.mockResolvedValue({
      fsPath: '/workspace/src/components/Button.tsx',
      specifier: './components/Button',
      strategy: ResolutionStrategy.FileProbe,
      isBuiltInShim: false,
    });

    const result = await resolver.resolveAsync('./components/Button', {
      baseDir: '/workspace/src',
      workspaceRoot: '/workspace',
    });

    expect(result?.strategy).toBe(ResolutionStrategy.FileProbe);
    expect(mockFileProbeStrategy.resolveAsync).toHaveBeenCalled();
  });

  it('returns null when no strategy can resolve a specifier', async () => {
    const result = await resolver.resolveAsync('nonexistent-package', {
      baseDir: '/workspace/src',
      workspaceRoot: '/workspace',
    });

    expect(result).toBeNull();
  });

  it('short-circuits later strategies after an alias shim match', async () => {
    const result = await resolver.resolveAsync('@theme/Tabs', {
      baseDir: '/workspace/docs',
      workspaceRoot: '/workspace',
      framework: 'docusaurus' as const,
      shimsEnabled: true,
    });

    expect(result?.isBuiltInShim).toBe(true);
    expect(mockEnhancedResolveStrategy.resolve).not.toHaveBeenCalled();
    expect(mockFileProbeStrategy.resolveAsync).not.toHaveBeenCalled();
  });
});
