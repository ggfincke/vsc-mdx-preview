// tests/extension/config/TypeScriptConfigResolver.test.ts
// tsconfig resolution, caching, & cache lifecycle

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockErrorReporter } from '../../helpers/mock-services';

// hoisted mocks for external dependencies
const mockParse = vi.hoisted(() => vi.fn());
const mockFindUp = vi.hoisted(() => vi.fn());
const mockPathCache = vi.hoisted(() => ({
  has: vi.fn(() => false),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
  hasWatcher: vi.fn(() => false),
  watchPath: vi.fn(),
  unwatchPath: vi.fn(),
}));
const MockPathCacheClass = vi.hoisted(() =>
  vi.fn(function () {
    return mockPathCache;
  })
);

vi.mock('tsconfck', () => ({
  parse: mockParse,
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/find-up',
  () => ({
    findUp: mockFindUp,
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/cache',
  () => ({
    PathCache: MockPathCacheClass,
  })
);

import {
  findTsConfig,
  resolveTypescriptConfigAsync,
} from '../../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver';

describe('TypeScriptConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathCache.has.mockReturnValue(false);
  });

  describe('findTsConfig()', () => {
    it('delegates to findUp w/ tsconfig.json', () => {
      mockFindUp.mockReturnValue('/workspace/tsconfig.json');

      const result = findTsConfig('/workspace/src');

      expect(mockFindUp).toHaveBeenCalledWith({
        filename: 'tsconfig.json',
        startDir: '/workspace/src',
      });
      expect(result).toBe('/workspace/tsconfig.json');
    });

    it('returns undefined when not found', () => {
      mockFindUp.mockReturnValue(undefined);

      const result = findTsConfig('/workspace/src');

      expect(result).toBeUndefined();
    });
  });

  describe('resolveTypescriptConfigAsync()', () => {

    it('parses tsconfig & extracts only baseUrl/paths/rootDir/configPath', async () => {
      mockParse.mockResolvedValue({
        tsconfig: {
          compilerOptions: {
            baseUrl: '.',
            paths: { '@/*': ['src/*'] },
            rootDir: 'src',
            target: 'ES2022',
            strict: true,
          },
        },
      });

      const result = await resolveTypescriptConfigAsync(
        '/workspace/tsconfig.json'
      );

      expect(result).toEqual({
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
        rootDir: 'src',
        configPath: '/workspace/tsconfig.json',
      });
      expect(mockPathCache.set).toHaveBeenCalledWith(
        '/workspace',
        result
      );
    });

    it('caches null & reports error on parse failure', async () => {
      const error = new Error('Parse failed');
      mockParse.mockRejectedValue(error);

      const result = await resolveTypescriptConfigAsync(
        '/workspace/tsconfig.json'
      );

      expect(result).toBeNull();
      expect(mockPathCache.set).toHaveBeenCalledWith('/workspace', null);
      expect(mockErrorReporter.reportSilent).toHaveBeenCalled();
    });
  });
});
