// tests/extension/tailwind/TailwindProcessor.test.ts
// unit tests for Tailwind processing pipeline

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import { ContentHashCache } from '@mdx-preview/runtime-utils';
import { TailwindProcessor } from '../../../packages/extension-host/src/features/tailwind/TailwindProcessor';
import { DependencyScanner } from '../../../packages/extension-host/src/features/tailwind/scanning/DependencyScanner';
import { invalidateResolution } from '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory';
import type { ResolutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/module-system';
import type { TailwindConfig } from '../../../packages/extension-host/src/shared/config/types';
import type { TrustState } from '@mdx-preview/contracts';
import { createMockPreview } from '../../helpers/mock-preview';
import {
  mockFrameworkDetector,
  mockErrorReporter,
} from '../../helpers/mock-services';

function createTailwindConfig(
  overrides: Partial<TailwindConfig> = {}
): TailwindConfig {
  return {
    enabled: 'enabled',
    maxFileSizeBytes: 1024 * 1024,
    maxCssFilesToSearch: 50,
    cacheMaxEntries: 5,
    cacheTtlSeconds: 60,
    compilationTimeout: 1000,
    ...overrides,
  };
}

function writeFixture(
  root: string,
  relativePath: string,
  contents: string
): string {
  const fsPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fsPath), { recursive: true });
  fs.writeFileSync(fsPath, contents);
  return fsPath;
}

const trustedState: TrustState = {
  workspaceTrusted: true,
  scriptsEnabled: true,
  canExecute: true,
  openMdxLinksInPreview: true,
};

const safeState: TrustState = {
  workspaceTrusted: true,
  scriptsEnabled: true,
  canExecute: false,
  openMdxLinksInPreview: true,
};

const tempDirs: string[] = [];

