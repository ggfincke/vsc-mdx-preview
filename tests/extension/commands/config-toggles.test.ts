// tests/extension/commands/config-toggles.test.ts
// unit tests for simple configuration toggle commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockConfigManager } from '../../helpers/mock-services';

import { commands } from '../../../packages/extension-host/src/features/commands/config-toggles';

describe('config-toggles commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleUseVscodeMarkdownStyles', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.toggleUseVscodeMarkdownStyles'
    )!.handler;

    it('true -> false', async () => {
      mockConfigManager.get.mockReturnValue(true);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useVscodeMarkdownStyles',
        false
      );
    });

    it('false -> true', async () => {
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

    it('true -> false', async () => {
      mockConfigManager.get.mockReturnValue(true);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useWhiteBackground',
        false
      );
    });

    it('false -> true', async () => {
      mockConfigManager.get.mockReturnValue(false);
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.useWhiteBackground',
        true
      );
    });
  });
});
