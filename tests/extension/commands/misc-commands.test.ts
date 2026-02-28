// tests/extension/commands/misc-commands.test.ts
// unit tests for debug, authoring-guide, preview, & index commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { mockConfigManager } from '../../helpers/mock-services';
import { SETTINGS } from '../../../packages/extension-host/src/shared/config/ConfigManager';

const mockShowOutput = vi.fn();
const mockDoOpenPreview = vi.fn();
const mockDoRefreshPreview = vi.fn();

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  showOutput: (...args: any[]) => mockShowOutput(...args),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// mock commands that pull in heavy deps
vi.mock(
  '../../../packages/extension-host/src/features/preview/preview-manager',
  () => ({
    openPreview: (...args: any[]) => mockDoOpenPreview(...args),
    refreshPreview: (...args: any[]) => mockDoRefreshPreview(...args),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/preview/preview-commands',
  () => ({
    openPreview: (...args: any[]) => mockDoOpenPreview(...args),
    refreshPreview: (...args: any[]) => mockDoRefreshPreview(...args),
    openPreviewFromUri: vi.fn(),
  })
);

// mock authoring guide text
vi.mock(
  '../../../packages/extension-host/src/features/commands/authoring-guide-text',
  () => ({
    MDX_AUTHORING_GUIDE_TEXT: 'test guide content',
  })
);

// mock config-info (used in index.ts)
vi.mock(
  '../../../packages/extension-host/src/features/commands/config-info',
  () => ({
    commands: [],
  })
);

// mock security (used in index.ts)
vi.mock(
  '../../../packages/extension-host/src/features/security/security',
  () => ({
    selectSecurityPolicy: vi.fn(),
    SecurityPolicy: { Strict: 'strict', Disabled: 'disabled' },
  })
);

vi.mock('../../../packages/extension-host/src/shared/errors', () => ({
  ErrorContext: { Security: 'security' },
}));

// mock cache deps (used in index.ts)
vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory',
  () => ({
    clearResolverCache: vi.fn(),
  })
);

vi.mock(
  '../../../packages/extension-host/src/features/module-runtime/handlers',
  () => ({
    clearSassCache: vi.fn(),
  })
);

vi.mock(
  '../../../packages/extension-host/src/app/lifecycle/cache-subsystem',
  () => ({
    clearUnmanagedCaches: vi.fn(),
  })
);

describe('debug commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // import lazily to avoid issues w/ mock ordering
  async function getDebugHandler() {
    const mod =
      await import('../../../packages/extension-host/src/features/commands/debug');
    return mod.commands.find(
      (c) => c.id === 'mdx-preview.commands.toggleDebugOutput'
    )!.handler;
  }

  it('toggle on: sets true, calls showOutput, shows info', async () => {
    mockConfigManager.get.mockReturnValue(false);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const handler = await getDebugHandler();
    await handler();
    expect(mockConfigManager.set).toHaveBeenCalledWith(
      SETTINGS.DEBUG_OUTPUT,
      true
    );
    expect(mockShowOutput).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('enabled'));
  });

  it('toggle off: sets false, no showOutput, shows info', async () => {
    mockConfigManager.get.mockReturnValue(true);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const handler = await getDebugHandler();
    await handler();
    expect(mockConfigManager.set).toHaveBeenCalledWith(
      SETTINGS.DEBUG_OUTPUT,
      false
    );
    expect(mockShowOutput).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });
});

describe('authoring-guide commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getAuthoringHandler() {
    const mod =
      await import('../../../packages/extension-host/src/features/commands/authoring-guide');
    return mod.commands.find(
      (c) => c.id === 'mdx-preview.commands.copyAuthoringGuide'
    )!.handler;
  }

  it('writes text to clipboard & shows info message', async () => {
    const clipSpy = vi.spyOn(vscode.env.clipboard, 'writeText');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const handler = await getAuthoringHandler();
    await handler();
    expect(clipSpy).toHaveBeenCalledWith('test guide content');
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('clipboard'));
  });
});

describe('preview commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getPreviewCommands() {
    const mod =
      await import('../../../packages/extension-host/src/features/commands/preview');
    return mod.commands;
  }

  it('openPreview calls doOpenPreview', async () => {
    const cmds = await getPreviewCommands();
    const handler = cmds.find(
      (c) => c.id === 'mdx-preview.commands.openPreview'
    )!.handler;
    handler();
    expect(mockDoOpenPreview).toHaveBeenCalled();
  });

  it('refreshPreview calls doRefreshPreview', async () => {
    const cmds = await getPreviewCommands();
    const handler = cmds.find(
      (c) => c.id === 'mdx-preview.commands.refreshPreview'
    )!.handler;
    handler();
    expect(mockDoRefreshPreview).toHaveBeenCalled();
  });
});

describe('registerAllCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns array of disposables for each command', async () => {
    const registerSpy = vi
      .spyOn(vscode.commands, 'executeCommand')
      .mockResolvedValue(undefined);

    // mock registerCommand on vscode.commands
    const mockRegister = vi.fn((_id: string, _handler: any) => ({
      dispose: vi.fn(),
    }));
    (vscode.commands as any).registerCommand = mockRegister;

    const { registerAllCommands } =
      await import('../../../packages/extension-host/src/features/commands/index');
    const disposables = registerAllCommands();
    expect(Array.isArray(disposables)).toBe(true);
    expect(disposables.length).toBeGreaterThan(0);
    // each should have a dispose method
    for (const d of disposables) {
      expect(d).toHaveProperty('dispose');
    }

    registerSpy.mockRestore();
  });
});