afterEach(() => {
  invalidateResolution();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('TailwindProcessor', () => {
  beforeEach(() => {
    TailwindProcessor.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    TailwindProcessor.reset();
  });

  it('returns disabled when trust or configuration blocks execution', async () => {
    const disabledCases = [
      {
        trustState: safeState,
        tailwindConfig: createTailwindConfig(),
      },
      {
        trustState: trustedState,
        tailwindConfig: createTailwindConfig({ enabled: 'disabled' }),
      },
    ];

    for (const disabledCase of disabledCases) {
      TailwindProcessor.reset();
      const processor = TailwindProcessor.getInstance();
      const preview = createMockPreview() as any;
      const result = await processor.process({
        preview,
        mdxText: '# Test',
        entryFilePath: preview.fsPath,
        entryFileDependencies: [],
        trustState: disabledCase.trustState,
        tailwindConfig: disabledCase.tailwindConfig,
      });

      expect(result.enabled).toBe(false);
      expect(result.profile).toBe('disabled');
      expect(result.css).toBe('');
      expect(result.watchFiles).toEqual([]);
    }
  });

  it('compiles config and inline inputs and invalidates same-class edits', async () => {
    const processor = TailwindProcessor.getInstance();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-tailwind-')
    );
    tempDirs.push(tempDir);

    const configPath = writeFixture(
      tempDir,
      'config/tailwind.config.cjs',
      'module.exports = { theme: { extend: { colors: { brand: "#123456" } } } };'
    );
    const themePath = createRequire(import.meta.url).resolve(
      'tailwindcss/theme.css'
    );
    const cssPath = writeFixture(
      tempDir,
      'styles/tailwind.css',
      [
        '/* @config "./comment-only.cjs"; */',
        `@import ${JSON.stringify(themePath)};`,
        '@import "./entry.css";',
        '@tailwind utilities;',
      ].join('\n')
    );
    writeFixture(tempDir, 'styles/entry.css', '.from-entry { color: coral; }');
    writeFixture(tempDir, 'docs/inline.css', '.from-inline { color: teal; }');
    const entryFilePath = writeFixture(tempDir, 'docs/doc.mdx', '# Test');

    const preview = createMockPreview({
      fsPath: entryFilePath,
    }) as any;

    const detector = (processor as any).detector;
    const scanner = (processor as any).scanner;
    const compiler = (processor as any).compiler;

    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue(tempDir);
    vi.spyOn(detector, 'resolveConfigPath').mockReturnValue(configPath);
    vi.spyOn(detector, 'resolveEntryCssPath').mockResolvedValue(cssPath);
    vi.spyOn(detector, 'getWorkspaceTailwindVersion').mockReturnValue({
      version: '4.0.0',
      major: 4,
    });
    const scanSpy = vi.spyOn(scanner, 'scan');
    const compileSpy = vi.spyOn(compiler, 'compile');
    const mdxText = [
      '<div className="text-brand card">Preview</div>',
      '<style type="text/tailwindcss">',
      '@import "./inline.css";',
      '.card { @apply p-4; color: red; }',
      '</style>',
    ].join('\n');

    const options = {
      preview,
      mdxText,
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig(),
    };
    const result = await processor.process(options);
    const cached = await processor.process(options);
    const changed = await processor.process({
      ...options,
      mdxText: mdxText.replace('color: red', 'color: blue'),
    });

    expect(result.enabled).toBe(true);
    expect(result.profile).toBe('advanced');
    expect(result.css).toContain('.text-brand');
    expect(result.css).toContain('#123456');
    expect(result.css).toContain('.card');
    expect(result.css).toContain('padding:');
    expect(result.css).toContain('color: red');
    expect(result.css).toContain('.from-entry');
    expect(result.css).toContain('.from-inline');
    expect(cached.css).toBe(result.css);
    expect(changed.css).toContain('color: blue');
    expect(changed.css).not.toContain('color: red');
    expect(compileSpy).toHaveBeenCalledTimes(2);
    expect(compileSpy.mock.calls[0][0].content).toBe(
      compileSpy.mock.calls[1][0].content
    );
    expect(fs.existsSync(`${entryFilePath}.tailwind.css`)).toBe(false);
    expect(result.watchFiles).toEqual([configPath, cssPath].sort());
    expect(changed.watchFiles).toEqual(result.watchFiles);
    expect(scanSpy).toHaveBeenCalledWith(
      mdxText,
      expect.objectContaining({
        resolutionContext: {
          baseDir: path.dirname(entryFilePath),
          tsConfig: undefined,
          framework: 'generic',
          workspaceRoot: tempDir,
          shimsEnabled: true,
        },
      })
    );

    vi.mocked(detector.resolveEntryCssPath).mockResolvedValue(null);
    const bundled = await processor.process(options);
    expect(bundled.enabled).toBe(true);
    expect(bundled.css).toContain('.text-brand');
    expect(bundled.css).toContain('#123456');
    expect(bundled.css).toContain('padding:');
    expect(bundled.css).toContain('.from-inline');
    expect(bundled.watchFiles).toEqual([configPath]);
    expect(fs.existsSync(path.join(tempDir, 'node_modules'))).toBe(false);
    expect(fs.existsSync(`${entryFilePath}.tailwind.css`)).toBe(false);
  });

  it('scans local aliases & baseUrl while excluding package targets', async () => {
    invalidateResolution();
    const tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-tailwind-alias-'))
    );
    tempDirs.push(tempDir);

    const entryFilePath = writeFixture(tempDir, 'docs/entry.mdx', '# Entry');
    const aliasPath = writeFixture(
      tempDir,
      'src/components/AliasCard.tsx',
      'export const AliasCard = () => <div className="alias-card p-4" />;'
    );
    const baseUrlPath = writeFixture(
      tempDir,
      'src/shared/BaseCard.tsx',
      'export const BaseCard = () => <div className="base-card" />;'
    );
    const sitePath = writeFixture(
      tempDir,
      'src/site/SiteCard.tsx',
      'export const SiteCard = () => <div className="site-card" />;'
    );
    writeFixture(
      tempDir,
      'node_modules/external-package/package.json',
      JSON.stringify({ name: 'external-package', main: 'index.js' })
    );
    writeFixture(
      tempDir,
      'node_modules/external-package/index.js',
      'module.exports = `<div className="package-only" />`;'
    );
    writeFixture(
      tempDir,
      'node_modules/vendor/VendorCard.tsx',
      'export const VendorCard = () => <div className="vendor-only" />;'
    );
    const symlinkedPackagePath = writeFixture(
      tempDir,
      'workspace-packages/symlinked-package/index.js',
      'module.exports = `<div className="symlink-package-only" />`;'
    );
    writeFixture(
      tempDir,
      'workspace-packages/symlinked-package/package.json',
      JSON.stringify({ name: 'symlinked-package', main: 'index.js' })
    );
    fs.symlinkSync(
      path.dirname(symlinkedPackagePath),
      path.join(tempDir, 'node_modules', 'symlinked-package'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    const outsideDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-tailwind-outside-'))
    );
    tempDirs.push(outsideDir);
    const escapedPath = writeFixture(
      outsideDir,
      'EscapeCard.tsx',
      'export const EscapeCard = () => <div className="escaped-only" />;'
    );
    fs.symlinkSync(
      outsideDir,
      path.join(tempDir, 'src', 'escaped'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    const context: ResolutionContext = {
      baseDir: path.dirname(entryFilePath),
      workspaceRoot: tempDir,
      framework: 'docusaurus',
      shimsEnabled: true,
      tsConfig: {
        configPath: path.join(tempDir, 'tsconfig.json'),
        baseUrl: 'src',
        paths: {
          '@components/*': ['components/*'],
          '@vendor/*': ['../node_modules/vendor/*'],
          '@escape/*': ['escaped/*'],
        },
      },
    };
    const extractFromText = vi.fn(
      (text: string, classSet: Set<string>): void => {
        for (const match of text.matchAll(/className="([^"]+)"/g)) {
          const classNames = match[1];
          if (!classNames) {
            continue;
          }
          for (const className of classNames.split(/\s+/)) {
            classSet.add(className);
          }
        }
      }
    );
    const scanCache = new ContentHashCache<string[]>({
      maxEntries: 10,
      ttlMs: 60_000,
    });
    const scanner = new DependencyScanner();
    const scan = () =>
      scanner.scanDependencies(
        entryFilePath,
        [
          '@components/AliasCard',
          'shared/BaseCard',
          '@site/src/site/SiteCard',
          'external-package',
          '@vendor/VendorCard',
          '@escape/EscapeCard',
          'symlinked-package',
          '@theme/Tabs',
          'node:fs',
          'npm://external-package',
          'NPM://external-package',
          'https://example.com/Card.js',
          'HTTPS://example.com/Card.js',
          'file:///tmp/Card.js',
          'DATA:text/javascript,export default null',
        ],
        1024 * 1024,
        extractFromText,
        context,
        scanCache
      );

    const first = await scan();
    const second = await scan();

    expect(first.classes).toEqual(
      new Set(['alias-card', 'p-4', 'base-card', 'site-card'])
    );
    expect([...first.scannedFiles].sort()).toEqual(
      [aliasPath, baseUrlPath, sitePath].sort()
    );
    expect(first.scannedFiles).not.toContain(symlinkedPackagePath);
    expect(first.scannedFiles).not.toContain(escapedPath);
    expect(second).toEqual(first);
    expect(extractFromText).toHaveBeenCalledTimes(3);
  });

  it('uses browser profile when workspace is CSS-first', async () => {
    const processor = TailwindProcessor.getInstance();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-tailwind-browser-')
    );
    tempDirs.push(tempDir);

    const cssPath = path.join(tempDir, 'tailwind.css');
    fs.writeFileSync(cssPath, '@import "tailwindcss";', 'utf-8');

    const preview = createMockPreview({
      fsPath: path.join(tempDir, 'doc.mdx'),
    }) as any;

    const detector = (processor as any).detector;
    const compiler = (processor as any).compiler;
    const scanner = (processor as any).scanner;

    vi.spyOn(detector, 'resolveWorkspaceRoot').mockReturnValue(tempDir);
    vi.spyOn(detector, 'detectProfile').mockResolvedValue({
      profile: 'browser',
      reason: 'No tailwind.config.* or plugin directives detected',
      workspaceRoot: tempDir,
      configPath: null,
      entryCssPath: cssPath,
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });
    const compileSpy = vi.spyOn(compiler, 'compile');
    const scanSpy = vi.spyOn(scanner, 'scan');

    const result = await processor.process({
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig(),
    });

    expect(result.enabled).toBe(true);
    expect(result.profile).toBe('browser');
    expect(result.css).toContain('@import "tailwindcss";');
    expect(result.watchFiles).toEqual([cssPath]);
    expect(compileSpy).not.toHaveBeenCalled();
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('reuses browser input when the entry CSS and inline styles are unchanged', async () => {
    const processor = TailwindProcessor.getInstance();
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-tailwind-browser-cache-')
    );
    tempDirs.push(tempDir);
    const cssPath = path.join(tempDir, 'tailwind.css');
    fs.writeFileSync(cssPath, '@import "tailwindcss";', 'utf-8');
    const preview = createMockPreview({
      fsPath: path.join(tempDir, 'doc.mdx'),
    }) as any;
    const profileHint = {
      profile: 'browser' as const,
      reason: 'CSS-first workspace',
      workspaceRoot: tempDir,
      configPath: null,
      entryCssPath: cssPath,
      hasTailwindInput: true,
      inlineTailwindStyles: ['.card { @apply p-4; }'],
    };
    const readSpy = vi.spyOn(fs.promises, 'readFile');
    const options = {
      preview,
      mdxText: '# Test',
      entryFilePath: preview.fsPath,
      entryFileDependencies: [],
      trustState: trustedState,
      tailwindConfig: createTailwindConfig(),
      profileHint,
    };

    const first = await processor.process(options);
    const second = await processor.process(options);
    const changed = await processor.process({
      ...options,
      profileHint: {
        ...profileHint,
        inlineTailwindStyles: ['.card { @apply p-8; }'],
      },
    });

    expect(first.css).toBe(second.css);
    expect(changed.css).toContain('@apply p-8');
    expect(readSpy).toHaveBeenCalledTimes(2);
  });
});
