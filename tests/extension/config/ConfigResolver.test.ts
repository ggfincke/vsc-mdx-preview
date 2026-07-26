// tests/extension/config/ConfigResolver.test.ts
// config file resolution determines what plugins can execute

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as vscode from 'vscode';
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

vi.mock('../../../packages/extension-host/src/shared/utils/find-up', () => ({
  findUp: mockFindUp,
  createWorkspaceStopPredicate: mockCreateWorkspaceStopPredicate,
}));

vi.mock('../../../packages/extension-host/src/shared/utils/file-utils', () => ({
  readJsonSync: mockReadJsonSync,
}));

import {
  getConfigCandidatePaths,
  resolveConfig,
  watchConfigCandidates,
} from '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver';
import { ConfigCache } from '../../../packages/extension-host/src/shared/config/ConfigCache';

const configCache = mockConfigCache as typeof mockConfigCache & {
  watchConfigCandidate: typeof mockWatchConfigCandidate;
};
configCache.watchConfigCandidate = mockWatchConfigCandidate.mockImplementation(
  () => ({ dispose: vi.fn() })
);

describe('ConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWorkspaceStopPredicate.mockReturnValue(() => false);
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
      expect(mockWatchConfigCandidate).not.toHaveBeenCalled();
    });

    it('returns null & caches when no config file found', () => {
      mockCreateWorkspaceStopPredicate.mockReturnValue(
        (dir: string) => dir === '/workspace'
      );
      mockFindUp.mockReturnValue(undefined);

      expect(getConfigCandidatePaths('/workspace/docs/doc.mdx')).toEqual([
        '/workspace/docs/.mdx-previewrc.json',
        '/workspace/docs/.mdx-previewrc',
        '/workspace/.mdx-previewrc.json',
        '/workspace/.mdx-previewrc',
      ]);

      const result = resolveConfig('/workspace/doc.mdx');

      expect(result).toBeNull();
      expect(mockConfigCache.set).toHaveBeenCalledWith('/workspace', null);

      const watcherDispose = vi.fn();
      vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
        onDidChange: vi.fn(),
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        dispose: watcherDispose,
      } as never);
      const actualCache = ConfigCache.getInstance();
      for (let index = 0; index < 125; index += 1) {
        actualCache.set(`/workspace/docs-${index}`, null);
      }
      const candidateDir = path.join(
        path.parse(process.cwd()).root,
        'workspace',
        'site[one]'
      );
      const candidatePath = [
        candidateDir,
        'nested',
        '..',
        '.mdx-previewrc.json',
      ].join(path.sep);
      const first = actualCache.watchConfigCandidate(candidatePath, {
        onCreate: vi.fn(),
      });
      const second = actualCache.watchConfigCandidate(
        path.join(candidateDir, '.mdx-previewrc.json'),
        { onCreate: vi.fn() }
      );
      const watcherPattern = vi.mocked(vscode.workspace.createFileSystemWatcher)
        .mock.calls[0][0] as vscode.RelativePattern;

      expect(actualCache.entryCount).toBe(100);
      expect(actualCache.get('/workspace/docs-0')).toBeUndefined();
      expect(actualCache.retainedConfigPathCount).toBe(1);
      expect(actualCache.watcherCount).toBe(1);
      expect(watcherPattern).toBeInstanceOf(vscode.RelativePattern);
      expect(watcherPattern.baseUri.fsPath).toBe(candidateDir);
      expect(watcherPattern.pattern).toBe('.mdx-previewrc.json');
      first.dispose();
      expect(watcherDispose).not.toHaveBeenCalled();
      second.dispose();
      second.dispose();
      expect(watcherDispose).toHaveBeenCalledTimes(1);
      actualCache.dispose();
    });

    it('returns parsed config when file found & valid', () => {
      mockCreateWorkspaceStopPredicate.mockReturnValue(
        (dir: string) => dir === '/workspace'
      );
      mockFindUp.mockReturnValue('/workspace/.mdx-previewrc.json');
      mockReadJsonSync.mockReturnValue({ remarkPlugins: [] });

      const result = resolveConfig('/workspace/src/doc.mdx');
      const watch = watchConfigCandidates('/workspace/src/doc.mdx');

      expect(result).toEqual({
        config: { remarkPlugins: [] },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      });
      expect(mockConfigCache.set).toHaveBeenCalled();
      expect(
        mockWatchConfigCandidate.mock.calls.map(([filePath]) => filePath)
      ).toEqual([
        '/workspace/src/.mdx-previewrc.json',
        '/workspace/src/.mdx-previewrc',
        '/workspace/.mdx-previewrc.json',
        '/workspace/.mdx-previewrc',
      ]);

      watch.dispose();
      for (const disposable of mockWatchConfigCandidate.mock.results) {
        expect(disposable.value.dispose).toHaveBeenCalledTimes(1);
      }
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
