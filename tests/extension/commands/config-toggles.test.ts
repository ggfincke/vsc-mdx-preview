// tests/extension/commands/config-toggles.test.ts
// unit tests for simple configuration toggle commands

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConfigManager = {
  get: vi.fn(),
  set: vi.fn(async () => {}),
};

vi.mock('../../../packages/extension/logging', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../packages/extension/services', () => ({
  getConfigManager: () => mockConfigManager,
}));

import { commands } from '../../../packages/extension/commands/config-toggles';

describe('config-toggles commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleUseVscodeMarkdownStyles', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.toggleUseVscodeMarkdownStyles'
    )!.handler;

    it('true → false', async () => {
      mockConfigManager.get.mockReturnValue(true);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useVscodeMarkdownStyles',
        false
      );
    });

    it('false → true', async () => {
      mockConfigManager.get.mockReturnValue(false);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useVscodeMarkdownStyles',
        true
      );
    });
  });

  describe('toggleUseWhiteBackground', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.toggleUseWhiteBackground'
    )!.handler;

    it('true → false', async () => {
      mockConfigManager.get.mockReturnValue(true);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useWhiteBackground',
        false
      );
    });

    it('false → true', async () => {
      mockConfigManager.get.mockReturnValue(false);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useWhiteBackground',
        true
      );
    });
  });
});
