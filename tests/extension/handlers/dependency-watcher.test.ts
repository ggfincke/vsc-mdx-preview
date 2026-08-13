// tests/extension/handlers/dependency-watcher.test.ts
// verify canonical dependency watcher resolution & lifecycle ownership

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ModuleDependency } from '@mdx-preview/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Preview } from '../../../packages/extension-host/src/features/preview/Preview';
import { PreviewDocumentHandler } from '../../../packages/extension-host/src/features/preview/PreviewDocumentHandler';
import { DependencyWatcher } from '../../../packages/extension-host/src/features/preview/watchers/DependencyWatcher';
import { WatcherManager } from '../../../packages/extension-host/src/features/preview/watchers/WatcherManager';
import { getFileProbeCandidatePaths } from '../../../packages/extension-host/src/features/module-runtime/resolution/file-prober';
import { invalidateResolution } from '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory';
import {
  getUnifiedResolver,
  resetUnifiedResolver,
} from '../../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import { createExactFileWatcherPattern } from '../../../packages/extension-host/src/shared/utils/createFileWatcher';
import { DEP_WATCHER_MAX_ENTRIES } from '../../../packages/extension-host/src/shared/constants';
import { mockFrameworkDetector } from '../../helpers/mock-services';

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver',
  () => ({ resolveConfig: vi.fn(() => null) })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/TypeScriptConfigResolver',
  () => ({
    findTsConfig: vi.fn(() => undefined),
    resolveTypescriptConfig: vi.fn(() => null),
  })
);

type TestFileSystemWatcher = vscode.FileSystemWatcher & {
  fireChange(uri: vscode.Uri): void;
  fireCreate(uri: vscode.Uri): void;
  fireDelete(uri: vscode.Uri): void;
};

function dependency(
  specifier: string,
  kind: ModuleDependency['kind'] = 'import'
): ModuleDependency {
  return { kind, runtimeRequest: specifier, specifier };
}

function setWorkspaceFolders(...roots: string[]): void {
  const folders = vscode.workspace.workspaceFolders as unknown as Array<{
    uri: vscode.Uri;
  }>;
  folders.splice(
    0,
    folders.length,
    ...roots.map((root) => ({ uri: vscode.Uri.file(root) }))
  );
}

function getExactWatcher(
  spy: ReturnType<typeof vi.spyOn>,
  fsPath: string
): TestFileSystemWatcher {
  const expected = createExactFileWatcherPattern(fsPath);
  const callIndex = spy.mock.calls.findLastIndex(([pattern]) => {
    const relativePattern = pattern as vscode.RelativePattern;
    return (
      relativePattern.baseUri.fsPath === expected.baseUri.fsPath &&
      relativePattern.pattern === expected.pattern
    );
  });

  return spy.mock.results[callIndex]?.value as TestFileSystemWatcher;
}

function countExactWatchers(
  spy: ReturnType<typeof vi.spyOn>,
  fsPath: string
): number {
  const expected = createExactFileWatcherPattern(fsPath);
  return spy.mock.calls.filter(([pattern]) => {
    const relativePattern = pattern as vscode.RelativePattern;
    return (
      relativePattern.baseUri.fsPath === expected.baseUri.fsPath &&
      relativePattern.pattern === expected.pattern
    );
  }).length;
}

