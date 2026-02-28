// tests/extension/preview/prepare-evaluation-context.test.ts
// unit tests for evaluation preparation stage

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockTailwindProcessor,
  mockTrustManager,
} from '../../helpers/mock-services';

const {
  mockStatusBarMessage,
  mockBuildEffectivePreviewConfig,
  mockToCompilerConfig,
} = vi.hoisted(() => ({
  mockStatusBarMessage: vi.fn(),
  mockBuildEffectivePreviewConfig: vi.fn(),
  mockToCompilerConfig: vi.fn(() => ({ compiler: true })),
}));

vi.mock('vscode', () => ({
  window: {
    setStatusBarMessage: mockStatusBarMessage,
  },
}));

vi.mock(
  '../../../packages/extension-host/src/shared/config/EffectivePreviewConfig',
  () => ({
    buildEffectivePreviewConfig: (...args: unknown[]) =>
      mockBuildEffectivePreviewConfig(...args),
    toCompilerConfig: (...args: unknown[]) => mockToCompilerConfig(...args),
  })
);

import { prepareEvaluationContext } from '../../../packages/extension-host/src/features/preview/evaluation/prepare-evaluation-context';

function createPreview() {
  return {
    doc: {
      uri: {
        fsPath: '/workspace/doc.mdx',
      },
    },
    markTailwindFallbackReason: vi.fn(() => true),
    clearTailwindFallbackReason: vi.fn(),
    setTailwindBrowserRuntimeEnabled: vi.fn(() => false),
  };
}

describe('prepareEvaluationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
    mockBuildEffectivePreviewConfig.mockReturnValue({
      enableScripts: true,
      tailwind: {
        enabled: 'enabled',
      },
    });
    mockTailwindProcessor.detectProfile.mockResolvedValue({
      profile: 'browser',
      reason: 'inline classes',
      workspaceRoot: '/workspace',
      configPath: null,
      entryCssPath: '/workspace/tailwind.css',
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });
  });

  it('computes effective canExecute from trust + config', async () => {
    mockBuildEffectivePreviewConfig.mockReturnValue({
      enableScripts: false,
      tailwind: { enabled: 'enabled' },
    });

    const preview = createPreview();
    const engine = {} as any;

    const prepared = await prepareEvaluationContext(
      preview as any,
      '# doc',
      '/workspace/doc.mdx',
      engine
    );

    expect(prepared.kind).toBe('ready');
    if (prepared.kind === 'ready') {
      expect(prepared.context.canExecute).toBe(false);
      expect(prepared.context.engine).toBe(engine);
    }
  });

  it('shows advanced profile fallback warning only once per fallback key', async () => {
    mockTailwindProcessor.detectProfile.mockResolvedValue({
      profile: 'advanced',
      reason: 'tailwind.config.ts detected',
      workspaceRoot: '/workspace',
      configPath: '/workspace/tailwind.config.ts',
      entryCssPath: '/workspace/tailwind.css',
      hasTailwindInput: true,
      inlineTailwindStyles: [],
    });

    const preview = createPreview();
    preview.markTailwindFallbackReason
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await prepareEvaluationContext(
      preview as any,
      '# doc',
      '/workspace/doc.mdx',
      {} as any
    );
    await prepareEvaluationContext(
      preview as any,
      '# doc',
      '/workspace/doc.mdx',
      {} as any
    );

    expect(mockStatusBarMessage).toHaveBeenCalledTimes(1);
    expect(mockStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining('advanced fallback active'),
      8000
    );
  });

  it('returns refresh-required when tailwind browser runtime toggle changes', async () => {
    const preview = createPreview();
    preview.setTailwindBrowserRuntimeEnabled.mockReturnValue(true);

    const prepared = await prepareEvaluationContext(
      preview as any,
      '# doc',
      '/workspace/doc.mdx',
      {} as any
    );

    expect(prepared).toEqual({ kind: 'refresh-required' });
  });

  it('preserves tailwind profile hint in ready context', async () => {
    const preview = createPreview();

    const prepared = await prepareEvaluationContext(
      preview as any,
      '# doc',
      '/workspace/doc.mdx',
      {} as any
    );

    expect(prepared.kind).toBe('ready');
    if (prepared.kind === 'ready') {
      expect(prepared.context.tailwindProfileHint?.profile).toBe('browser');
      expect(mockTailwindProcessor.detectProfile).toHaveBeenCalledTimes(1);
    }
  });
});
