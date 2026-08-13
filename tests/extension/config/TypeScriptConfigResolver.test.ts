// tests/extension/config/TypeScriptConfigResolver.test.ts
// tsconfig recovery, extends tracking, & watcher ownership

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disposeConfigWatchers,
  findTsConfig,
  getTsConfigCandidatePaths,
  refreshWatchedTypeScriptConfigs,
  resolveTypescriptConfig,
  watchTypeScriptConfig,
} from '../../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver';
import type { TypeScriptConfiguration } from '../../../packages/extension-host/src/features/module-runtime/types/module-system';
import { mockErrorReporter } from '../../helpers/mock-services';

interface TestFileSystemWatcher extends vscode.FileSystemWatcher {
  fireChange(uri: vscode.Uri): void;
  fireCreate(uri: vscode.Uri): void;
  fireDelete(uri: vscode.Uri): void;
}

interface WatchRecord {
  active: boolean;
  filePath: string;
  watcher: TestFileSystemWatcher;
}

describe('TypeScriptConfigResolver', () => {
  let tempDir: string;
  let watchRecords: WatchRecord[];

  function writeFile(filePath: string, contents: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  function writeConfig(filePath: string, config: object): void {
    writeFile(filePath, JSON.stringify(config));
  }

  function getActiveWatcher(filePath: string): TestFileSystemWatcher {
    const resolvedPath = path.resolve(filePath);
    for (let index = watchRecords.length - 1; index >= 0; index -= 1) {
      const record = watchRecords[index];
      if (record.active && record.filePath === resolvedPath) {
        return record.watcher;
      }
    }
    throw new Error(`No active watcher for ${resolvedPath}`);
  }

  function getActiveWatcherCount(): number {
    return watchRecords.filter((record) => record.active).length;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-tsconfig-'));
    watchRecords = [];

    const createFileSystemWatcher =
      vscode.workspace.createFileSystemWatcher.bind(vscode.workspace);
    vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockImplementation(
      (pattern, ignoreCreate, ignoreChange, ignoreDelete) => {
        const watcher = createFileSystemWatcher(
          pattern,
          ignoreCreate,
          ignoreChange,
          ignoreDelete
        ) as TestFileSystemWatcher;
        const relativePattern = pattern as vscode.RelativePattern;
        const record: WatchRecord = {
          active: true,
          filePath: path.resolve(
            relativePattern.baseUri.fsPath,
            relativePattern.pattern
          ),
          watcher,
        };
        const dispose = watcher.dispose.bind(watcher);
        vi.spyOn(watcher, 'dispose').mockImplementation(() => {
          record.active = false;
          dispose();
        });
        watchRecords.push(record);
        return watcher;
      }
    );
  });

  afterEach(() => {
    disposeConfigWatchers();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('resolves options & reloads when an extended base changes', async () => {
    const documentPath = path.join(tempDir, 'site', 'doc.mdx');
    const configPath = path.join(tempDir, 'site', 'tsconfig.json');
    const basePath = path.join(tempDir, 'configs', 'base.json');
    writeConfig(configPath, { extends: '../configs/base.json' });
    writeConfig(basePath, { compilerOptions: { baseUrl: './one' } });

    let configuration = resolveTypescriptConfig(configPath);
    const onChange = vi.fn(() => {
      configuration = resolveTypescriptConfig(configPath);
    });
    const subscription = watchTypeScriptConfig(documentPath, onChange);

    expect(configuration?.baseUrl).toContain('one');
    const baseWatcher = getActiveWatcher(basePath);

    writeConfig(basePath, { compilerOptions: { baseUrl: './two' } });
    baseWatcher.fireChange(vscode.Uri.file(basePath));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(configuration?.baseUrl).toContain('two');

    subscription.dispose();
    expect(getActiveWatcherCount()).toBe(0);
  });

  it('recovers from initial absence & a malformed leaf repair', async () => {
    const documentPath = path.join(tempDir, 'site', 'doc.mdx');
    const configPath = path.join(tempDir, 'site', 'tsconfig.json');
    let configuration: TypeScriptConfiguration | null = null;
    const reload = vi.fn(() => {
      const activeConfig = findTsConfig(path.dirname(documentPath));
      configuration = resolveTypescriptConfig(activeConfig ?? null);
    });
    const subscription = watchTypeScriptConfig(documentPath, reload);
    const candidateWatcher = getActiveWatcher(configPath);

    writeFile(configPath, '"malformed config"');
    candidateWatcher.fireCreate(vscode.Uri.file(configPath));

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(configuration).toBeNull();
    expect(mockErrorReporter.reportSilent).toHaveBeenCalledTimes(1);

    writeConfig(configPath, { compilerOptions: { baseUrl: './src' } });
    candidateWatcher.fireChange(vscode.Uri.file(configPath));

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
    expect(configuration?.baseUrl).toBe('./src');

    subscription.dispose();
  });

  it('replaces leaf inputs & bounds watchers through delete/recreate churn', async () => {
    const documentPath = path.join(tempDir, 'site', 'docs', 'doc.mdx');
    const parentConfigPath = path.join(tempDir, 'site', 'tsconfig.json');
    const nestedConfigPath = path.join(
      tempDir,
      'site',
      'docs',
      'tsconfig.json'
    );
    const baseAPath = path.join(tempDir, 'site', 'configs', 'a.json');
    const baseBPath = path.join(tempDir, 'site', 'configs', 'b.json');
    writeConfig(parentConfigPath, { extends: './configs/a.json' });
    writeConfig(baseAPath, { compilerOptions: { baseUrl: './a' } });
    writeConfig(baseBPath, { compilerOptions: { baseUrl: './b' } });

    let configuration = resolveTypescriptConfig(parentConfigPath);
    const reload = vi.fn(() => {
      const activeConfig = findTsConfig(path.dirname(documentPath));
      configuration = resolveTypescriptConfig(activeConfig ?? null);
    });
    const subscription = watchTypeScriptConfig(documentPath, reload);
    const candidateWatcher = getActiveWatcher(nestedConfigPath);
    const expectedActiveCount =
      getTsConfigCandidatePaths(documentPath).length + 1;

    expect(getActiveWatcherCount()).toBe(expectedActiveCount);
    expect(configuration?.baseUrl).toContain('a');

    writeConfig(nestedConfigPath, { extends: '../configs/b.json' });
    candidateWatcher.fireCreate(vscode.Uri.file(nestedConfigPath));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    expect(configuration?.baseUrl).toContain('b');
    expect(getActiveWatcherCount()).toBe(expectedActiveCount);
    expect(() => getActiveWatcher(baseAPath)).toThrow();
    const baseBWatcher = getActiveWatcher(baseBPath);

    for (let index = 0; index < 4; index += 1) {
      fs.rmSync(baseBPath);
      baseBWatcher.fireDelete(vscode.Uri.file(baseBPath));
      await vi.waitFor(() =>
        expect(reload).toHaveBeenCalledTimes(index * 2 + 2)
      );
      expect(configuration).toBeNull();
      expect(getActiveWatcherCount()).toBe(expectedActiveCount);

      writeConfig(baseBPath, { compilerOptions: { baseUrl: './b' } });
      baseBWatcher.fireCreate(vscode.Uri.file(baseBPath));
      await vi.waitFor(() =>
        expect(reload).toHaveBeenCalledTimes(index * 2 + 3)
      );
      expect(configuration?.baseUrl).toContain('b');
      expect(getActiveWatcherCount()).toBe(expectedActiveCount);
    }

    fs.rmSync(nestedConfigPath);
    candidateWatcher.fireDelete(vscode.Uri.file(nestedConfigPath));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(10));

    expect(configuration?.baseUrl).toContain('a');
    expect(getActiveWatcherCount()).toBe(expectedActiveCount);
    expect(() => getActiveWatcher(baseBPath)).toThrow();
    expect(getActiveWatcher(baseAPath)).toBeDefined();

    subscription.dispose();
    expect(getActiveWatcherCount()).toBe(0);

    writeConfig(baseAPath, {
      compilerOptions: { baseUrl: './a-after-reopen' },
    });
    configuration = resolveTypescriptConfig(parentConfigPath);
    expect(configuration?.baseUrl).toContain('a-after-reopen');

    const reopenedSubscription = watchTypeScriptConfig(documentPath, vi.fn());
    expect(getActiveWatcherCount()).toBe(expectedActiveCount);
    reopenedSubscription.dispose();
    expect(getActiveWatcherCount()).toBe(0);
  });

  it('refreshes a package extends chain through install churn', () => {
    const documentPath = path.join(tempDir, 'site', 'doc.mdx');
    const configPath = path.join(tempDir, 'site', 'tsconfig.json');
    const packageDir = path.join(
      tempDir,
      'site',
      'node_modules',
      '@missing',
      'tsconfig-base'
    );
    const packageConfigPath = path.join(packageDir, 'tsconfig.json');
    writeConfig(configPath, { extends: '@missing/tsconfig-base' });

    let configuration = resolveTypescriptConfig(configPath);
    const reload = vi.fn(() => {
      configuration = resolveTypescriptConfig(configPath);
    });
    const subscription = watchTypeScriptConfig(documentPath, reload);
    const absentWatchCount = getActiveWatcherCount();
    const installPackage = (baseUrl: string) => {
      writeConfig(path.join(packageDir, 'package.json'), {
        name: '@missing/tsconfig-base',
        main: 'tsconfig.json',
      });
      writeConfig(packageConfigPath, {
        compilerOptions: { baseUrl },
      });
    };

    expect(configuration).toBeNull();

    installPackage('./one');
    refreshWatchedTypeScriptConfigs();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(configuration?.baseUrl).toContain('/one');
    const canonicalPackageConfigPath = fs.realpathSync(packageConfigPath);
    expect(getActiveWatcher(canonicalPackageConfigPath)).toBeDefined();
    const installedWatchCount = getActiveWatcherCount();
    expect(installedWatchCount).toBeGreaterThan(absentWatchCount);

    fs.rmSync(packageDir, { recursive: true });
    refreshWatchedTypeScriptConfigs();

    expect(reload).toHaveBeenCalledTimes(2);
    expect(configuration).toBeNull();
    expect(() => getActiveWatcher(canonicalPackageConfigPath)).toThrow();
    expect(getActiveWatcherCount()).toBe(absentWatchCount);

    installPackage('./two');
    refreshWatchedTypeScriptConfigs();

    expect(reload).toHaveBeenCalledTimes(3);
    expect(configuration?.baseUrl).toContain('/two');
    expect(getActiveWatcher(fs.realpathSync(packageConfigPath))).toBeDefined();
    expect(getActiveWatcherCount()).toBe(installedWatchCount);

    subscription.dispose();
    expect(getActiveWatcherCount()).toBe(0);
  });
});
