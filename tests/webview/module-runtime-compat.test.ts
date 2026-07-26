// tests/webview/module-runtime-compat.test.ts
// verify old & structured Forge dependency contracts at the webview boundary

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
import type {
  FetchResult,
  ModuleDependency,
  ModuleDependencyKind,
} from '@mdx-preview/contracts';
import { createForgeRuntimeAdapter } from '../../packages/webview-client/src/features/module-runtime';

const IMPORT_RUNTIME_PREFIX = '\0mdx-forge:import\0';

type ForgeRuntime = Parameters<typeof createForgeRuntimeAdapter>[0];
type ForgeFetcher = Parameters<ForgeRuntime['setModuleFetcher']>[0];

interface PreloadEntry {
  id: string;
  exports: unknown;
  aliases?: string[];
}

interface InstalledForgeRuntime extends ForgeRuntime {
  clearAllCaches(): void;
  setHostPreloadCallbacks(callbacks: {
    initPreloadedModules(
      registry: ForgeRuntime['registry'],
      layout: unknown
    ): void;
  }): void;
  setPreloadEntries(entries: PreloadEntry[]): void;
}

function importDependency(specifier: string): ModuleDependency {
  return {
    specifier,
    kind: 'import',
    runtimeRequest: `${IMPORT_RUNTIME_PREFIX}${specifier}`,
  };
}

function requireDependency(specifier: string): ModuleDependency {
  return {
    specifier,
    kind: 'require',
    runtimeRequest: specifier,
  };
}

async function loadInstalledForgeRuntime(): Promise<InstalledForgeRuntime> {
  const runtimeUrl = pathToFileURL(
    path.resolve(
      __dirname,
      '../../node_modules/mdx-forge/dist/esm/browser/index.js'
    )
  ).href;
  return (await import(runtimeUrl)) as unknown as InstalledForgeRuntime;
}

