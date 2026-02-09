// tests/extension/commands/framework-selection.test.ts
// unit tests for framework selection QuickPick command

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockConfigManager = {
  get: vi.fn(),
  set: vi.fn(async () => {}),
};

const mockPreviewManager = {
  refreshAllPreviews: vi.fn(async () => {}),
};

const mockFrameworkDetector = {
  getFramework: vi.fn(() => ({ framework: 'generic', detected: false })),
  getFrameworkDisplayName: vi.fn((id: string) => id),
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

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
  getPreviewManager: () => mockPreviewManager,
  getFrameworkDetector: () => mockFrameworkDetector,
}));

import { commands } from '../../../packages/extension-host/src/features/commands/framework-selection';

describe('framework-selection commands', () => {
  const handler = commands.find(
    (c) => c.id === 'mdx-preview.commands.selectFramework'
  )!.handler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager.get.mockReturnValue('auto');
    // provide an active text editor
    (vscode.window as any).activeTextEditor = {
      document: { uri: { fsPath: '/test/file.mdx' } },
    };
  });

  it('shows 6 framework options', async () => {
    const spy = vi
      .spyOn(vscode.window, 'showQuickPick')
      .mockResolvedValue(undefined);
    await handler();
    const items = spy.mock.calls[0][0] as any[];
    expect(items).toHaveLength(6);
    const values = items.map((i: any) => i.value);
    expect(values).toEqual([
      'auto',
      'generic',
      'docusaurus',
      'nextjs',
      'starlight',
      'nextra',
    ]);
  });

  it('Auto-detect shows detected framework in description', async () => {
    mockFrameworkDetector.getFramework.mockReturnValue({
      framework: 'docusaurus',
      detected: true,
    });
    mockFrameworkDetector.getFrameworkDisplayName.mockReturnValue('Docusaurus');
    const spy = vi
      .spyOn(vscode.window, 'showQuickPick')
      .mockResolvedValue(undefined);
    await handler();
    const items = spy.mock.calls[0][0] as any[];
    const autoItem = items.find((i: any) => i.value === 'auto');
    expect(autoItem.description).toContain('Docusaurus');
  });

  it('current setting marked "(current)"', async () => {
    mockConfigManager.get.mockReturnValue('docusaurus');
    const spy = vi
      .spyOn(vscode.window, 'showQuickPick')
      .mockResolvedValue(undefined);
    await handler();
    const items = spy.mock.calls[0][0] as any[];
    const docItem = items.find((i: any) => i.value === 'docusaurus');
    expect(docItem.description).toBe('(current)');
  });

  it('selection sets config w/ Workspace scope, refreshes, shows info', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
      label: 'Docusaurus',
      value: 'docusaurus',
    } as any);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    await handler();
    expect(mockConfigManager.set).toHaveBeenCalledWith(
      'framework',
      'docusaurus',
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockPreviewManager.refreshAllPreviews).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Docusaurus')
    );
  });

  it('cancel → no changes', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    await handler();
    expect(mockConfigManager.set).not.toHaveBeenCalled();
    expect(mockPreviewManager.refreshAllPreviews).not.toHaveBeenCalled();
  });
});
