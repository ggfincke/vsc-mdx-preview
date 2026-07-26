// tests/resolution/unified-resolver.test.ts
// verify representative module resolution strategy selection on a real filesystem

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureRuntime, loadModule, registry } from 'mdx-forge/browser';
import {
  UnifiedResolver,
  getUnifiedResolver,
  resetUnifiedResolver,
} from '../../packages/extension-host/src/features/module-runtime/resolution/UnifiedResolver';
import {
  buildIgnoredResolutionResult,
  isIgnoredResolution,
} from '../../packages/extension-host/src/features/module-runtime/resolution/resolution-builders';
import {
  cachedFs,
  invalidateResolution,
} from '../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory';
import { fetchLocal } from '../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal';
import { NOOP_MODULE } from '../../packages/extension-host/src/features/module-runtime/fetch/utils';
import { getScriptHandler } from '../../packages/extension-host/src/features/module-runtime/handlers';
import { createImportRuntimeRequest } from '../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor';
import {
  ResolutionStrategy,
  type ResolutionContext,
} from '../../packages/extension-host/src/features/module-runtime/types/module-system';

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
      'node_modules/@scope/pkg/dynamic.js',
      "module.exports.load = () => import('./dynamic-child.js');"
    );
    writeFixture(
      'node_modules/@scope/pkg/dynamic-child.js',
      'module.exports = "dynamic-child";'
    );
    writeFixture(
      'node_modules/@scope/pkg/computed.js',
      'module.exports.load = (specifier) => import(specifier);'
    );
    writeFixture(
      'node_modules/@scope/pkg/mixed.js',
      [
        "module.exports.loadLiteral = () => import('./dynamic-child.js');",
        'module.exports.loadComputed = (specifier) => import(specifier);',
      ].join('\n')
    );
    writeFixture(
      'node_modules/conditional-package/package.json',
      JSON.stringify({
        name: 'conditional-package',
        exports: {
          '.': {
            browser: {
              import: './browser-import.js',
              require: './browser-require.cjs',
            },
            node: {
              import: './node-import.js',
              require: './node-require.cjs',
            },
            default: './default.js',
          },
        },
      })
    );
    writeFixture(
      'node_modules/conditional-package/browser-import.js',
      'export const value = "browser-import";'
    );
    writeFixture(
      'node_modules/conditional-package/browser-require.cjs',
      'module.exports = { value: "browser-require" };'
    );
    writeFixture(
      'node_modules/conditional-package/node-import.js',
      'export const value = "node-import";'
    );
    writeFixture(
      'node_modules/conditional-package/node-require.cjs',
      'module.exports = { value: "node-require" };'
    );
    writeFixture(
      'node_modules/conditional-package/default.js',
      'module.exports = { value: "default" };'
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
    vi.restoreAllMocks();
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
    const statSyncSpy = vi
      .spyOn(cachedFs, 'statSync')
      .mockImplementation(() => {
        throw new Error('sync filesystem path used');
      });
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
    expect(statSyncSpy).not.toHaveBeenCalled();
    statSyncSpy.mockRestore();
    expect(resolver.resolveSync('@scope/pkg', context, 'browser')?.fsPath).toBe(
      path.join(packageDir, 'browser.js')
    );

    const conditionalPackageDir = path.join(
      tempDir,
      'node_modules',
      'conditional-package'
    );
    const conditionalCases = [
      ['browser', 'import'],
      ['browser', 'require'],
      ['node', 'import'],
      ['node', 'require'],
    ] as const;
    const conditionalResults = await Promise.all(
      conditionalCases.map(([mode, dependencyKind]) =>
        resolver.resolveAsync(
          'conditional-package',
          { ...context, dependencyKind },
          mode
        )
      )
    );
    expect(conditionalResults.map((result) => result?.fsPath)).toEqual([
      path.join(conditionalPackageDir, 'browser-import.js'),
      path.join(conditionalPackageDir, 'browser-require.cjs'),
      path.join(conditionalPackageDir, 'node-import.js'),
      path.join(conditionalPackageDir, 'node-require.cjs'),
    ]);
  });

  it('resolves package children & rewrites only literal dynamic imports', async () => {
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

    const preview = {
      entryFsDirectory: path.join(tempDir, 'docs'),
      dependentFsPaths: new Set<string>(),
      typescriptConfiguration: undefined,
      configuration: {
        updateMode: 'onSave',
        useSucraseTranspiler: false,
      },
      doc: {
        uri: vscode.Uri.file(path.join(tempDir, 'docs', 'entry.mdx')),
      },
      getWebviewUri: () => undefined,
      webviewHandle: {},
    } as never;

    const literal = await fetchLocal(
      './dynamic.js',
      false,
      path.join(packageDir, 'browser.js'),
      preview
    );
    const computed = await fetchLocal(
      './computed.js',
      false,
      path.join(packageDir, 'browser.js'),
      preview
    );
    const mixed = await fetchLocal(
      './mixed.js',
      false,
      path.join(packageDir, 'browser.js'),
      preview
    );

    expect(literal?.code).toContain('module.exports.load');
    expect(literal?.code).toContain('require("\\u0000mdx-forge:import');
    expect(literal?.code).not.toContain("import('./dynamic-child.js')");
    expect(literal?.dependencies).toEqual([
      {
        specifier: './dynamic-child.js',
        kind: 'import',
        runtimeRequest: createImportRuntimeRequest('./dynamic-child.js'),
      },
    ]);
    expect(computed?.code).toContain('import(specifier)');
    expect(computed?.dependencies).toEqual([]);
    expect(mixed?.code).toContain('require("\\u0000mdx-forge:import');
    expect(mixed?.code).toContain('import(specifier)');
    expect(mixed?.dependencies).toEqual(literal?.dependencies);

    const runtimeModule: {
      exports: { load?: () => Promise<unknown> };
    } = { exports: {} };
    const dynamicChildExports = { named: 'dynamic-child' };
    const runtimeRequire = vi.fn(() => dynamicChildExports);
    new Function('module', 'exports', 'require', literal!.code)(
      runtimeModule,
      runtimeModule.exports,
      runtimeRequire
    );

    await expect(runtimeModule.exports.load?.()).resolves.toBeDefined();
    expect(runtimeRequire).toHaveBeenCalledWith(
      createImportRuntimeRequest('./dynamic-child.js')
    );

    const mixedRuntimeModule: {
      exports: {
        loadLiteral?: () => Promise<{ default: unknown }>;
        loadComputed?: (specifier: string) => Promise<{ default: unknown }>;
      };
    } = { exports: {} };
    new Function('module', 'exports', 'require', mixed!.code)(
      mixedRuntimeModule,
      mixedRuntimeModule.exports,
      runtimeRequire
    );
    await expect(mixedRuntimeModule.exports.loadLiteral?.()).resolves.toEqual({
      named: 'dynamic-child',
      default: dynamicChildExports,
    });
    await expect(
      mixedRuntimeModule.exports.loadComputed?.(
        'data:text/javascript,export default "computed"'
      )
    ).rejects.toMatchObject({
      code: 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING',
    });

    registry.clear();
    configureRuntime({
      maxConcurrentFetches: 8,
      maxModuleLoadDepth: 100,
      preloadAliases: {},
      runtime: {
        Fragment: null,
        jsx: () => null,
        jsxs: () => null,
      },
    });
    const entryPath = writeFixture('docs/conditional-entry.js', '');
    const entryResult = await getScriptHandler().handle(
      [
        "import { value as imported } from 'conditional-package';",
        "const required = require('conditional-package');",
        'module.exports = { imported, required: required.value };',
      ].join('\n'),
      entryPath,
      {
        documentUri: preview.doc.uri,
        entryFsDirectory: tempDir,
        useSucraseTranspiler: false,
        getWebviewUri: () => undefined,
      }
    );
    expect(entryResult.dependencies).toEqual([
      {
        specifier: 'conditional-package',
        kind: 'import',
        runtimeRequest: createImportRuntimeRequest('conditional-package'),
      },
      {
        specifier: 'conditional-package',
        kind: 'require',
        runtimeRequest: 'conditional-package',
      },
    ]);

    const loadedEntry = await loadModule(
      entryPath,
      entryResult.code,
      entryResult.dependencies,
      (request, isBare, parentId, kind) =>
        fetchLocal(request, isBare, parentId, preview, kind)
    );
    expect(loadedEntry.exports).toEqual({
      imported: 'browser-import',
      required: 'browser-require',
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
