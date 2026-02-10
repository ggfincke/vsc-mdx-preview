// tests/extension/compiler/plugin-loader.test.ts
// unit tests for custom plugin loading via mdx-tools/compiler

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadPluginsFromConfig, mergePlugins } from 'mdx-tools/compiler';
import type {
  CompilerConfig,
  PluginLoader,
  ErrorReporter,
  TrustValidator,
} from 'mdx-tools/compiler';

function createPluginModule(tempDir: string, name: string): string {
  const pluginPath = path.join(tempDir, `${name}.cjs`);
  fs.writeFileSync(
    pluginPath,
    'module.exports = function plugin() { return function transformer(tree) { return tree; }; };',
    'utf-8'
  );
  return pluginPath;
}

// create a mock plugin loader that resolves plugins from temp dir
function createMockPluginLoader(resolveMap: Map<string, string>): PluginLoader {
  return {
    resolve(specifier: string, _fromDir: string): string {
      const resolved = resolveMap.get(specifier);
      if (!resolved) {
        throw new Error(`Cannot find plugin "${specifier}"`);
      }
      return resolved;
    },
    load(resolvedPath: string): unknown {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(resolvedPath);
    },
  };
}

function createConfig(overrides: Partial<CompilerConfig> = {}): CompilerConfig {
  return {
    documentPath: '/workspace/doc.mdx',
    ...overrides,
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('plugin loader', () => {
  let mockErrorReporter: ErrorReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockErrorReporter = {
      reportPluginError: vi.fn(),
    };
  });

  it('returns empty result when config is undefined', async () => {
    const result = await loadPluginsFromConfig(undefined, createConfig());

    expect(result).toEqual({
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    });
  });

  it('loads remark & rehype plugin lists including option tuples', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-plugin-loader-')
    );
    tempDirs.push(tempDir);

    const remarkPath = createPluginModule(tempDir, 'remark-plugin');
    const remarkWithOptionsPath = createPluginModule(
      tempDir,
      'remark-options-plugin'
    );
    const rehypePath = createPluginModule(tempDir, 'rehype-plugin');

    const resolveMap = new Map([
      ['remark-plugin', remarkPath],
      ['remark-options-plugin', remarkWithOptionsPath],
      ['rehype-plugin', rehypePath],
    ]);

    const result = await loadPluginsFromConfig(
      {
        config: {
          remarkPlugins: [
            'remark-plugin',
            ['remark-options-plugin', { strategy: 'strict' }],
          ],
          rehypePlugins: ['rehype-plugin'],
        },
        configDir: tempDir,
        configPath: path.join(tempDir, '.mdx-previewrc.json'),
      },
      createConfig({
        pluginLoader: createMockPluginLoader(resolveMap),
        errorReporter: mockErrorReporter,
        trustValidator: {
          isTrusted: () => ({ canExecute: true }),
        },
      })
    );

    expect(result.errorCount).toBe(0);
    expect(result.remarkPlugins).toHaveLength(2);
    expect(result.rehypePlugins).toHaveLength(1);
    expect(typeof result.remarkPlugins[0]).toBe('function');
    expect(Array.isArray(result.remarkPlugins[1])).toBe(true);
    expect(
      (result.remarkPlugins[1] as [unknown, Record<string, unknown>])[1]
    ).toEqual({
      strategy: 'strict',
    });
  });

  it('reports trust failure & skips plugin loading', async () => {
    const trustValidator: TrustValidator = {
      isTrusted: () => ({
        canExecute: false,
        reason: 'Trusted Mode is disabled',
      }),
    };

    const result = await loadPluginsFromConfig(
      {
        config: {
          remarkPlugins: ['remark-a'],
          rehypePlugins: ['rehype-a'],
        },
        configDir: '/workspace',
        configPath: '/workspace/.mdx-previewrc.json',
      },
      createConfig({
        trustValidator,
        errorReporter: mockErrorReporter,
      })
    );

    expect(result).toEqual({
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    });
    expect(mockErrorReporter.reportPluginError).toHaveBeenCalledTimes(1);
  });

  it('counts load errors while loading remaining plugins', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-plugin-loader-')
    );
    tempDirs.push(tempDir);

    const goodRehypePath = createPluginModule(tempDir, 'rehype-good');

    const resolveMap = new Map([['rehype-good', goodRehypePath]]);

    const result = await loadPluginsFromConfig(
      {
        config: {
          remarkPlugins: ['remark-missing'],
          rehypePlugins: ['rehype-good'],
        },
        configDir: tempDir,
        configPath: path.join(tempDir, '.mdx-previewrc.json'),
      },
      createConfig({
        pluginLoader: createMockPluginLoader(resolveMap),
        errorReporter: mockErrorReporter,
        trustValidator: {
          isTrusted: () => ({ canExecute: true }),
        },
      })
    );

    expect(result.errorCount).toBe(1);
    expect(result.remarkPlugins).toHaveLength(0);
    expect(result.rehypePlugins).toHaveLength(1);
    expect(mockErrorReporter.reportPluginError).toHaveBeenCalledTimes(1);
  });

  it('merges custom plugins after built-ins', () => {
    const builtIn = [() => null, () => null];
    const custom = [() => null];
    const merged = mergePlugins(builtIn, custom);

    expect(merged).toHaveLength(3);
    expect(merged[0]).toBe(builtIn[0]);
    expect(merged[1]).toBe(builtIn[1]);
    expect(merged[2]).toBe(custom[0]);
  });
});
