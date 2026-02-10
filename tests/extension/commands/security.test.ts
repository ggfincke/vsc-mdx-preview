// tests/extension/commands/security.test.ts
// unit tests for security-related commands w/ trust checks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockSelectSecurityPolicy = vi.fn();

const mockConfigManager = {
  get: vi.fn(),
  set: vi.fn(async () => {}),
};

const mockTrustManager = {
  getState: vi.fn(),
};

const mockErrorReporter = {
  reportWithActions: vi.fn(async () => {}),
};

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
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

vi.mock(
  '../../../packages/extension-host/src/features/security/security',
  () => ({
    selectSecurityPolicy: (...args: any[]) => mockSelectSecurityPolicy(...args),
  })
);

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
  getTrustManager: () => mockTrustManager,
  getErrorReporter: () => mockErrorReporter,
}));

vi.mock('../../../packages/extension-host/src/shared/errors', () => ({
  ErrorContext: {
    Security: 'security',
  },
}));

import { commands } from '../../../packages/extension-host/src/features/commands/security';

describe('security commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('changeSecuritySettings', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.changeSecuritySettings'
    )!.handler;

    it('calls selectSecurityPolicy', () => {
      handler();
      expect(mockSelectSecurityPolicy).toHaveBeenCalled();
    });
  });

  describe('toggleScripts', () => {
    const handler = commands.find(
      (c) => c.id === 'mdx-preview.commands.toggleScripts'
    )!.handler;

    it('untrusted workspace → reportWithActions w/ Manage Trust & Cancel', async () => {
      mockTrustManager.getState.mockReturnValue({
        workspaceTrusted: false,
      });
      await handler();
      expect(mockErrorReporter.reportWithActions).toHaveBeenCalledWith(
        expect.any(Error),
        'security',
        expect.arrayContaining([
          expect.objectContaining({ label: 'Manage Trust' }),
          expect.objectContaining({ label: 'Cancel' }),
        ])
      );
    });

    it('trusted + enabled → sets false w/ Workspace scope & shows info', async () => {
      mockTrustManager.getState.mockReturnValue({
        workspaceTrusted: true,
      });
      mockConfigManager.get.mockReturnValue(true);
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.enableScripts',
        false,
        vscode.ConfigurationTarget.Workspace
      );
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    });

    it('trusted + disabled → sets true w/ Workspace scope & shows info', async () => {
      mockTrustManager.getState.mockReturnValue({
        workspaceTrusted: true,
      });
      mockConfigManager.get.mockReturnValue(false);
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
      await handler();
      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'preview.enableScripts',
        true,
        vscode.ConfigurationTarget.Workspace
      );
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('enabled'));
    });

    it('Manage Trust action executes trust management command', async () => {
      mockTrustManager.getState.mockReturnValue({
        workspaceTrusted: false,
      });

      // capture the actions passed to reportWithActions
      mockErrorReporter.reportWithActions.mockImplementation(
        async (_err: any, _ctx: any, actions: any[]) => {
          const manageTrust = actions.find(
            (a: any) => a.label === 'Manage Trust'
          );
          if (manageTrust) {
            await manageTrust.action();
          }
        }
      );

      const execSpy = vi.spyOn(vscode.commands, 'executeCommand');
      await handler();
      expect(execSpy).toHaveBeenCalledWith('workbench.trust.manage');
    });
  });
});
