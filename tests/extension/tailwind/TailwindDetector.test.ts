// tests/extension/tailwind/TailwindDetector.test.ts
// verify Tailwind entry CSS detection stays scoped to project boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  mockFindFiles,
  mockFindUp,
  mockGetWorkspaceFolder,
  mockWatchers,
  mockWorkspaceFolders,
} = vi.hoisted(() => ({
  mockFindFiles: vi.fn(),
  mockFindUp: vi.fn(),
  mockGetWorkspaceFolder: vi.fn(),
  mockWatchers: [] as Array<{
    pattern: string;
    change?: (uri: { fsPath: string }) => void;
    create?: (uri: { fsPath: string }) => void;
    delete?: (uri: { fsPath: string }) => void;
  }>,
  mockWorkspaceFolders: vi.fn(),
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
    getWorkspaceFolder: (...args: unknown[]) => mockGetWorkspaceFolder(...args),
    get workspaceFolders() {
      return mockWorkspaceFolders();
    },
    createFileSystemWatcher: (pattern: string) => {
      const watcher: (typeof mockWatchers)[number] = { pattern };
      mockWatchers.push(watcher);
      return {
        onDidChange: (handler: (uri: { fsPath: string }) => void) => {
          watcher.change = handler;
        },
        onDidCreate: (handler: (uri: { fsPath: string }) => void) => {
          watcher.create = handler;
        },
        onDidDelete: (handler: (uri: { fsPath: string }) => void) => {
          watcher.delete = handler;
        },
        dispose: vi.fn(),
      };
    },
  },
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/find-up',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../packages/extension-host/src/shared/utils/find-up')
      >();
    mockFindUp.mockImplementation(actual.findUp);
    return {
      ...actual,
      findUp: (...args: unknown[]) => mockFindUp(...args),
    };
  }
);

import { TailwindDetector } from '../../../packages/extension-host/src/features/tailwind/TailwindDetector';
import { STANDARD_DEBOUNCE_MS } from '@mdx-preview/contracts';

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
    mockWatchers.length = 0;
    mockGetWorkspaceFolder.mockReturnValue(undefined);
    mockWorkspaceFolders.mockReturnValue(undefined);
    mockFindFiles.mockImplementation(
      async (pattern: { base: string }, _exclude: string, maxResults: number) =>
        collectCssFiles(pattern.base).slice(0, maxResults)
    );
  });

  it('matches entry directories by path boundary', () => {
    mockWorkspaceFolders.mockReturnValue([
      { uri: { fsPath: '/workspace/site' } },
      { uri: { fsPath: '/workspace/site-other' } },
    ]);
    const detector = new TailwindDetector();

    expect(
      detector.resolveWorkspaceRoot({
        docUri: { scheme: 'untitled' } as never,
        entryDir: '/workspace/site-other/docs',
      })
    ).toBe('/workspace/site-other');

    detector.dispose();
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

  it('reuses negative detection across edits and invalidates it on file events', async () => {
    const workspaceRoot = makeTempDir();
    const detector = new TailwindDetector();
    const options = {
      workspaceRoot,
      entryDir: workspaceRoot,
      maxCssFilesToSearch: 50,
      mdxText: '# document',
    };

    await detector.detectProfile(options);
    await detector.detectProfile(options);
    await detector.detectProfile(options);

    expect(mockFindUp).toHaveBeenCalledTimes(1);
    expect(mockFindFiles).toHaveBeenCalledTimes(1);

    const cssWatcher = mockWatchers.find(
      (watcher) => watcher.pattern === '**/*.css'
    );
    cssWatcher?.create?.({ fsPath: path.join(workspaceRoot, 'new.css') });
    await detector.detectProfile(options);
    expect(mockFindFiles).toHaveBeenCalledTimes(2);

    const configWatcher = mockWatchers.find((watcher) =>
      watcher.pattern.includes('tailwind.config')
    );
    configWatcher?.delete?.({
      fsPath: path.join(workspaceRoot, 'tailwind.config.ts'),
    });
    await detector.detectProfile(options);
    expect(mockFindUp).toHaveBeenCalledTimes(2);

    detector.dispose();
    mockWatchers.length = 0;
    const creationWorkspaceRoot = makeTempDir();
    const siblingRoot = makeTempDir();
    const creationDetector = new TailwindDetector();
    const onWorkspaceChange = vi.fn();
    const onSiblingChange = vi.fn();
    creationDetector.onDidChangeDetectionInputs(
      creationWorkspaceRoot,
      onWorkspaceChange
    );
    creationDetector.onDidChangeDetectionInputs(siblingRoot, onSiblingChange);

    const configPath = path.join(creationWorkspaceRoot, 'tailwind.config.ts');
    const createdCssPath = path.join(
      creationWorkspaceRoot,
      'styles',
      'created.css'
    );
    const existingCssPath = path.join(
      creationWorkspaceRoot,
      'styles',
      'existing.css'
    );
    const irrelevantCssPath = path.join(
      creationWorkspaceRoot,
      'styles',
      'irrelevant.css'
    );
    const emptyThenWrittenCssPath = path.join(
      creationWorkspaceRoot,
      'styles',
      'empty-then-written.css'
    );
    const detectionConfigWatcher = mockWatchers.find((watcher) =>
      watcher.pattern.includes('tailwind.config')
    );
    const detectionCssWatcher = mockWatchers.find(
      (watcher) => watcher.pattern === '**/*.css'
    );

    writeFile(emptyThenWrittenCssPath, '');
    detectionCssWatcher?.create?.({ fsPath: emptyThenWrittenCssPath });
    await new Promise((resolve) =>
      setTimeout(resolve, STANDARD_DEBOUNCE_MS + 25)
    );
    expect(onWorkspaceChange).not.toHaveBeenCalled();

    writeFile(emptyThenWrittenCssPath, '@import "tailwindcss";');
    writeFile(existingCssPath, 'body { color: black; }');
    detectionCssWatcher?.change?.({ fsPath: emptyThenWrittenCssPath });
    writeFile(existingCssPath, '@tailwind utilities;');
    detectionCssWatcher?.change?.({ fsPath: existingCssPath });
    writeFile(createdCssPath, '@import "tailwindcss/theme";');
    detectionCssWatcher?.create?.({ fsPath: createdCssPath });
    detectionCssWatcher?.change?.({ fsPath: createdCssPath });
    writeFile(irrelevantCssPath, 'body { color: rebeccapurple; }');
    detectionCssWatcher?.change?.({ fsPath: irrelevantCssPath });
    detectionConfigWatcher?.create?.({ fsPath: configPath });

    await new Promise((resolve) =>
      setTimeout(resolve, STANDARD_DEBOUNCE_MS + 25)
    );

    expect(onWorkspaceChange).toHaveBeenCalledTimes(1);
    expect(new Set(onWorkspaceChange.mock.calls[0][0])).toEqual(
      new Set([
        emptyThenWrittenCssPath,
        existingCssPath,
        createdCssPath,
        configPath,
      ])
    );
    expect(onSiblingChange).not.toHaveBeenCalled();

    creationDetector.dispose();
  });
});
