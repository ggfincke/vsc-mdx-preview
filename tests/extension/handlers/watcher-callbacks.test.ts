// tests/extension/handlers/watcher-callbacks.test.ts
// verify async file watcher callbacks are observed & reported

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { DependencyWatcher } from '../../../packages/extension-host/src/features/preview/watchers/DependencyWatcher';
import { getUnifiedResolver } from '../../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import { createFileWatcher } from '../../../packages/extension-host/src/shared/utils/createFileWatcher';
import { createTaggedLogger } from '../../../packages/extension-host/src/shared/logging/logger';
import { ErrorContext } from '../../../packages/extension-host/src/shared/errors';
import { ResolutionStrategy } from '../../../packages/extension-host/src/features/module-runtime/types/module-system';
import { mockErrorReporter } from '../../helpers/mock-services';
import type { TaggedLogger } from '@mdx-preview/contracts';

type TestFileSystemWatcher = vscode.FileSystemWatcher & {
  fireChange(uri: vscode.Uri): void;
  fireDelete(uri: vscode.Uri): void;
};

function createMockLogger(): TaggedLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('file watcher callback handling', () => {
  it('awaits & reports rejected async handlers', async () => {
    const logger = createMockLogger();
    vi.mocked(createTaggedLogger).mockReturnValue(logger);
    const failure = new Error('async watcher failure');
    const watcher = createFileWatcher({
      pattern: '/workspace/dependency.ts',
      onChange: async () => {
        await Promise.resolve();
        throw failure;
      },
    }) as TestFileSystemWatcher;

    watcher.fireChange(vscode.Uri.file('/workspace/dependency.ts'));

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Error in file changed handler',
        failure
      );
    });
    watcher.dispose();
  });

  it('reports rejected dependency refreshes through ErrorReporter', async () => {
    const logger = createMockLogger();
    vi.mocked(createTaggedLogger).mockReturnValue(logger);
    const workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-dependency-callback-'))
    );
    const dependencyPath = path.join(workspaceRoot, 'dependency.ts');
    fs.writeFileSync(dependencyPath, 'export const value = true;');
    vi.spyOn(getUnifiedResolver(), 'resolveSync').mockReturnValue({
      fsPath: dependencyPath,
      isBuiltInShim: false,
      specifier: './dependency',
      strategy: ResolutionStrategy.FileProbe,
    });
    const failure = new Error('dependency refresh failure');
    const onChange = vi.fn(async () => {
      await Promise.resolve();
      throw failure;
    });
    const fileWatcherSpy = vi.spyOn(
      vscode.workspace,
      'createFileSystemWatcher'
    );
    const dependencyWatcher = new DependencyWatcher(onChange);
    dependencyWatcher.setResolutionContext({
      baseDir: workspaceRoot,
      workspaceRoot,
    });
    await dependencyWatcher.start();
    dependencyWatcher.updateDependencies([
      {
        kind: 'import',
        runtimeRequest: './dependency',
        specifier: './dependency',
      },
    ]);
    const watcher = fileWatcherSpy.mock.results.at(-1)
      ?.value as TestFileSystemWatcher;

    watcher.fireDelete(vscode.Uri.file(dependencyPath));

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(dependencyPath);
      expect(mockErrorReporter.report).toHaveBeenCalledWith(failure, {
        context: ErrorContext.Extension,
        showNotification: false,
        metadata: {
          operation: 'dependency-watcher-refresh',
          fsPath: dependencyPath,
        },
      });
    });
    expect(logger.error).not.toHaveBeenCalled();
    dependencyWatcher.dispose();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });
});
