// tests/security/validateTrust.test.ts
// verify representative trust assertion boundaries

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockTrustManager } from '../helpers/mock-services';

vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
  },
}));

import {
  requireTrustedModeForDocument,
  TrustError,
  tryRequireTrustedModeForDocument,
  tryRequireWorkspaceTrusted,
} from '../../packages/extension-host/src/features/security/validateTrust';

describe('validateTrust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TrustState when a document passes trust checks', () => {
    const mockState = {
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    };
    const docUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };
    mockTrustManager.getStateForDocument.mockReturnValue(mockState);

    expect(requireTrustedModeForDocument(docUri as never, 'compile MDX')).toEqual(
      mockState
    );
  });

  it('includes the trust failure reason in document errors', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
      reason: 'Remote environment detected (ssh-remote)',
    });

    expect(() =>
      requireTrustedModeForDocument(
        { scheme: 'vscode-remote', fsPath: '/workspace/test.mdx' } as never,
        'compile MDX'
      )
    ).toThrow(/Remote environment detected/);
  });

  it('invokes onTrustError callbacks for document trust failures', () => {
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: false,
      scriptsEnabled: true,
      canExecute: false,
      openMdxLinksInPreview: true,
    });
    const onTrustError = vi.fn();

    tryRequireTrustedModeForDocument(
      { scheme: 'file', fsPath: '/workspace/test.mdx' } as never,
      'test operation',
      onTrustError
    );

    expect(onTrustError).toHaveBeenCalledWith(expect.any(TrustError));
  });

  it('re-throws non-trust errors from tryRequireWorkspaceTrusted', () => {
    const unexpectedError = new Error('Service unavailable');
    mockTrustManager.getState.mockImplementation(() => {
      throw unexpectedError;
    });

    expect(() => tryRequireWorkspaceTrusted('test operation')).toThrow(
      unexpectedError
    );
  });
});