describe('DependencyWatcher', () => {
  let workspaceRoot: string;
  let outsideRoot: string;
  let documentDir: string;

  function writeFixture(
    root: string,
    relativePath: string,
    contents = ''
  ): string {
    const fsPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fsPath), { recursive: true });
    fs.writeFileSync(fsPath, contents);
    return fsPath;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateResolution();
    resetUnifiedResolver();
    workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-dependency-watcher-'))
    );
    outsideRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-dependency-outside-'))
    );
    documentDir = path.join(workspaceRoot, 'docs');
    fs.mkdirSync(documentDir, { recursive: true });
    setWorkspaceFolders(workspaceRoot);
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'generic',
      confidence: 1,
    });
    mockFrameworkDetector.areShimsEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    setWorkspaceFolders();
    vi.restoreAllMocks();
    invalidateResolution();
    resetUnifiedResolver();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  });

  it('watches TS aliases & baseUrl files but excludes non-local results', () => {
    const aliasPath = writeFixture(
      workspaceRoot,
      'src/Alias.ts',
      'export const alias = true;'
    );
    const baseUrlPath = writeFixture(
      workspaceRoot,
      'Base.ts',
      'export const base = true;'
    );
    writeFixture(
      workspaceRoot,
      'node_modules/pkg/package.json',
      JSON.stringify({ name: 'pkg', main: 'index.js' })
    );
    writeFixture(
      workspaceRoot,
      'node_modules/pkg/index.js',
      'module.exports=1;'
    );
    const workspacePackagePath = writeFixture(
      workspaceRoot,
      'packages/workspace-package/index.js',
      'module.exports=2;'
    );
    writeFixture(
      workspaceRoot,
      'packages/workspace-package/package.json',
      JSON.stringify({ name: '@workspace/package', main: 'index.js' })
    );
    fs.mkdirSync(path.join(workspaceRoot, 'node_modules', '@workspace'), {
      recursive: true,
    });
    fs.symlinkSync(
      path.join(workspaceRoot, 'packages', 'workspace-package'),
      path.join(workspaceRoot, 'node_modules', '@workspace', 'package'),
      'dir'
    );
    const outsidePath = writeFixture(
      outsideRoot,
      'outside.ts',
      'export const outside = true;'
    );
    const outsideRequest = path
      .relative(documentDir, outsidePath)
      .replace(/\\/g, '/');
    const watcher = new DependencyWatcher(vi.fn());
    watcher.setResolutionContext({
      baseDir: documentDir,
      workspaceRoot,
      framework: 'docusaurus',
      shimsEnabled: true,
      tsConfig: {
        configPath: path.join(workspaceRoot, 'tsconfig.json'),
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
    });
    const resolveSpy = vi.spyOn(getUnifiedResolver(), 'resolveSync');

    watcher.updateDependencies(
      [
        '@/Alias',
        'Base',
        'pkg',
        '@workspace/package',
        outsideRequest,
        '@theme/Tabs',
        'node:fs',
      ].map((specifier) => dependency(specifier))
    );

    expect(watcher.getWatchedFsPaths().sort()).toEqual(
      [
        fs.realpathSync(aliasPath),
        fs.realpathSync(baseUrlPath),
        fs.realpathSync(workspacePackagePath),
      ].sort()
    );
    expect(watcher.getOwnedFsPaths()).toContain(
      fs.realpathSync(workspacePackagePath)
    );
    expect(resolveSpy).toHaveBeenCalledWith(
      '@/Alias',
      expect.objectContaining({ dependencyKind: 'import' }),
      'dependency'
    );
    watcher.dispose();
  });

  it('retains every missing exact candidate & recovers after creation', async () => {
    const pageDir = path.join(documentDir, 'pages');
    fs.mkdirSync(pageDir, { recursive: true });
    fs.symlinkSync(outsideRoot, path.join(documentDir, 'linked'), 'dir');
    const onChange = vi.fn();
    const createWatcherSpy = vi.spyOn(
      vscode.workspace,
      'createFileSystemWatcher'
    );
    const watcher = new DependencyWatcher(onChange);
    watcher.setResolutionContext({ baseDir: documentDir, workspaceRoot });

    watcher.updateDependencies(
      ['./missing', './pages/[slug]', './linked/escape'].map((specifier) =>
        dependency(specifier)
      )
    );

    const missingBase = path.join(documentDir, 'missing');
    const slugBase = path.join(pageDir, '[slug]');
    const flattenCandidates = (basePath: string) => {
      const candidates = getFileProbeCandidatePaths(basePath);
      return [...candidates.exactAndExtensionPaths, ...candidates.indexPaths];
    };
    expect(watcher.getWatchedFsPaths().sort()).toEqual(
      [...flattenCandidates(missingBase), ...flattenCandidates(slugBase)].sort()
    );
    expect(watcher.getWatchedFsPaths()).toContain(`${missingBase}.json`);
    expect(watcher.getWatchedFsPaths()).toContain(
      path.join(missingBase, 'index.json')
    );
    const slugPattern = createExactFileWatcherPattern(`${slugBase}.tsx`);
    expect(slugPattern.pattern).toBe('[[]slug[]].tsx');
    expect(getExactWatcher(createWatcherSpy, `${slugBase}.tsx`)).toBeDefined();

    const createdPath = `${missingBase}.ts`;
    const createdWatcher = getExactWatcher(createWatcherSpy, createdPath);
    fs.writeFileSync(createdPath, 'export const created = true;');
    createdWatcher.fireCreate(vscode.Uri.file(createdPath));
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(createdPath);
    });

    watcher.updateDependencies([dependency('./missing')]);
    expect(watcher.getWatchedFsPaths()).toEqual([fs.realpathSync(createdPath)]);
    watcher.dispose();
  });

  it('keeps present watchers across delete/recreate & prunes graph removal', async () => {
    const presentPath = writeFixture(
      documentDir,
      'present.ts',
      'export const present = true;'
    );
    const onChange = vi.fn();
    const createWatcherSpy = vi.spyOn(
      vscode.workspace,
      'createFileSystemWatcher'
    );
    const watcher = new DependencyWatcher(onChange);
    watcher.setResolutionContext({ baseDir: documentDir, workspaceRoot });
    watcher.updateDependencies([dependency('./present')]);
    const exactWatcher = getExactWatcher(createWatcherSpy, presentPath);
    const disposeSpy = vi.spyOn(exactWatcher, 'dispose');

    fs.rmSync(presentPath);
    exactWatcher.fireDelete(vscode.Uri.file(presentPath));
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    watcher.updateDependencies([dependency('./present')]);
    expect(getExactWatcher(createWatcherSpy, presentPath)).toBe(exactWatcher);
    expect(countExactWatchers(createWatcherSpy, presentPath)).toBe(1);
    expect(disposeSpy).not.toHaveBeenCalled();

    fs.writeFileSync(presentPath, 'export const recreated = true;');
    exactWatcher.fireCreate(vscode.Uri.file(presentPath));
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(2);
    });
    watcher.updateDependencies([dependency('./present')]);
    expect(getExactWatcher(createWatcherSpy, presentPath)).toBe(exactWatcher);
    expect(countExactWatchers(createWatcherSpy, presentPath)).toBe(1);
    expect(disposeSpy).not.toHaveBeenCalled();
    watcher.updateDependencies([]);

    expect(watcher.getWatchedFsPaths()).toEqual([]);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it('owns full dependency transactions while bounding exact watchers', async () => {
    const entryPath = writeFixture(documentDir, 'entry.mdx', '# Entry');
    const bridgePath = writeFixture(
      documentDir,
      'bridge.ts',
      "import './main.scss'; import './other.scss';"
    );
    const mainPath = writeFixture(documentDir, 'main.scss', '@use "partial";');
    const otherPath = writeFixture(
      documentDir,
      'other.scss',
      '@use "partial";'
    );
    const partialPath = writeFixture(documentDir, '_partial.scss', '$x: red;');
    const stalePath = writeFixture(
      documentDir,
      'stale.scss',
      '.stale { color: red; }'
    );
    const dependencyWatcher = new DependencyWatcher(vi.fn());
    const watcherManager = new WatcherManager();
    watcherManager.register('dependency', dependencyWatcher);
    const handler = new PreviewDocumentHandler();
    const webviewInvalidate = vi.fn(async () => {});
    const previewHarness = {
      documentHandler: handler,
      watcherManager,
      webviewBridge: { invalidate: webviewInvalidate },
    };
    const invalidateDependency = (
      Preview.prototype as unknown as {
        invalidateDependency(
          this: typeof previewHarness,
          fsPath: string
        ): Promise<void>;
      }
    ).invalidateDependency;
    const invalidate = vi.fn((fsPath: string) =>
      invalidateDependency.call(previewHarness, fsPath)
    );
    const markStale = vi.fn();
    const debouncedUpdate = vi.fn();
    const updateWebview = vi.fn(async () => {});
    handler.setActions({
      invalidate,
      markStale,
      debouncedUpdate,
      updateWebview,
    });
    const document = {
      uri: vscode.Uri.file(entryPath),
      getText: () => '# Entry',
    } as vscode.TextDocument;
    handler.setDoc(document, watcherManager);
    handler.updateDependencies([dependency('./bridge.ts')], watcherManager);
    const generation = handler.getDependencyGeneration(watcherManager);
    handler.commitModuleDependencySnapshot(
      bridgePath,
      [
        dependency('./main.scss'),
        dependency('./other.scss'),
        dependency('./missing-child'),
      ],
      undefined,
      watcherManager,
      generation
    );
    handler.commitModuleDependencySnapshot(
      mainPath,
      [],
      [partialPath],
      watcherManager
    );
    handler.commitModuleDependencySnapshot(
      otherPath,
      [],
      [partialPath],
      watcherManager
    );
    handler.commitModuleDependencySnapshot(
      bridgePath,
      [dependency('./stale.scss')],
      [stalePath],
      watcherManager,
      generation
    );

    expect([...handler.dependentFsPaths]).toEqual(
      expect.arrayContaining([
        entryPath,
        bridgePath,
        mainPath,
        otherPath,
        partialPath,
      ])
    );
    expect(handler.dependentFsPaths).toContain(
      path.join(documentDir, 'missing-child.json')
    );
    expect(handler.dependentFsPaths).toContain(
      path.join(documentDir, 'missing-child', 'index.json')
    );
    expect(handler.dependentFsPaths).not.toContain(stalePath);
    expect(
      handler.getDependencyInvalidationPaths(partialPath, watcherManager).sort()
    ).toEqual([partialPath, mainPath, otherPath].sort());
    await handler.handleDidChangeTextDocument(
      partialPath,
      document,
      true,
      'onType'
    );
    expect(invalidate).toHaveBeenCalledWith(partialPath);
    expect(
      webviewInvalidate.mock.calls.map(([fsPath]) => fsPath).sort()
    ).toEqual([partialPath, mainPath, otherPath].sort());
    expect(markStale).toHaveBeenCalledTimes(1);
    expect(debouncedUpdate).toHaveBeenCalledTimes(1);

    webviewInvalidate.mockClear();
    await invalidateDependency.call(previewHarness, partialPath);
    expect(
      webviewInvalidate.mock.calls.map(([fsPath]) => fsPath).sort()
    ).toEqual([partialPath, mainPath, otherPath].sort());

    handler.updateDependencies([dependency('./bridge.ts')], watcherManager);
    expect(handler.dependentFsPaths).toContain(partialPath);
    handler.commitModuleDependencySnapshot(
      bridgePath,
      [dependency('./stale.scss')],
      undefined,
      watcherManager,
      generation
    );
    expect(handler.dependentFsPaths).not.toContain(stalePath);
    expect(handler.dependentFsPaths).toContain(mainPath);
    handler.commitModuleDependencySnapshot(mainPath, [], [], watcherManager);
    expect(handler.dependentFsPaths).toContain(partialPath);
    handler.commitModuleDependencySnapshot(otherPath, [], [], watcherManager);
    expect(handler.dependentFsPaths).not.toContain(partialPath);

    handler.updateDependencies([dependency('./bridge.ts')], watcherManager);
    handler.commitModuleDependencySnapshot(
      mainPath,
      [],
      [partialPath],
      watcherManager
    );
    expect(handler.dependentFsPaths).toContain(partialPath);
    handler.updateDependencies([], watcherManager);
    expect(handler.dependentFsPaths).toEqual(new Set([entryPath]));
    expect(dependencyWatcher.getWatchedFsPaths()).toEqual([]);

    const transitivePaths = Array.from(
      { length: DEP_WATCHER_MAX_ENTRIES + 1 },
      (_, index) =>
        writeFixture(
          documentDir,
          `bounded/dependency-${index}.ts`,
          `export const value = ${index};`
        )
    );
    const transitiveLeafPath = writeFixture(
      documentDir,
      'bounded/transitive-leaf.ts',
      'export const leaf = true;'
    );
    handler.updateDependencies([dependency('./bridge.ts')], watcherManager);
    const transitiveGeneration =
      handler.getDependencyGeneration(watcherManager);
    handler.commitModuleDependencySnapshot(
      bridgePath,
      transitivePaths.map((fsPath) =>
        dependency(
          `./${path.relative(documentDir, fsPath).replace(/\\/g, '/')}`
        )
      ),
      undefined,
      watcherManager,
      transitiveGeneration
    );
    for (const [index, fsPath] of transitivePaths.entries()) {
      handler.commitModuleDependencySnapshot(
        fsPath,
        index === transitivePaths.length - 1
          ? [dependency('./transitive-leaf.ts')]
          : [],
        undefined,
        watcherManager,
        transitiveGeneration
      );
    }

    expect(dependencyWatcher.getWatchedFsPaths()).toHaveLength(
      DEP_WATCHER_MAX_ENTRIES
    );
    expect(handler.dependentFsPaths).toEqual(
      new Set([entryPath, bridgePath, ...transitivePaths, transitiveLeafPath])
    );
    const unwatchedDependency = transitivePaths.at(-1)!;
    expect(dependencyWatcher.getWatchedFsPaths()).not.toContain(
      unwatchedDependency
    );

    invalidate.mockClear();
    markStale.mockClear();
    debouncedUpdate.mockClear();
    updateWebview.mockClear();
    await handler.handleDidChangeTextDocument(
      unwatchedDependency,
      document,
      true,
      'onType'
    );
    expect(invalidate).toHaveBeenCalledWith(unwatchedDependency);
    expect(markStale).toHaveBeenCalledTimes(1);
    expect(debouncedUpdate).toHaveBeenCalledTimes(1);

    await handler.handleDidSaveTextDocument(
      unwatchedDependency,
      true,
      'onSave'
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(updateWebview).toHaveBeenCalledTimes(1);

    handler.updateDependencies([], watcherManager);
    expect(handler.dependentFsPaths).toEqual(new Set([entryPath]));
    expect(dependencyWatcher.getWatchedFsPaths()).toEqual([]);
    watcherManager.dispose();
  });
});
