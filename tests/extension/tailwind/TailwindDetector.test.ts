// tests/extension/tailwind/TailwindDetector.test.ts
// unit tests for Tailwind detection helpers

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TailwindDetector } from '../../../packages/extension-host/src/features/tailwind/TailwindDetector';

function createTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-tailwind-'));
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
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

describe('TailwindDetector', () => {
  it('resolves tailwind config from workspace root', () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);

    const configPath = path.join(workspaceRoot, 'tailwind.config.js');
    writeFile(configPath, 'module.exports = {}');

    const detector = new TailwindDetector();
    const resolved = detector.resolveConfigPath({
      entryDir: workspaceRoot,
      workspaceRoot,
    });

    expect(resolved).toBe(configPath);
  });

  it('resolves entry CSS from common locations', async () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);

    const cssPath = path.join(workspaceRoot, 'tailwind.css');
    writeFile(cssPath, '@tailwind base;');

    const detector = new TailwindDetector();
    const resolved = await detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
    });

    expect(resolved).toBe(cssPath);
  });

  it('invalidates detection caches for changed paths', async () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);

    const configPath = path.join(workspaceRoot, 'tailwind.config.js');
    const cssPath = path.join(workspaceRoot, 'tailwind.css');
    writeFile(configPath, 'module.exports = {}');
    writeFile(cssPath, '@tailwind utilities;');

    const detector = new TailwindDetector();
    const cacheKey = `${workspaceRoot}::${workspaceRoot}`;

    detector.resolveConfigPath({ entryDir: workspaceRoot, workspaceRoot });
    await detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
    });

    const configCache = (detector as any).configCache as {
      has: (key: string) => boolean;
    };
    const entryCache = (detector as any).entryCssCache as {
      has: (key: string) => boolean;
    };

    expect(configCache.has(cacheKey)).toBe(true);
    expect(entryCache.has(cacheKey)).toBe(true);

    detector.invalidateDetectionCaches([configPath, cssPath]);

    expect(configCache.has(cacheKey)).toBe(false);
    expect(entryCache.has(cacheKey)).toBe(false);
  });

  it('routes to advanced profile when tailwind.config.* is present', async () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);

    const configPath = path.join(workspaceRoot, 'tailwind.config.ts');
    writeFile(configPath, 'export default {}');
    const cssPath = path.join(workspaceRoot, 'tailwind.css');
    writeFile(cssPath, '@import "tailwindcss";');

    const detector = new TailwindDetector();
    const result = await detector.detectProfile({
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
      mdxText: '# Test',
    });

    expect(result.profile).toBe('advanced');
    expect(result.reason).toContain('tailwind.config.*');
    expect(result.configPath).toBe(configPath);
    expect(result.entryCssPath).toBe(cssPath);
  });

  it('routes to advanced profile when entry CSS contains @plugin', async () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);

    const cssPath = path.join(workspaceRoot, 'tailwind.css');
    writeFile(
      cssPath,
      '@import "tailwindcss";\n@plugin "@tailwindcss/typography";'
    );

    const detector = new TailwindDetector();
    const result = await detector.detectProfile({
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
      mdxText: '# Test',
    });

    expect(result.profile).toBe('advanced');
    expect(result.reason).toContain('@plugin');
    expect(result.entryCssPath).toBe(cssPath);
  });

  it('extracts inline Tailwind styles and keeps browser profile without advanced signals', async () => {
    const workspaceRoot = createTempWorkspace();
    tempDirs.push(workspaceRoot);
    const cssPath = path.join(workspaceRoot, 'tailwind.css');
    writeFile(cssPath, '@import "tailwindcss";');

    const detector = new TailwindDetector();
    const result = await detector.detectProfile({
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
      mdxText: `<style type="text/tailwindcss">
@theme {
  --color-brand: #123456;
}
</style>`,
    });

    expect(result.profile).toBe('browser');
    expect(result.hasTailwindInput).toBe(true);
    expect(result.entryCssPath).toBe(cssPath);
    expect(result.inlineTailwindStyles).toHaveLength(1);
    expect(result.inlineTailwindStyles[0]).toContain('@theme');
  });
});
