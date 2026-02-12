// tests/security/validateTrust.test.ts
// Unit tests for trust validation utilities

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define hoisted mocks
const { mockTrustManager } = vi.hoisted(() => ({
  mockTrustManager: {
    canExecute: vi.fn(() => true),
    getMode: vi.fn(() => 'trusted'),
    getState: vi.fn(() => ({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    })),
    getStateForDocument: vi.fn(() => ({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    })),
  },
}));

// Mock services
vi.mock('../../packages/extension-host/src/app/services', () => ({
  getTrustManager: () => mockTrustManager,
}));

// Mock vscode (minimal - just Uri for document tests)
vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
  },
}));

// Import after mocks
import {
  TrustError,
  isTrustedModeEnabled,
  isSecurityModeTrusted,
  requireTrustedMode,
  requireTrustedModeForDocument,
  tryRequireTrustedMode,
  tryRequireTrustedModeForDocument,
} from '../../packages/extension-host/src/features/security/validateTrust';
import { SecurityMode } from '../../packages/extension-host/src/features/security/TrustManager';

describe('TrustError', () => {
  it('is an instance of Error', () => {
    const error = new TrustError('Test error');
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "TrustError"', () => {
    const error = new TrustError('Test error');
    expect(error.name).toBe('TrustError');
  });

  it('stores the message', () => {
    const error = new TrustError('Test error message');
    expect(error.message).toBe('Test error message');
  });
});

describe('isTrustedModeEnabled()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when TrustManager.canExecute() is true', () => {
    mockTrustManager.canExecute.mockReturnValue(true);

    expect(isTrustedModeEnabled()).toBe(true);
    expect(mockTrustManager.canExecute).toHaveBeenCalled();
  });

  it('returns false when TrustManager.canExecute() is false', () => {
    mockTrustManager.canExecute.mockReturnValue(false);

    expect(isTrustedModeEnabled()).toBe(false);
    expect(mockTrustManager.canExecute).toHaveBeenCalled();
  });
});

describe('isSecurityModeTrusted()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when mode is SecurityMode.Trusted', () => {
    mockTrustManager.getMode.mockReturnValue(SecurityMode.Trusted);

    expect(isSecurityModeTrusted()).toBe(true);
  });

  it('returns false when mode is SecurityMode.Safe', () => {
    mockTrustManager.getMode.mockReturnValue(SecurityMode.Safe);

    expect(isSecurityModeTrusted()).toBe(false);
  });
});

describe('requireTrustedMode()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TrustState when canExecute is true', () => {
    const mockState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    mockTrustManager.getState.mockReturnValue(mockState);

    const result = requireTrustedMode('test operation');

    expect(result).toEqual(mockState);
  });

  it('throws TrustError when canExecute is false', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    expect(() => requireTrustedMode('custom components')).toThrow(TrustError);
  });

  it('includes operation name in error message', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    expect(() => requireTrustedMode('fetch module')).toThrow(
      /fetch module requires Trusted Mode/
    );
  });
});

describe('requireTrustedModeForDocument()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TrustState when document passes all checks', () => {
    const mockState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    mockTrustManager.getStateForDocument.mockReturnValue(mockState);

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };
    const result = requireTrustedModeForDocument(
      docUri as any,
      'test operation'
    );

    expect(result).toEqual(mockState);
    expect(mockTrustManager.getStateForDocument).toHaveBeenCalledWith(docUri);
  });

  it('throws TrustError when document fails trust check', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
      reason: 'Remote environment detected',
    });

    const docUri = { scheme: 'vscode-remote', fsPath: '/workspace/test.mdx' };

    expect(() =>
      requireTrustedModeForDocument(docUri as any, 'compile MDX')
    ).toThrow(TrustError);
  });

  it('includes reason in error message when available', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
      reason: 'Remote environment detected (ssh-remote)',
    });

    const docUri = { scheme: 'vscode-remote', fsPath: '/workspace/test.mdx' };

    expect(() =>
      requireTrustedModeForDocument(docUri as any, 'compile MDX')
    ).toThrow(/Remote environment detected/);
  });

  it('works without reason in trust state', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

    expect(() =>
      requireTrustedModeForDocument(docUri as any, 'open preview')
    ).toThrow(TrustError);
  });
});

describe('tryRequireTrustedModeForDocument()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TrustState when document passes all checks', () => {
    const mockState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    mockTrustManager.getStateForDocument.mockReturnValue(mockState);

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };
    const result = tryRequireTrustedModeForDocument(
      docUri as any,
      'test operation'
    );

    expect(result).toEqual(mockState);
  });

  it('returns undefined when TrustError is thrown', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };
    const result = tryRequireTrustedModeForDocument(
      docUri as any,
      'test operation'
    );

    expect(result).toBeUndefined();
  });

  it('calls onTrustError callback when TrustError is thrown', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const onTrustError = vi.fn();
    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

    tryRequireTrustedModeForDocument(
      docUri as any,
      'test operation',
      onTrustError
    );

    expect(onTrustError).toHaveBeenCalledTimes(1);
    expect(onTrustError).toHaveBeenCalledWith(expect.any(TrustError));
  });

  it('does not call callback when trust check passes', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });

    const onTrustError = vi.fn();
    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

    tryRequireTrustedModeForDocument(
      docUri as any,
      'test operation',
      onTrustError
    );

    expect(onTrustError).not.toHaveBeenCalled();
  });

  it('works without callback (callback is optional)', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };
    const result = tryRequireTrustedModeForDocument(
      docUri as any,
      'test operation'
    );

    expect(result).toBeUndefined();
  });

  it('re-throws non-TrustError exceptions', () => {
    const unexpectedError = new Error('Unexpected error');
    mockTrustManager.getStateForDocument.mockImplementation(() => {
      throw unexpectedError;
    });

    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

    expect(() =>
      tryRequireTrustedModeForDocument(docUri as any, 'test operation')
    ).toThrow(unexpectedError);
  });

  it('provides error message in callback', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
      reason: 'Workspace not trusted',
    });

    let capturedMessage = '';
    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

    tryRequireTrustedModeForDocument(docUri as any, 'load plugins', (error) => {
      capturedMessage = error.message;
    });

    expect(capturedMessage).toContain('load plugins');
    expect(capturedMessage).toContain('Trusted Mode');
  });
});

describe('tryRequireTrustedMode()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TrustState when trusted', () => {
    const mockState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    mockTrustManager.getState.mockReturnValue(mockState);

    const result = tryRequireTrustedMode('test operation');

    expect(result).toEqual(mockState);
  });

  it('returns undefined when not trusted', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const result = tryRequireTrustedMode('test operation');

    expect(result).toBeUndefined();
  });

  it('calls onTrustError callback when not trusted', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const onTrustError = vi.fn();
    tryRequireTrustedMode('test operation', onTrustError);

    expect(onTrustError).toHaveBeenCalledTimes(1);
    expect(onTrustError).toHaveBeenCalledWith(expect.any(TrustError));
  });

  it('does not call callback when trust check passes', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });

    const onTrustError = vi.fn();
    tryRequireTrustedMode('test operation', onTrustError);

    expect(onTrustError).not.toHaveBeenCalled();
  });

  it('works without callback (callback is optional)', () => {
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });

    const result = tryRequireTrustedMode('test operation');

    expect(result).toBeUndefined();
  });

  it('re-throws non-TrustError exceptions', () => {
    const unexpectedError = new Error('Service unavailable');
    mockTrustManager.getState.mockImplementation(() => {
      throw unexpectedError;
    });

    expect(() => tryRequireTrustedMode('test operation')).toThrow(
      unexpectedError
    );
  });
});
