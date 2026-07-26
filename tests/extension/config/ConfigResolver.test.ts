// tests/extension/config/ConfigResolver.test.ts
// config file resolution determines what plugins can execute

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockConfigCache,
  mockErrorReporter,
} from '../../helpers/mock-services';

// mock file-system utilities
const {
  mockFindUp,
  mockCreateWorkspaceStopPredicate,
  mockReadJsonSync,
  mockWatchConfigCandidate,
} = vi.hoisted(() => ({
  mockFindUp: vi.fn(),
  mockCreateWorkspaceStopPredicate: vi.fn(() => () => false),
  mockReadJsonSync: vi.fn(),
  mockWatchConfigCandidate: vi.fn(),
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

import {
  resolveConfig,
} from '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver';

const configCache = mockConfigCache as typeof mockConfigCache & {
  watchConfigCandidate: typeof mockWatchConfigCandidate;
};
configCache.watchConfigCandidate = mockWatchConfigCandidate;

describe('ConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigCache.get.mockReturnValue(undefined);
    mockConfigCache.hasWatcher.mockReturnValue(false);
  });

  describe('resolveConfig()', () => {
    it('rejects schema-invalid config at the resolver boundary', () => {
      const configPath = '/workspace/.mdx-previewrc.json';
      mockFindUp.mockReturnValue(configPath);
      mockReadJsonSync.mockReturnValue({
        tailwind: { enabled: 'sometimes' },
      });

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockErrorReporter.reportConfigError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONFIG_VALIDATION_ERROR',
          configPath,
        }),
        configPath
      );
      expect(mockConfigCache.set).toHaveBeenCalledWith('/workspace', null);
      expect(mockConfigCache.watchConfigPath).not.toHaveBeenCalled();
      expect(mockWatchConfigCandidate).toHaveBeenCalledWith(
        configPath,
        expect.any(Object)
      );
    });

    it('returns null & caches when no config file found', () => {
      mockFindUp.mockReturnValue(undefined);

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockConfigCache.set).toHaveBeenCalledWith('/workspace', null);
    });

    it('returns parsed config when file found & valid', () => {
      mockFindUp.mockReturnValue('/workspace/.mdx-previewrc.json');
      mockReadJsonSync.mockReturnValue({ remarkPlugins: [] });

      const result = resolveConfig('/workspace/src/doc.mdx');

      expect(result).toEqual({
        config: { remarkPlugins: [] },
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
  });
});
