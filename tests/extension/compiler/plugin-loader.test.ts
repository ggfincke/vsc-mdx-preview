// tests/extension/compiler/plugin-loader.test.ts
// unit tests for custom plugin loading from project config

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  mockNodeResolver,
  mockTryRequireTrustedModeForDocument,
  mockErrorReporter,
} = vi.hoisted(() => ({
  mockNodeResolver: {
    resolveSync: vi.fn(),
  },
  mockTryRequireTrustedModeForDocument: vi.fn(),
  mockErrorReporter: {
    reportPluginError: vi.fn(),
  },
}));

vi.mock(
  '../../../packages/extension/module-system/resolver/resolver-factory',
  () => ({
    getNodeResolver: () => mockNodeResolver,
  })
);

vi.mock('../../../packages/extension/security/validateTrust', () => ({
  tryRequireTrustedModeForDocument: (...args: unknown[]) =>
    mockTryRequireTrustedModeForDocument(...args),
}));

vi.mock('../../../packages/extension/services', () => ({
  getErrorReporter: () => mockErrorReporter,
}));

vi.mock('../../../packages/extension/logging', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  loadPluginsFromConfig,
  mergePlugins,
} from '../../../packages/extension/compiler/plugins/loader';

function createPluginModule(tempDir: string, name: string): string {
  const pluginPath = path.join(tempDir, `${name}.cjs`);
  fs.writeFileSync(
    pluginPath,
    'module.exports = function plugin() { return function transformer(tree) { return tree; }; };',
    'utf-8'
  );
  return pluginPath;
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockTryRequireTrustedModeForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
  });

  it('returns empty result when config is undefined', async () => {
    const result = await loadPluginsFromConfig(undefined, {
      scheme: 'file',
      fsPath: '/workspace/doc.mdx',
    } as any);

    expect(result).toEqual({
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    });
    expect(mockTryRequireTrustedModeForDocument).not.toHaveBeenCalled();
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

    mockNodeResolver.resolveSync.mockImplementation(
      (_context: unknown, _configDir: string, pluginName: string) => {
        if (pluginName === 'remark-plugin') return remarkPath;
        if (pluginName === 'remark-options-plugin')
          return remarkWithOptionsPath;
        if (pluginName === 'rehype-plugin') return rehypePath;
        return false;
      }
    );

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
      } as any,
      { scheme: 'file', fsPath: '/workspace/doc.mdx' } as any
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
    expect(mockErrorReporter.reportPluginError).not.toHaveBeenCalled();
  });

  it('reports trust failure & skips plugin loading', async () => {
    mockTryRequireTrustedModeForDocument.mockImplementation(
      (
        _documentUri: unknown,
        _operation: string,
        onTrustError?: (error: { message: string }) => void
      ) => {
        onTrustError?.({ message: 'Trusted Mode is disabled' });
        return undefined;
      }
    );

    const result = await loadPluginsFromConfig(
      {
        config: {
          remarkPlugins: ['remark-a'],
          rehypePlugins: ['rehype-a'],
        },
        configDir: '/workspace',
        configPath: '/workspace/.mdx-previewrc.json',
      } as any,
      { scheme: 'file', fsPath: '/workspace/doc.mdx' } as any
    );

    expect(result).toEqual({
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    });
    expect(mockNodeResolver.resolveSync).not.toHaveBeenCalled();
    expect(mockErrorReporter.reportPluginError).toHaveBeenCalledTimes(1);
    const [pluginError, pluginName] =
      mockErrorReporter.reportPluginError.mock.calls[0];
    expect(pluginName).toBe('custom-plugins');
    expect((pluginError as Error).message).toContain(
      '2 plugin(s) will be ignored'
    );
  });

  it('counts load errors while loading remaining plugins', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-plugin-loader-')
    );
    tempDirs.push(tempDir);

    const goodRehypePath = createPluginModule(tempDir, 'rehype-good');

    mockNodeResolver.resolveSync.mockImplementation(
      (_context: unknown, _configDir: string, pluginName: string) => {
        if (pluginName === 'rehype-good') return goodRehypePath;
        return false;
      }
    );

    const result = await loadPluginsFromConfig(
      {
        config: {
          remarkPlugins: ['remark-missing'],
          rehypePlugins: ['rehype-good'],
        },
        configDir: tempDir,
        configPath: path.join(tempDir, '.mdx-previewrc.json'),
      } as any,
      { scheme: 'file', fsPath: '/workspace/doc.mdx' } as any
    );

    expect(result.errorCount).toBe(1);
    expect(result.remarkPlugins).toHaveLength(0);
    expect(result.rehypePlugins).toHaveLength(1);
    expect(mockErrorReporter.reportPluginError).toHaveBeenCalledTimes(1);
    const [, pluginName] = mockErrorReporter.reportPluginError.mock.calls[0];
    expect(pluginName).toBe('remark-missing');
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
