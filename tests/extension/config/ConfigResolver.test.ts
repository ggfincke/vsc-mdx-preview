// tests/extension/config/ConfigResolver.test.ts
// config file resolution — determines what plugins can execute

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockConfigCache,
  mockErrorReporter,
} from '../../helpers/mock-services';

// mock file-system & validation utilities (hoisted for vi.mock factory access)
const {
  mockFindUp,
  mockCreateWorkspaceStopPredicate,
  mockReadJsonSync,
  mockValidateConfigSchema,
} = vi.hoisted(() => ({
  mockFindUp: vi.fn(),
  mockCreateWorkspaceStopPredicate: vi.fn(() => () => false),
  mockReadJsonSync: vi.fn(),
  mockValidateConfigSchema: vi.fn(() => ({ errors: [] as string[] })),
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/find-up',
  () => ({
    findUp: mockFindUp,
    createWorkspaceStopPredicate: mockCreateWorkspaceStopPredicate,
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/file-utils',
  () => ({
    readJsonSync: mockReadJsonSync,
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/validation',
  () => ({
    validateConfigSchema: mockValidateConfigSchema,
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/errors',
  () => ({
    ConfigError: class ConfigError extends Error {
      constructor(
        message: string,
        public code: string,
        public configPath: string
      ) {
        super(message);
      }
    },
  })
);

import {
  resolveConfig,
  clearConfigCache,
  getConfigFileNames,
} from '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver';

describe('ConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigCache.get.mockReturnValue(undefined);
    mockConfigCache.hasWatcher.mockReturnValue(false);
  });

  describe('resolveConfig()', () => {
    it('returns cached result on cache hit', () => {
      const cached = {
        config: {},
        configPath: '/a/.mdx-previewrc.json',
        configDir: '/a',
      };
      mockConfigCache.get.mockReturnValue(cached);

      const result = resolveConfig('/a/doc.mdx');

      expect(result).toBe(cached);
      expect(mockFindUp).not.toHaveBeenCalled();
    });

    it('returns null & caches when no config file found', () => {
      mockFindUp.mockReturnValue(undefined);

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockConfigCache.set).toHaveBeenCalledWith('/workspace', null);
    });

    it('returns parsed config when file found & valid', () => {
      mockFindUp.mockReturnValue('/workspace/.mdx-previewrc.json');
      mockReadJsonSync.mockReturnValue({ plugins: { remark: [] } });
      mockValidateConfigSchema.mockReturnValue({ errors: [] });

      const result = resolveConfig('/workspace/src/doc.mdx');

      expect(result).toEqual({
        config: { plugins: { remark: [] } },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      });
      expect(mockConfigCache.set).toHaveBeenCalled();
    });

    it('returns null & reports error on JSON parse failure', () => {
      mockFindUp.mockReturnValue('/workspace/.mdx-previewrc.json');
      mockReadJsonSync.mockReturnValue(null);

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockErrorReporter.reportConfigError).toHaveBeenCalled();
    });

    it('returns null & reports error on validation failure', () => {
      mockFindUp.mockReturnValue('/workspace/.mdx-previewrc.json');
      mockReadJsonSync.mockReturnValue({ invalid: true });
      mockValidateConfigSchema.mockReturnValue({
        errors: ['unknown field: invalid'],
      });

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockErrorReporter.reportConfigError).toHaveBeenCalled();
    });
  });

  describe('getConfigFileNames()', () => {
    it('returns list of config file names', () => {
      const names = getConfigFileNames();

      expect(names).toContain('.mdx-previewrc.json');
      expect(names).toContain('.mdx-previewrc');
    });

    it('returns a copy (not the internal array)', () => {
      const a = getConfigFileNames();
      const b = getConfigFileNames();

      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('clearConfigCache()', () => {
    it('delegates to cache.clear()', () => {
      clearConfigCache();

      expect(mockConfigCache.clear).toHaveBeenCalled();
    });
  });
});
