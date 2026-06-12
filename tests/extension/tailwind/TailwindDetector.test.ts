// tests/extension/tailwind/TailwindDetector.test.ts
// verify Tailwind entry CSS detection stays scoped to project boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { mockFindFiles } = vi.hoisted(() => ({
  mockFindFiles: vi.fn(),
}));

vi.mock('vscode', () => ({
  RelativePattern: class RelativePattern {
    base: string;
    pattern: string;

    constructor(base: string, pattern: string) {
      this.base = base;
      this.pattern = pattern;
    }
  },
  workspace: {
    findFiles: (...args: unknown[]) => mockFindFiles(...args),
  },
}));

import { TailwindDetector } from '../../../packages/extension-host/src/features/tailwind/TailwindDetector';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mdx-preview-tailwind-detector-')
  );
  tempDirs.push(tempDir);
  return tempDir;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function collectCssFiles(baseDir: string): Array<{ fsPath: string }> {
  const results: Array<{ fsPath: string }> = [];

  function visit(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.css')) {
        results.push({ fsPath: fullPath });
      }
    }
  }

  visit(baseDir);
  return results;
}

describe('TailwindDetector entry CSS scan scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFiles.mockImplementation(
      async (pattern: { base: string }, _exclude: string, maxResults: number) =>
        collectCssFiles(pattern.base).slice(0, maxResults)
    );
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('does not borrow Tailwind CSS from a sibling package', async () => {
    const workspaceRoot = makeTempDir();
    const markdownPackage = path.join(workspaceRoot, 'markdown-tables');
    const basicPackage = path.join(workspaceRoot, 'basic');

    writeFile(
      path.join(markdownPackage, 'package.json'),
      '{"name":"markdown-tables"}'
    );
    writeFile(path.join(basicPackage, 'package.json'), '{"name":"basic"}');
    writeFile(
      path.join(basicPackage, 'tailwind.css'),
      '@import "tailwindcss";'
    );

    const detector = new TailwindDetector();
    const result = await detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: markdownPackage,
      maxCssFilesToSearch: 50,
    });

    expect(result).toBeNull();
    expect(mockFindFiles).toHaveBeenCalledWith(
      expect.objectContaining({ base: markdownPackage }),
      '**/node_modules/**',
      50
    );
  });

  it('keeps workspace fallback scanning for a single package workspace', async () => {
    const workspaceRoot = makeTempDir();
    const docsDir = path.join(workspaceRoot, 'docs');
    const cssPath = path.join(workspaceRoot, 'features', 'theme.css');

    fs.mkdirSync(docsDir, { recursive: true });
    writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"site"}');
    writeFile(cssPath, '@import "tailwindcss";');

    const detector = new TailwindDetector();
    const result = await detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: docsDir,
      maxCssFilesToSearch: 50,
    });

    expect(result).toBe(cssPath);
    expect(mockFindFiles).toHaveBeenCalledWith(
      expect.objectContaining({ base: workspaceRoot }),
      '**/node_modules/**',
      50
    );
  });
});
