// tests/resolution/FileProbeStrategy.test.ts
// Regression tests for FileProbeStrategy - file probing for relative imports

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// Mock file-prober
const mockProbeModuleFile = vi.fn();
const mockProbeModuleFileAsync = vi.fn();
vi.mock('../../packages/extension/module-system/resolver/file-prober', () => ({
  probeModuleFile: (...args: unknown[]) => mockProbeModuleFile(...args),
  probeModuleFileAsync: (...args: unknown[]) =>
    mockProbeModuleFileAsync(...args),
}));

// Import after mocks
import {
  FileProbeStrategy,
  getFileProbeStrategy,
} from '../../packages/extension/module-system/resolver/strategies/FileProbeStrategy';
import { ResolutionStrategy } from '../../packages/extension/types';

describe('FileProbeStrategy', () => {
  let strategy: FileProbeStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new FileProbeStrategy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create resolution context
  const createContext = (baseDir: string) => ({
    baseDir,
    workspaceRoot: '/workspace',
  });

  // basic strategy behavior
  describe('basic strategy behavior', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('FileProbe');
    });
  });

  // synchronous resolution
  describe('resolve()', () => {
    it('should resolve relative path with extension probing', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue(
        '/workspace/src/components/Button.tsx'
      );

      const result = strategy.resolve(
        './components/Button',
        context,
        'dependency'
      );

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/components/Button.tsx');
      expect(result?.specifier).toBe('./components/Button');
      expect(result?.strategy).toBe(ResolutionStrategy.FileProbe);
    });

    it('should return null when file not found', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue(null);

      const result = strategy.resolve('./missing', context, 'dependency');

      expect(result).toBeNull();
    });

    it('should pass resolved absolute path to probeModuleFile', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue(null);

      strategy.resolve('./components/Button', context, 'dependency');

      expect(mockProbeModuleFile).toHaveBeenCalledWith(
        path.resolve('/workspace/src', './components/Button')
      );
    });

    it('should handle parent directory references', () => {
      const context = createContext('/workspace/src/pages');
      mockProbeModuleFile.mockReturnValue(
        '/workspace/src/components/Button.tsx'
      );

      const result = strategy.resolve(
        '../components/Button',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe('/workspace/src/components/Button.tsx');
      expect(mockProbeModuleFile).toHaveBeenCalledWith(
        path.resolve('/workspace/src/pages', '../components/Button')
      );
    });

    it('should handle deeply nested relative paths', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue(
        '/workspace/src/components/forms/inputs/TextInput.tsx'
      );

      const result = strategy.resolve(
        './components/forms/inputs/TextInput',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe(
        '/workspace/src/components/forms/inputs/TextInput.tsx'
      );
    });

    it('should handle different resolution modes', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue('/workspace/src/file.ts');

      // Mode is passed but FileProbeStrategy doesn't use it
      const result1 = strategy.resolve('./file', context, 'dependency');
      const result2 = strategy.resolve('./file', context, 'node');
      const result3 = strategy.resolve('./file', context, 'browser');

      expect(result1?.fsPath).toBe('/workspace/src/file.ts');
      expect(result2?.fsPath).toBe('/workspace/src/file.ts');
      expect(result3?.fsPath).toBe('/workspace/src/file.ts');
    });
  });

  // asynchronous resolution
  describe('resolveAsync()', () => {
    it('should resolve asynchronously', async () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFileAsync.mockResolvedValue(
        '/workspace/src/components/Button.tsx'
      );

      const result = await strategy.resolveAsync(
        './components/Button',
        context,
        'dependency'
      );

      expect(result).not.toBeNull();
      expect(result?.fsPath).toBe('/workspace/src/components/Button.tsx');
      expect(result?.strategy).toBe(ResolutionStrategy.FileProbe);
    });

    it('should return null asynchronously when file not found', async () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFileAsync.mockResolvedValue(null);

      const result = await strategy.resolveAsync(
        './missing',
        context,
        'dependency'
      );

      expect(result).toBeNull();
    });

    it('should pass resolved absolute path to probeModuleFileAsync', async () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFileAsync.mockResolvedValue(null);

      await strategy.resolveAsync('./components/Button', context, 'dependency');

      expect(mockProbeModuleFileAsync).toHaveBeenCalledWith(
        path.resolve('/workspace/src', './components/Button')
      );
    });

    it('should handle async errors gracefully', async () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFileAsync.mockRejectedValue(
        new Error('File system error')
      );

      await expect(
        strategy.resolveAsync('./file', context, 'dependency')
      ).rejects.toThrow('File system error');
    });
  });

  // result structure
  describe('result structure', () => {
    it('should return correct ResolutionResult structure', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue('/workspace/src/utils/helpers.ts');

      const result = strategy.resolve('./utils/helpers', context, 'dependency');

      expect(result).toEqual({
        fsPath: '/workspace/src/utils/helpers.ts',
        specifier: './utils/helpers',
        strategy: ResolutionStrategy.FileProbe,
        isBuiltInShim: false,
      });
    });

    it('should preserve original specifier in result', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue('/workspace/src/file.tsx');

      const result = strategy.resolve('./file', context, 'dependency');

      expect(result?.specifier).toBe('./file');
    });
  });

  // singleton behavior
  describe('singleton behavior', () => {
    it('getFileProbeStrategy should return same instance', () => {
      const instance1 = getFileProbeStrategy();
      const instance2 = getFileProbeStrategy();

      expect(instance1).toBe(instance2);
    });

    it('singleton should have correct name', () => {
      const instance = getFileProbeStrategy();
      expect(instance.name).toBe('FileProbe');
    });
  });

  // edge cases
  describe('edge cases', () => {
    it('should handle current directory specifier', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue('/workspace/src/index.ts');

      const result = strategy.resolve('.', context, 'dependency');

      expect(mockProbeModuleFile).toHaveBeenCalledWith(
        path.resolve('/workspace/src', '.')
      );
    });

    it('should handle specifier with extension', () => {
      const context = createContext('/workspace/src');
      mockProbeModuleFile.mockReturnValue('/workspace/src/file.ts');

      const result = strategy.resolve('./file.ts', context, 'dependency');

      expect(mockProbeModuleFile).toHaveBeenCalledWith(
        path.resolve('/workspace/src', './file.ts')
      );
    });

    it('should handle MDX file resolution', () => {
      const context = createContext('/workspace/docs');
      mockProbeModuleFile.mockReturnValue('/workspace/docs/guide.mdx');

      const result = strategy.resolve('./guide', context, 'dependency');

      expect(result?.fsPath).toBe('/workspace/docs/guide.mdx');
    });

    it('should handle complex relative paths', () => {
      const context = createContext('/workspace/src/features/auth');
      mockProbeModuleFile.mockReturnValue('/workspace/src/shared/utils.ts');

      const result = strategy.resolve(
        '../../shared/utils',
        context,
        'dependency'
      );

      expect(result?.fsPath).toBe('/workspace/src/shared/utils.ts');
      expect(mockProbeModuleFile).toHaveBeenCalledWith(
        path.resolve('/workspace/src/features/auth', '../../shared/utils')
      );
    });
  });
});
