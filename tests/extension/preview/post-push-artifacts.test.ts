// tests/extension/preview/post-push-artifacts.test.ts
// unit tests for post-evaluation artifact stage

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockFrameworkDetector,
  mockMetaResolver,
} from '../../helpers/mock-services';

const {
  mockDetectComponents,
  mockGetUsedGenericComponents,
  mockExtractNextraFrontmatter,
} = vi.hoisted(() => ({
  mockDetectComponents: vi.fn(),
  mockGetUsedGenericComponents: vi.fn(() => []),
  mockExtractNextraFrontmatter: vi.fn(() => ({})),
}));

vi.mock('vscode', () => ({
  workspace: {
    getWorkspaceFolder: vi.fn(() => undefined),
  },
}));

vi.mock(
  '../../../packages/extension-host/src/features/diagnostics/ComponentDetector',
  () => ({
    detectComponents: (...args: unknown[]) => mockDetectComponents(...args),
    getUsedGenericComponents: (...args: unknown[]) =>
      mockGetUsedGenericComponents(...args),
  })
);

vi.mock('mdx-forge/compiler', () => ({
  extractNextraFrontmatter: (...args: unknown[]) =>
    mockExtractNextraFrontmatter(...args),
}));

import * as vscode from 'vscode';
import { postPushArtifacts } from '../../../packages/extension-host/src/features/preview/evaluation/post-push-artifacts';
import type { PreparedEvaluationContext } from '../../../packages/extension-host/src/features/preview/evaluation';

function createContext(
  overrides?: Partial<PreparedEvaluationContext>
): PreparedEvaluationContext {
  const preview = {
    doc: {
      uri: {
        fsPath: '/workspace/doc.mdx',
        toString: () => 'file:///workspace/doc.mdx',
      },
    },
    webviewHandle: {
      setNextraMeta: vi.fn(),
      setUsedComponents: vi.fn(),
      updatePreview: vi.fn(),
      updatePreviewSafe: vi.fn(),
      setTailwindCss: vi.fn(),
      setTailwindBrowserCss: vi.fn(),
    },
    pushThemeState: vi.fn(),
    setFrontmatterState: vi.fn(),
    pushRuntimeConfiguration: vi.fn(),
    updateDependencies: vi.fn(),
    nextTailwindRequestId: vi.fn(() => 11),
    updateTailwindWatchFiles: vi.fn(),
    isTailwindRequestCurrent: vi.fn(() => true),
  } as any;

  return {
    preview,
    text: '# doc',
    fsPath: '/workspace/doc.mdx',
    engine: {
      processTailwindAsync: vi.fn(),
    } as any,
    trustState: {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    },
    effectiveConfig: {
      tailwind: {
        enabled: 'enabled',
      },
    } as any,
    compilerConfig: {} as any,
    canExecute: true,
    tailwindEnabled: true,
    ...overrides,
  };
}

describe('postPushArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'generic',
    });
    mockMetaResolver.resolveNextraMeta = vi.fn(() => ({}));
    mockMetaResolver.mergeNextraMeta = vi.fn(() => ({}));
    mockDetectComponents.mockResolvedValue({});
    mockGetUsedGenericComponents.mockReturnValue([]);
  });

  it('applies shared frontmatter/runtime pushes for trusted stage', async () => {
    const context = createContext();

    await postPushArtifacts(context, {
      kind: 'trusted',
      result: {
        code: 'export default function Demo(){}',
        entryFilePath: '/workspace/doc.mdx',
        dependencies: ['./dep.ts'],
        frontmatter: { title: 'Hello' },
      },
    });

    expect(context.preview.pushThemeState).toHaveBeenCalledWith({
      title: 'Hello',
    });
    expect(context.preview.setFrontmatterState).toHaveBeenCalledWith({
      title: 'Hello',
    });
    expect(context.preview.pushRuntimeConfiguration).toHaveBeenCalledTimes(1);
  });

  it('pushes Nextra metadata only when framework is nextra and merged metadata is non-empty', async () => {
    const context = createContext();
    mockFrameworkDetector.getFramework.mockReturnValue({ framework: 'nextra' });
    vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
      uri: { fsPath: '/workspace' },
    } as any);
    mockMetaResolver.resolveNextraMeta = vi.fn(() => ({ title: 'from-json' }));
    mockExtractNextraFrontmatter.mockReturnValue({ title: 'from-frontmatter' });
    mockMetaResolver.mergeNextraMeta = vi.fn(() => ({ title: 'merged' }));

    await postPushArtifacts(context, {
      kind: 'safe',
      result: {
        html: '<p>safe</p>',
        frontmatter: { title: 'frontmatter' },
      },
    });

    expect(context.preview.webviewHandle.setNextraMeta).toHaveBeenCalledWith({
      title: 'merged',
    });
  });

  it('runs trusted branch side effects including dependency update, component preload, and tailwind async processing', async () => {
    const context = createContext();
    mockGetUsedGenericComponents.mockReturnValue(['Callout']);

    await postPushArtifacts(context, {
      kind: 'trusted',
      result: {
        code: 'export default function Demo(){}',
        entryFilePath: '/workspace/doc.mdx',
        dependencies: ['./dep.ts'],
        frontmatter: undefined,
      },
    });

    expect(context.preview.updateDependencies).toHaveBeenCalledWith([
      './dep.ts',
    ]);
    expect(
      context.preview.webviewHandle.setUsedComponents
    ).toHaveBeenCalledWith(['Callout']);
    expect(context.preview.webviewHandle.updatePreview).toHaveBeenCalledWith(
      'export default function Demo(){}',
      '/workspace/doc.mdx',
      ['./dep.ts']
    );
    expect(context.engine.processTailwindAsync).toHaveBeenCalledTimes(1);
  });

  it('runs safe branch side effects and clears tailwind channels', async () => {
    const context = createContext();

    await postPushArtifacts(context, {
      kind: 'safe',
      result: {
        html: '<p>safe</p>',
        frontmatter: undefined,
      },
    });

    expect(context.preview.updateTailwindWatchFiles).toHaveBeenCalledWith([]);
    expect(
      context.preview.webviewHandle.setTailwindBrowserCss
    ).toHaveBeenCalledWith('');
    expect(context.preview.webviewHandle.setTailwindCss).toHaveBeenCalledWith(
      ''
    );
    expect(
      context.preview.webviewHandle.updatePreviewSafe
    ).toHaveBeenCalledWith('<p>safe</p>');
  });
});
