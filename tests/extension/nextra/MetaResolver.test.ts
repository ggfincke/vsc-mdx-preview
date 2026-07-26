// tests/extension/nextra/MetaResolver.test.ts
// unit tests for Nextra metadata lookup, lifecycle, & publication

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { MetaResolver } from '../../../packages/extension-host/src/features/framework/nextra/MetaResolver';
import { postPushArtifacts } from '../../../packages/extension-host/src/features/preview/evaluation/post-push-artifacts';
import {
  mockFrameworkDetector,
  mockMetaResolver,
  mockPreviewManager,
} from '../../helpers/mock-services';

vi.mock('mdx-forge/compiler', () => ({
  extractNextraFrontmatter: vi.fn(() => ({})),
}));

interface WatchHandlers {
  change?: (uri: vscode.Uri) => void;
  create?: (uri: vscode.Uri) => void;
  delete?: (uri: vscode.Uri) => void;
  dispose?: ReturnType<typeof vi.fn>;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  MetaResolver.reset();
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-nextra-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function captureWatchers(): Map<string, WatchHandlers> {
  const watchers = new Map<string, WatchHandlers>();
  vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockImplementation(
    (pattern) => {
      const handlers: WatchHandlers = { dispose: vi.fn() };
      watchers.set(String(pattern), handlers);
      return {
        onDidChange: (handler) => {
          handlers.change = handler;
          return { dispose: vi.fn() };
        },
        onDidCreate: (handler) => {
          handlers.create = handler;
          return { dispose: vi.fn() };
        },
        onDidDelete: (handler) => {
          handlers.delete = handler;
          return { dispose: vi.fn() };
        },
        dispose: handlers.dispose,
      } as vscode.FileSystemWatcher;
    }
  );
  return watchers;
}

describe('MetaResolver', () => {
  beforeEach(() => {
    MetaResolver.reset();
  });

  it('resolves page settings and merges frontmatter overrides', () => {
    const workspaceRoot = createTempDir();
    const metaPath = path.join(workspaceRoot, '_meta.json');
    writeFile(
      metaPath,
      JSON.stringify({
        advanced: {
          title: 'Advanced',
          theme: { layout: 'full', toc: false },
        },
      })
    );

    const mdxPath = path.join(workspaceRoot, 'advanced.mdx');
    writeFile(mdxPath, '# Advanced');

    const resolver = MetaResolver.getInstance();
    const result = resolver.resolveNextraMeta(mdxPath, workspaceRoot);

    expect(result).toEqual({ title: 'Advanced', layout: 'full', toc: false });
    expect(
      resolver.mergeNextraMeta(result, { layout: 'raw', toc: true })
    ).toEqual({ title: 'Advanced', layout: 'raw', toc: true });
  });

  it('does not read metadata above the workspace boundary', () => {
    const parentDir = createTempDir();
    const workspaceRoot = path.join(parentDir, 'site');
    const mdxPath = path.join(workspaceRoot, 'docs', 'page.mdx');
    writeFile(mdxPath, '# Page');
    writeFile(
      path.join(parentDir, '_meta.json'),
      JSON.stringify({ page: 'Outside Title' })
    );

    const result = MetaResolver.getInstance().resolveNextraMeta(
      mdxPath,
      workspaceRoot
    );

    expect(result).toBeNull();
  });

  it('does not classify a prefix-sibling document as inside the workspace', () => {
    const parentDir = createTempDir();
    const workspaceRoot = path.join(parentDir, 'site');
    const mdxPath = path.join(parentDir, 'site-old', 'page.mdx');
    fs.mkdirSync(workspaceRoot);
    writeFile(mdxPath, '# Page');
    writeFile(
      path.join(parentDir, '_meta.json'),
      JSON.stringify({ page: 'Sibling Title' })
    );

    const result = MetaResolver.getInstance().resolveNextraMeta(
      mdxPath,
      workspaceRoot
    );

    expect(result).toBeNull();
    const stressWorkspaceRoot = createTempDir();
    const watchers = captureWatchers();
    const resolver = MetaResolver.getInstance();

    for (let index = 0; index < 125; index += 1) {
      const stressMdxPath = path.join(
        stressWorkspaceRoot,
        `section-${index}`,
        'page.mdx'
      );
      writeFile(stressMdxPath, '# Page');
      resolver.resolveNextraMeta(stressMdxPath, stressWorkspaceRoot);
    }

    expect((resolver as any).trackedDocuments.size).toBe(100);
    expect((resolver as any).metaWatchTargets.size).toBe(101);
    expect(watchers.size).toBe(1);
    expect(
      (resolver as any).metaWatchTargets.has(
        path.join(stressWorkspaceRoot, 'section-0', '_meta.json')
      )
    ).toBe(false);
    expect(
      (resolver as any).metaWatchTargets.has(
        path.join(stressWorkspaceRoot, 'section-124', '_meta.json')
      )
    ).toBe(true);
  });

  it('refreshes and publishes metadata across creation, shared edits, and deletion', async () => {
    const workspaceRoot = createTempDir();
    const firstMdxPath = path.join(workspaceRoot, 'one', 'page.mdx');
    const secondMdxPath = path.join(workspaceRoot, 'two', 'page.mdx');
    const metaPath = path.join(workspaceRoot, '_meta.json');
    writeFile(firstMdxPath, '# One');
    writeFile(secondMdxPath, '# Two');

    const watchers = captureWatchers();
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      doc: { uri: vscode.Uri.file(firstMdxPath) },
    });

    const resolver = MetaResolver.getInstance();
    expect(resolver.resolveNextraMeta(firstMdxPath, workspaceRoot)).toBeNull();
    expect(resolver.resolveNextraMeta(secondMdxPath, workspaceRoot)).toBeNull();
    const trackedTargets = (resolver as any).metaWatchTargets.size;
    const trackedDocuments = (resolver as any).trackedDocuments.size;
    resolver.clearCaches();
    expect((resolver as any).metaWatchTargets.size).toBe(trackedTargets);
    expect((resolver as any).trackedDocuments.size).toBe(trackedDocuments);

    writeFile(metaPath, JSON.stringify({ page: 'Created' }));
    watchers.get('**/_meta.json')?.create?.(vscode.Uri.file(metaPath));

    expect(resolver.resolveNextraMeta(firstMdxPath, workspaceRoot)).toEqual({
      title: 'Created',
    });
    expect(resolver.resolveNextraMeta(secondMdxPath, workspaceRoot)).toEqual({
      title: 'Created',
    });
    expect(mockPreviewManager.refreshAllPreviews).toHaveBeenCalledTimes(1);

    writeFile(metaPath, JSON.stringify({ page: 'Shared Update' }));
    watchers.get('**/_meta.json')?.change?.(vscode.Uri.file(metaPath));

    expect(resolver.resolveNextraMeta(firstMdxPath, workspaceRoot)).toEqual({
      title: 'Shared Update',
    });
    expect(resolver.resolveNextraMeta(secondMdxPath, workspaceRoot)).toEqual({
      title: 'Shared Update',
    });

    fs.rmSync(metaPath);
    watchers.get('**/_meta.json')?.delete?.(vscode.Uri.file(metaPath));

    expect(resolver.resolveNextraMeta(firstMdxPath, workspaceRoot)).toBeNull();
    expect(resolver.resolveNextraMeta(secondMdxPath, workspaceRoot)).toBeNull();

    writeFile(metaPath, JSON.stringify({ page: 'Recreated' }));
    watchers.get('**/_meta.json')?.create?.(vscode.Uri.file(metaPath));
    expect(resolver.resolveNextraMeta(firstMdxPath, workspaceRoot)).toEqual({
      title: 'Recreated',
    });

    const setNextraMeta = vi.fn();
    const updatePreviewSafe = vi.fn();
    const serviceMetaResolver = mockMetaResolver as unknown as {
      resolveNextraMeta: ReturnType<typeof vi.fn>;
      mergeNextraMeta: ReturnType<typeof vi.fn>;
    };
    serviceMetaResolver.resolveNextraMeta = vi
      .fn()
      .mockReturnValueOnce({ title: 'Published' })
      .mockReturnValueOnce(null);
    serviceMetaResolver.mergeNextraMeta = vi.fn(
      (meta: { title: string } | null) => meta ?? {}
    );
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'nextra',
    });
    vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue({
      uri: vscode.Uri.file(workspaceRoot),
      name: 'site',
      index: 0,
    });

