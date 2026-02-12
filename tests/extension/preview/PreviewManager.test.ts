// tests/extension/preview/PreviewManager.test.ts
// unit tests for preview manager singleton lifecycle & state

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../packages/extension-host/src/app/services', () => ({}));

// mock preview-commands to avoid pulling in heavy deps
vi.mock(
  '../../../packages/extension-host/src/features/preview/preview-commands',
  () => ({
    openPreview: vi.fn(),
    refreshPreview: vi.fn(),
  })
);

// mock Preview module to avoid transitive dep chain
// (Preview → EvaluationEngine → transform → sucrase)
vi.mock(
  '../../../packages/extension-host/src/features/preview/Preview',
  () => ({
    Preview: vi.fn(),
  })
);

import { PreviewManager } from '../../../packages/extension-host/src/features/preview/preview-manager';
import type { Preview } from '../../../packages/extension-host/src/features/preview/Preview';

function createMockPreview(opts?: { active?: boolean }): Preview {
  return {
    active: opts?.active ?? true,
    refreshWebview: vi.fn(async () => {}),
    pushThemeState: vi.fn(),
    clearAllCaches: vi.fn(async () => {}),
    dispose: vi.fn(),
  } as unknown as Preview;
}

describe('PreviewManager', () => {
  beforeEach(() => {
    PreviewManager.reset();
    vi.clearAllMocks();
  });

  // singleton

  describe('singleton', () => {
    it('getInstance returns same instance', () => {
      const a = PreviewManager.getInstance();
      const b = PreviewManager.getInstance();
      expect(a).toBe(b);
    });

    it('reset clears instance & creates new', () => {
      const a = PreviewManager.getInstance();
      PreviewManager.reset();
      const b = PreviewManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // refreshAllPreviews

  describe('refreshAllPreviews', () => {
    it('active preview → calls refreshWebview', async () => {
      const mgr = PreviewManager.getInstance();
      const preview = createMockPreview({ active: true });
      mgr.setCurrentPreview(preview);
      await mgr.refreshAllPreviews();
      expect(preview.refreshWebview).toHaveBeenCalled();
    });

    it('no preview → no-op', async () => {
      const mgr = PreviewManager.getInstance();
      await mgr.refreshAllPreviews();
    });
  });

  // clearAllWebviewCaches

  describe('clearAllWebviewCaches', () => {
    it('active → calls clearAllCaches', async () => {
      const mgr = PreviewManager.getInstance();
      const preview = createMockPreview({ active: true });
      mgr.setCurrentPreview(preview);
      await mgr.clearAllWebviewCaches();
      expect(preview.clearAllCaches).toHaveBeenCalled();
    });

    it('error in clearAllCaches is caught silently', async () => {
      const mgr = PreviewManager.getInstance();
      const preview = createMockPreview({ active: true });
      (preview.clearAllCaches as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('rpc fail')
      );
      mgr.setCurrentPreview(preview);
      // should not throw
      await mgr.clearAllWebviewCaches();
    });
  });

  // panel lifecycle

  describe('panel lifecycle', () => {
    it('clearPanel disposes panel & all panelDisposables', () => {
      const mgr = PreviewManager.getInstance();
      const panel = { dispose: vi.fn() } as any;
      mgr.setPanel(panel);

      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };
      mgr.getPanelDisposables().push(disposable1, disposable2);

      mgr.clearPanel();
      expect(panel.dispose).toHaveBeenCalled();
      expect(disposable1.dispose).toHaveBeenCalled();
      expect(disposable2.dispose).toHaveBeenCalled();
      expect(mgr.getPanel()).toBeUndefined();
      expect(mgr.getPanelDoc()).toBeUndefined();
      expect(mgr.getPanelDisposables()).toHaveLength(0);
    });
  });

  // dispose

  describe('dispose', () => {
    it('clears panel, disposes current preview, clears reference', () => {
      const mgr = PreviewManager.getInstance();
      const panel = { dispose: vi.fn() } as any;
      const preview = createMockPreview();
      mgr.setPanel(panel);
      mgr.setCurrentPreview(preview);

      mgr.dispose();
      expect(panel.dispose).toHaveBeenCalled();
      expect(preview.dispose).toHaveBeenCalled();
    });
  });
});
