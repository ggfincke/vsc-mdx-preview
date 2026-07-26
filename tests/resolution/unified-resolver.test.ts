// tests/resolution/unified-resolver.test.ts
// verify representative module resolution strategy selection on a real filesystem

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UnifiedResolver,
  getUnifiedResolver,
  resetUnifiedResolver,
} from '../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import {
  buildIgnoredResolutionResult,
  isIgnoredResolution,
} from '../../packages/extension-host/src/features/module-runtime/resolution/resolution-builders';
import { invalidateResolution } from '../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory';
import { fetchLocal } from '../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal';
import { NOOP_MODULE } from '../../packages/extension-host/src/features/module-runtime/fetch/utils';
import {
  ResolutionStrategy,
  type ResolutionContext,
} from '../../packages/extension-host/src/types';

describe('UnifiedResolver', () => {
  let resolver: UnifiedResolver;
  let tempDir: string;
  let packageDir: string;

  function writeFixture(relativePath: string, contents: string): string {
    const fsPath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(fsPath), { recursive: true });
    fs.writeFileSync(fsPath, contents);
    return fsPath;
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

  beforeEach(() => {
    invalidateResolution();
    resetUnifiedResolver();
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-resolver-'))
    );
    packageDir = path.join(tempDir, 'node_modules', '@scope', 'pkg');

    writeFixture('src/lib/widget.ts', 'export const widget = true;');
    writeFixture(
      'node_modules/@scope/pkg/package.json',
      JSON.stringify({
        name: '@scope/pkg',
        main: 'node.js',
        browser: 'browser.js',
      })
    );
    writeFixture(
      'node_modules/@scope/pkg/browser.js',
      "module.exports = require('./child.js');"
    );
    writeFixture('node_modules/@scope/pkg/node.js', 'module.exports = "node";');
    writeFixture(
      'node_modules/@scope/pkg/child.js',
      'module.exports = "child";'
    );
    writeFixture(
      'node_modules/browser-disabled/package.json',
      JSON.stringify({
        name: 'browser-disabled',
        main: 'index.js',
        browser: { './server.js': false },
      })
    );
    writeFixture(
      'node_modules/browser-disabled/index.js',
      "module.exports = require('./server.js');"
    );
    writeFixture(
      'node_modules/browser-disabled/server.js',
      'module.exports = "server";'
    );
    setWorkspaceFolders(tempDir);
    resolver = getUnifiedResolver();
  });

  afterEach(() => {
    setWorkspaceFolders();
    invalidateResolution();
    resetUnifiedResolver();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves built-in shims and passes the document workspace root to fetches', async () => {
    const shim = resolver.resolveSync('@theme/Tabs', {
      baseDir: path.join(tempDir, 'docs'),
      workspaceRoot: tempDir,
      framework: 'docusaurus',
      shimsEnabled: true,
    });

    expect(shim?.isBuiltInShim).toBe(true);
    expect(shim?.fsPath).toContain('@mdx-preview/shims');

    const resolveSpy = vi
      .spyOn(resolver, 'resolveAsync')
      .mockResolvedValue(
        buildIgnoredResolutionResult(
          'workspace-root-check',
          ResolutionStrategy.EnhancedResolve
        )
      );
    const documentPath = writeFixture('docs/entry.mdx', '# Entry');

    await fetchLocal('workspace-root-check', true, documentPath, {
      entryFsDirectory: path.dirname(documentPath),
      dependentFsPaths: new Set<string>(),
      typescriptConfiguration: undefined,
      configuration: { updateMode: 'onSave' },
      doc: { uri: vscode.Uri.file(documentPath) },
      webviewHandle: {},
    } as never);

    expect(resolveSpy).toHaveBeenCalledWith(
      'workspace-root-check',
      expect.objectContaining({
        baseDir: path.dirname(documentPath),
        workspaceRoot: tempDir,
      }),
      'browser'
    );
  });

  it('runs real TypeScript-path and enhanced-resolve strategies in sequence', async () => {
    const context: ResolutionContext = {
      baseDir: path.join(tempDir, 'src'),
      workspaceRoot: tempDir,
      tsConfig: {
        configPath: path.join(tempDir, 'tsconfig.json'),
        baseUrl: '.',
        paths: { '@app/*': ['src/lib/*'] },
      },
    };

    const widget = await resolver.resolveAsync(
      '@app/widget',
      context,
      'browser'
    );
    const packageEntry = await resolver.resolveAsync(
      '@scope/pkg',
      context,
      'browser'
    );

    expect(widget).toEqual({
      fsPath: path.join(tempDir, 'src', 'lib', 'widget.ts'),
      specifier: '@app/widget',
      strategy: ResolutionStrategy.TypeScript,
      isBuiltInShim: false,
    });
    expect(packageEntry).toEqual({
      fsPath: path.join(packageDir, 'browser.js'),
      specifier: '@scope/pkg',
      strategy: ResolutionStrategy.EnhancedResolve,
      isBuiltInShim: false,
    });
  });

  it('uses enhanced-resolve for relative children inside node_modules', async () => {
    const result = await resolver.resolveAsync(
      './child.js',
      {
        baseDir: packageDir,
        workspaceRoot: tempDir,
      },
      'browser'
    );

    expect(result).toEqual({
      fsPath: path.join(packageDir, 'child.js'),
      specifier: './child.js',
      strategy: ResolutionStrategy.EnhancedResolve,
      isBuiltInShim: false,
    });
  });

  it('returns a noop fetch for browser-field false mappings', async () => {
    const disabledPackageDir = path.join(
      tempDir,
      'node_modules',
      'browser-disabled'
    );
    const context: ResolutionContext = {
      baseDir: disabledPackageDir,
      workspaceRoot: tempDir,
    };

    const resolution = await resolver.resolveAsync(
      './server.js',
      context,
      'browser'
    );
    const fetched = await fetchLocal(
      './server.js',
      false,
      path.join(disabledPackageDir, 'index.js'),
      {
        entryFsDirectory: path.join(tempDir, 'docs'),
        dependentFsPaths: new Set<string>(),
        typescriptConfiguration: undefined,
        configuration: { updateMode: 'onSave' },
        doc: { uri: vscode.Uri.file(path.join(tempDir, 'docs', 'entry.mdx')) },
        webviewHandle: {},
      } as never
    );

    expect(resolution).not.toBeNull();
    expect(resolution ? isIgnoredResolution(resolution) : false).toBe(true);
    expect(fetched).toEqual({
      fsPath: '/externalModules/./server.js',
      code: NOOP_MODULE,
      dependencies: [],
    });
  });

  it('supports general single-star mappings with longest-prefix precedence', async () => {
    const expectedPaths = [
      writeFixture('wildcard/plain.ts', 'export {};'),
      writeFixture('at/button.ts', 'export {};'),
      writeFixture('specific/widget/index.ts', 'export {};'),
      writeFixture('generated/core/entry.ts', 'export {};'),
      writeFixture('literal/entry.ts', 'export {};'),
    ];
    const context: ResolutionContext = {
      baseDir: tempDir,
      workspaceRoot: tempDir,
      tsConfig: {
        configPath: path.join(tempDir, 'tsconfig.json'),
        baseUrl: '.',
        paths: {
          '*': ['wildcard/*'],
          '@*': ['at/*'],
          '@feature/*': ['specific/*/index'],
          'pkg-*-runtime': ['generated/*/entry'],
          'literal-*': ['literal/entry'],
        },
      },
    };

    const results = await Promise.all(
      [
        'plain',
        '@button',
        '@feature/widget',
        'pkg-core-runtime',
        'literal-any',
      ].map((specifier) => resolver.resolveAsync(specifier, context, 'browser'))
    );

    expect(results.map((result) => result?.fsPath)).toEqual(expectedPaths);
    expect(
      results.every(
        (result) => result?.strategy === ResolutionStrategy.TypeScript
      )
    ).toBe(true);
  });

  it('keeps node_modules-like workspace paths on file probing', async () => {
    const baseDir = path.join(tempDir, 'node_modules-tools');
    const expectedPath = writeFixture(
      'node_modules-tools/widget.ts',
      'export {};'
    );

    const result = await resolver.resolveAsync('./widget', {
      baseDir,
      workspaceRoot: tempDir,
    });
    const missing = await resolver.resolveAsync('missing-package', {
      baseDir: tempDir,
      workspaceRoot: tempDir,
    });

    expect(result).toEqual({
      fsPath: expectedPath,
      specifier: './widget',
      strategy: ResolutionStrategy.FileProbe,
      isBuiltInShim: false,
    });
    expect(missing).toBeNull();
  });
});