    const preview = {
      doc: { uri: vscode.Uri.file(firstMdxPath) },
      webviewHandle: {
        setNextraMeta,
        setTailwindBrowserCss: vi.fn(),
        setTailwindCss: vi.fn(),
        updatePreviewSafe,
      },
      pushThemeState: vi.fn(),
      nextTailwindRequestId: vi.fn(),
      updateTailwindWatchFiles: vi.fn(),
      syncEditorScrollToPreview: vi.fn(),
    };
    const context = {
      preview,
      isCurrent: () => true,
      fsPath: firstMdxPath,
    };
    const stageResult = {
      kind: 'safe' as const,
      result: { html: '<p>Page</p>', frontmatter: undefined },
    };

    await postPushArtifacts(context as never, stageResult);
    await postPushArtifacts(context as never, stageResult);

    expect(setNextraMeta.mock.calls).toEqual([
      [{ title: 'Published' }],
      [null],
    ]);
    expect(updatePreviewSafe).toHaveBeenCalledTimes(2);
    expect(setNextraMeta.mock.invocationCallOrder[0]).toBeLessThan(
      updatePreviewSafe.mock.invocationCallOrder[0]
    );
    expect(setNextraMeta.mock.invocationCallOrder[1]).toBeLessThan(
      updatePreviewSafe.mock.invocationCallOrder[1]
    );

    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'generic',
    });
    await postPushArtifacts(context as never, stageResult);

    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'nextra',
    });
    vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(undefined);
    await postPushArtifacts(context as never, stageResult);

    vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
      uri: vscode.Uri.file(workspaceRoot),
      name: 'site',
      index: 0,
    });
    mockMetaResolver.resolveNextraMeta.mockImplementation(() => {
      throw new Error('metadata read failed');
    });
    await postPushArtifacts(context as never, stageResult);

    expect(setNextraMeta.mock.calls.slice(-3)).toEqual([
      [null],
      [null],
      [null],
    ]);
  });
});