async function runProductionPairingProbe(): Promise<{
  frameworkShim: string;
  genericShim: string;
  initialReady: boolean;
  sameReact: boolean;
}> {
  const repoRoot = path.resolve(__dirname, '../..');
  const result = await build({
    absWorkingDir: repoRoot,
    bundle: true,
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.PROD': 'true',
    },
    format: 'esm',
    loader: { '.css': 'empty' },
    logLevel: 'silent',
    platform: 'node',
    stdin: {
      contents: `
        import React from 'react';
        import {
          clearAllCaches,
          ensureFrameworkShimsLoaded,
          evaluateModuleToComponent,
        } from './packages/webview-client/src/features/module-runtime/index.ts';

        const prefix = '\\0mdx-forge:import\\0';
        const dependency = (specifier) => ({
          specifier,
          kind: 'import',
          runtimeRequest: prefix + specifier,
        });

        export async function probe() {
          ensureFrameworkShimsLoaded('docusaurus');
          const dependencies = [
            dependency('react'),
            dependency('Tabs'),
            dependency('@theme/Tabs'),
          ];
          const code = [
            'const react = require(' + JSON.stringify(dependencies[0].runtimeRequest) + ');',
            'const generic = require(' + JSON.stringify(dependencies[1].runtimeRequest) + ');',
            'const framework = require(' + JSON.stringify(dependencies[2].runtimeRequest) + ');',
            'module.exports = {',
            '  default: () => ({',
            '    useState: react.useState,',
            '    genericShim: typeof generic.default,',
            '    frameworkShim: typeof framework.default,',
            '  }),',
            '};',
          ].join('\\n');
          const evaluate = async () => {
            const component = await evaluateModuleToComponent(
              code,
              '/production-pairing.mdx',
              dependencies
            );
            return component();
          };
          const initial = await evaluate();
          clearAllCaches();
          const restored = await evaluate();
          return {
            frameworkShim: restored.frameworkShim,
            genericShim: restored.genericShim,
            initialReady:
              initial.genericShim === 'function' &&
              initial.frameworkShim === 'function',
            sameReact: restored.useState === React.useState,
          };
        }
      `,
      loader: 'ts',
      resolveDir: repoRoot,
      sourcefile: 'production-pairing-probe.ts',
    },
    target: 'node22',
    write: false,
  });
  const output = result.outputFiles[0]?.text;
  if (!output) {
    throw new Error('Production pairing probe bundle was empty');
  }
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mdx-forge-probe-'));
  const modulePath = path.join(tempDir, 'production-pairing-probe.mjs');
  try {
    await writeFile(modulePath, output);
    const bundledModule = (await import(pathToFileURL(modulePath).href)) as {
      probe(): Promise<{
        frameworkShim: string;
        genericShim: string;
        initialReady: boolean;
        sameReact: boolean;
      }>;
    };
    return await bundledModule.probe();
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

describe('module runtime Forge compatibility', () => {
  it('runs the installed runtime across nested conditional branches', async () => {
    const runtime = await loadInstalledForgeRuntime();
    runtime.clearAllCaches();
    const reactDefault = {};
    const useState = () => {};
    const reactEntry: PreloadEntry = {
      id: 'npm://react@compat-test',
      exports: {
        __esModule: true,
        default: reactDefault,
        useState,
      },
      aliases: ['react'],
    };
    runtime.setPreloadEntries([reactEntry]);
    runtime.setHostPreloadCallbacks({
      initPreloadedModules: (registry) => {
        registry.preload(reactEntry.id, reactEntry.exports);
      },
    });
    const preloadAliases = new Map(
      (reactEntry.aliases ?? []).map((alias) => [alias, reactEntry.id])
    );
    const resolvePreloadAlias = vi.fn((specifier: string) => {
      const moduleId = preloadAliases.get(specifier);
      return moduleId !== undefined && runtime.registry.isPreloaded(moduleId)
        ? moduleId
        : undefined;
    });
    expect(resolvePreloadAlias('react')).toBeUndefined();
    resolvePreloadAlias.mockClear();

    const nestedDependencies = Object.freeze([
      importDependency('./leaf'),
      requireDependency('./leaf'),
    ]);
    const nestedResult = Object.freeze({
      fsPath: '/nested.js',
      code: [
        `const imported = require(${JSON.stringify(
          importDependency('./leaf').runtimeRequest
        )});`,
        'const required = require("./leaf");',
        'module.exports = { value: imported.value + "/" + required.value };',
      ].join('\n'),
      dependencies: nestedDependencies,
    }) as FetchResult;
    const extensionFetch = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        parentId: string,
        kind?: ModuleDependencyKind
      ): Promise<FetchResult | undefined> => {
        if (parentId === '/entry.mdx' && request === 'dual') {
          return {
            fsPath: `/dual-${kind}.js`,
            code: `module.exports = { value: ${JSON.stringify(kind)} };`,
            dependencies: [],
          };
        }
        if (parentId === '/entry.mdx' && request === './nested') {
          return nestedResult;
        }
        if (parentId === '/nested.js' && request === './leaf') {
          return {
            fsPath: `/leaf-${kind}.js`,
            code: `module.exports = { value: ${JSON.stringify(
              `${kind}-leaf`
            )} };`,
            dependencies: [],
          };
        }
      }
    );
    const adapter = createForgeRuntimeAdapter(
      runtime,
      extensionFetch,
      resolvePreloadAlias
    );
    const entryDependencies = [
      importDependency('react'),
      importDependency('dual'),
      requireDependency('dual'),
      requireDependency('./nested'),
    ];
    const entryCode = [
      `const react = require(${JSON.stringify(
        entryDependencies[0].runtimeRequest
      )});`,
      `const imported = require(${JSON.stringify(
        entryDependencies[1].runtimeRequest
      )});`,
      'const required = require("dual");',
      'const nested = require("./nested");',
      'module.exports = {',
      '  default: () => ({',
      '    react: react.default,',
      '    useState: react.useState,',
      '    value: imported.value + "/" + required.value + "/" + nested.value,',
      '  }),',
      '};',
    ].join('\n');

    const component = await adapter.evaluateModuleToComponent(
      entryCode,
      '/entry.mdx',
      entryDependencies
    );

    const result = component() as {
      react: unknown;
      useState: unknown;
      value: string;
    };
    expect(result.react).toBe(reactDefault);
    expect(result.useState).toBe(useState);
    expect(result.value).toBe('import/require/import-leaf/require-leaf');
    if (typeof runtime.createImportRuntimeRequest === 'function') {
      expect(resolvePreloadAlias).not.toHaveBeenCalled();
    } else {
      expect(resolvePreloadAlias).toHaveBeenCalledWith('react');
      expect(
        runtime.registry.getResolution(
          '/entry.mdx',
          entryDependencies[0].runtimeRequest
        )
      ).toBe(reactEntry.id);
    }
    expect(extensionFetch).toHaveBeenCalledTimes(5);
    expect(extensionFetch).not.toHaveBeenCalledWith(
      'react',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(extensionFetch).toHaveBeenCalledWith(
      'dual',
      true,
      '/entry.mdx',
      'import'
    );
    expect(extensionFetch).toHaveBeenCalledWith(
      'dual',
      true,
      '/entry.mdx',
      'require'
    );
    expect(extensionFetch).toHaveBeenCalledWith(
      './leaf',
      false,
      '/nested.js',
      'import'
    );
    expect(extensionFetch).toHaveBeenCalledWith(
      './leaf',
      false,
      '/nested.js',
      'require'
    );
    expect(nestedResult.dependencies).toBe(nestedDependencies);
    expect(nestedResult.dependencies[0]).toEqual(importDependency('./leaf'));
  });

  it('leaves structured dependencies & fetch results intact for final Forge', async () => {
    let registeredFetcher: ForgeFetcher | undefined;
    const evaluate = vi.fn(async () => () => 'structured');
    const runtime: ForgeRuntime = {
      createImportRuntimeRequest: (specifier) =>
        `${IMPORT_RUNTIME_PREFIX}${specifier}`,
      evaluateModuleToComponent: evaluate,
      registry: {
        isPreloaded: () => false,
      } as ForgeRuntime['registry'],
      setModuleFetcher: (fetcher) => {
        registeredFetcher = fetcher;
      },
    };
    const dependencies = [importDependency('dual'), requireDependency('dual')];
    const fetchResult: FetchResult = {
      fsPath: '/dual-import.js',
      code: 'module.exports = {};',
      dependencies: [importDependency('./nested')],
    };
    const extensionFetch = vi.fn(async () => fetchResult);
    const resolvePreloadAlias = vi.fn(() => undefined);
    const adapter = createForgeRuntimeAdapter(
      runtime,
      extensionFetch,
      resolvePreloadAlias
    );

    const component = await adapter.evaluateModuleToComponent(
      'module.exports = { default: () => null };',
      '/entry.mdx',
      dependencies
    );
    const returned = await registeredFetcher?.(
      'dual',
      true,
      '/entry.mdx',
      'import'
    );

    expect(component()).toBe('structured');
    expect(evaluate).toHaveBeenCalledWith(
      'module.exports = { default: () => null };',
      '/entry.mdx',
      dependencies
    );
    expect(extensionFetch).toHaveBeenCalledWith(
      'dual',
      true,
      '/entry.mdx',
      'import'
    );
    expect(returned).toBe(fetchResult);
    expect(returned?.dependencies[0]).toEqual(importDependency('./nested'));
    expect(resolvePreloadAlias).not.toHaveBeenCalled();
  });

  it('runs production preload callbacks against installed Forge', async () => {
    await expect(runProductionPairingProbe()).resolves.toEqual({
      frameworkShim: 'function',
      genericShim: 'function',
      initialReady: true,
      sameReact: true,
    });
  });
});
