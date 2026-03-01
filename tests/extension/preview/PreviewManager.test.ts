// tests/extension/preview/PreviewManager.test.ts
// unit tests for preview manager singleton lifecycle & state

import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock preview-commands to avoid pulling in heavy deps
vi.mock(
  '../../../packages/extension-host/src/features/preview/preview-commands',
  () => ({
    openPreview: vi.fn(),
    refreshPreview: vi.fn(),
  })
);

// mock Preview module to avoid transitive dep chain
// (Preview -> EvaluationEngine -> transform -> sucrase)
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

  });

  // refreshAllPreviews

  describe('refreshAllPreviews', () => {
    it('active preview -> calls refreshWebview', async () => {
      const mgr = PreviewManager.getInstance();
      const preview = createMockPreview({ active: true });
      mgr.setCurrentPreview(preview);
      await mgr.refreshAllPreviews();
      expect(preview.refreshWebview).toHaveBeenCalled();
    });

  });

  // clearAllWebviewCaches

  describe('clearAllWebviewCaches', () => {
    it('active -> calls clearAllCaches', async () => {
      const mgr = PreviewManager.getInstance();
      const preview = createMockPreview({ active: true });
      mgr.setCurrentPreview(preview);
      await mgr.clearAllWebviewCaches();
      expect(preview.clearAllCaches).toHaveBeenCalled();
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
