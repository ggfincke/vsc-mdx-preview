// tests/extension/commands/cache.test.ts
// unit tests for cache clearing commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockClearResolverCache = vi.fn();
const mockClearSassCache = vi.fn();
const mockClearUnmanagedCaches = vi.fn();

const mockPreviewManager = {
  clearAllWebviewCaches: vi.fn(async () => {}),
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

vi.mock('../../../packages/extension-host/src/features/module-runtime/resolution/resolver-factory', () => ({
  clearResolverCache: (...args: any[]) => mockClearResolverCache(...args),
}));

vi.mock('../../../packages/extension-host/src/features/module-runtime/handlers', () => ({
  clearSassCache: (...args: any[]) => mockClearSassCache(...args),
}));

vi.mock('../../../packages/extension-host/src/app/lifecycle/cache-subsystem', () => ({
  clearUnmanagedCaches: (...args: any[]) => mockClearUnmanagedCaches(...args),
}));

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getPreviewManager: () => mockPreviewManager,
}));

import { commands } from '../../../packages/extension-host/src/features/commands/cache';

describe('cache commands', () => {
  const handler = commands.find(
    (c) => c.id === 'mdx-preview.commands.clearAllCaches'
  )!.handler;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls clearResolverCache', async () => {
    await handler();
    expect(mockClearResolverCache).toHaveBeenCalled();
  });

  it('calls clearSassCache', async () => {
    await handler();
    expect(mockClearSassCache).toHaveBeenCalled();
  });

  it('calls clearUnmanagedCaches', async () => {
    await handler();
    expect(mockClearUnmanagedCaches).toHaveBeenCalled();
  });

  it('calls clearAllWebviewCaches on preview manager', async () => {
    await handler();
    expect(mockPreviewManager.clearAllWebviewCaches).toHaveBeenCalled();
  });

  it('shows confirmation message', async () => {
    const spy = vi.spyOn(vscode.window, 'showInformationMessage');
    await handler();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('caches cleared')
    );
  });
});
