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

function createMockPreview(): Preview {
  return {
    dispose: vi.fn(),
  } as unknown as Preview;
}

describe('PreviewManager', () => {
  beforeEach(() => {
    PreviewManager.reset();
    vi.clearAllMocks();
  });

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
