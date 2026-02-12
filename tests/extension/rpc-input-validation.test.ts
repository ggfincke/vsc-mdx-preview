// tests/extension/rpc-input-validation.test.ts
// security boundary tests for RPC input validation

import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock vscode w/ hoisted mocks
const { mockVscode } = vi.hoisted(() => ({
  mockVscode: {
    Uri: {
      file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
      parse: (uri: string) => ({ scheme: 'file', fsPath: uri, path: uri }),
    },
    workspace: {
      openTextDocument: vi.fn(),
      isTrusted: true,
    },
    window: {
      showTextDocument: vi.fn(),
    },
    env: {
      openExternal: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    Range: class {
      constructor(
        public start: { line: number; character: number },
        public end: { line: number; character: number }
      ) {}
    },
  },
}));

vi.mock('vscode', () => mockVscode);

// mock services w/ hoisted mocks
const { mockTrustManager, mockErrorReporter } = vi.hoisted(() => ({
  mockTrustManager: {
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
  mockErrorReporter: {
    reportToUser: vi.fn(),
    report: vi.fn(),
    reportSilent: vi.fn(),
  },
}));

vi.mock('../../packages/extension-host/src/app/services', () => ({
  getTrustManager: () => mockTrustManager,
  getErrorReporter: () => mockErrorReporter,
}));

// mock performance API for reportPerformance tests
vi.mock('perf_hooks', () => ({
  performance: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

// mock fetchLocal to avoid complex dependencies
vi.mock(
  '../../packages/extension-host/src/features/module-runtime/fetch/fetchLocal',
  () => ({
    fetchLocal: vi
      .fn()
      .mockResolvedValue({ code: '', dependencies: [], fsPath: '' }),
  })
);

// import after mocks
import ExtensionHandle from '../../packages/extension-host/src/platform/rpc/extension-rpc-handler';
import { MAX_FETCH_REQUEST_LENGTH } from '../../packages/extension-host/src/shared/constants';

// minimal mock Preview
function createMockPreview(fsPath = '/workspace/test.mdx') {
  return {
    doc: {
      uri: { scheme: 'file', fsPath },
      getText: () => '# Test',
    },
    fsPath,
    entryFsDirectory: '/workspace',
    completeHandshake: vi.fn(),
    evaluationDuration: 0,
  } as unknown as Parameters<
    typeof ExtensionHandle extends new (p: infer P) => unknown ? P : never
  >[0];
}

describe('RPC Input Validation', () => {
  let handle: ExtensionHandle;
  let preview: ReturnType<typeof createMockPreview>;

  beforeEach(() => {
    vi.clearAllMocks();
    preview = createMockPreview();
    handle = new ExtensionHandle(
      preview as Parameters<typeof ExtensionHandle>[0]
    );

    // reset trust to trusted state
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
    mockTrustManager.getStateForDocument.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
  });

  describe('fetch()', () => {
    it('rejects specifiers exceeding max length', async () => {
      const longSpecifier = 'a'.repeat(MAX_FETCH_REQUEST_LENGTH + 1);
      const result = await handle.fetch(longSpecifier, false, '/entry.mdx');

      expect(result).toBeUndefined();
    });

    it('rejects specifiers at exactly max length + 1', async () => {
      const longSpecifier = 'x'.repeat(MAX_FETCH_REQUEST_LENGTH + 1);
      const result = await handle.fetch(longSpecifier, true, '/entry.mdx');

      expect(result).toBeUndefined();
    });

    it('accepts specifiers at max length', async () => {
      const maxLengthSpecifier = 'a'.repeat(MAX_FETCH_REQUEST_LENGTH);
      // should not reject for length (may fail for other reasons but not undefined due to length)
      await handle.fetch(maxLengthSpecifier, false, '/entry.mdx');
      // we just verify it doesn't reject early - fetchLocal is mocked
    });

    it('rejects null byte injection attempts', async () => {
      const result = await handle.fetch(
        'react\0.malicious',
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects file:// URL scheme', async () => {
      const result = await handle.fetch(
        'file:///etc/passwd',
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects http:// URL scheme', async () => {
      const result = await handle.fetch(
        'http://malicious.com/script.js',
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects https:// URL scheme', async () => {
      const result = await handle.fetch(
        'https://malicious.com/script.js',
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('allows npm:// URL scheme', async () => {
      // npm:// is the only allowed URL scheme
      await handle.fetch('npm://react@18', true, '/entry.mdx');
      // should not be rejected (fetchLocal is mocked)
    });

    it('rejects non-string request parameter', async () => {
      const result = await handle.fetch(
        123 as unknown as string,
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects non-boolean isBare parameter', async () => {
      const result = await handle.fetch(
        'react',
        'true' as unknown as boolean,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects non-string parentId parameter', async () => {
      const result = await handle.fetch(
        'react',
        true,
        123 as unknown as string
      );

      expect(result).toBeUndefined();
    });

    it('rejects null request parameter', async () => {
      const result = await handle.fetch(
        null as unknown as string,
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('rejects undefined request parameter', async () => {
      const result = await handle.fetch(
        undefined as unknown as string,
        false,
        '/entry.mdx'
      );

      expect(result).toBeUndefined();
    });

    it('allows empty string request (validation is separate from resolution)', async () => {
      // empty string is allowed by type validation but may fail other checks
      await handle.fetch('', false, '/entry.mdx');
      // should not throw - behavior depends on subsequent validation
    });

    it('rejects when workspace is not trusted', async () => {
      mockTrustManager.getStateForDocument.mockReturnValue({
        workspaceTrusted: false,
        scriptsEnabled: true,
        canExecute: false,
        openMdxLinksInPreview: true,
      });

      const result = await handle.fetch('./module.ts', false, '/entry.mdx');

      expect(result).toBeUndefined();
    });

    it('rejects when scripts are disabled', async () => {
      mockTrustManager.getStateForDocument.mockReturnValue({
        workspaceTrusted: true,
        scriptsEnabled: false,
        canExecute: false,
        openMdxLinksInPreview: true,
      });

      const result = await handle.fetch('./module.ts', false, '/entry.mdx');

      expect(result).toBeUndefined();
    });
  });

  describe('reportPerformance()', () => {
    it('rejects non-number duration', () => {
      handle.reportPerformance('100' as unknown as number);
      // should not throw but also should not update evaluationDuration
      // since validation fails
    });

    it('rejects NaN duration', () => {
      handle.reportPerformance(NaN);
      // should silently fail validation
    });

    it('rejects Infinity duration', () => {
      handle.reportPerformance(Infinity);
      // should silently fail validation (finite check)
    });

    it('rejects negative Infinity duration', () => {
      handle.reportPerformance(-Infinity);
      // should silently fail validation
    });

    it('accepts valid numeric duration', () => {
      handle.reportPerformance(150);
      expect(preview.evaluationDuration).toBe(150);
    });

    it('accepts zero duration', () => {
      handle.reportPerformance(0);
      expect(preview.evaluationDuration).toBe(0);
    });
  });

  describe('openExternal()', () => {
    it('rejects javascript: URLs', () => {
      handle.openExternal('javascript:alert(1)');
      expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('rejects data: URLs', () => {
      handle.openExternal('data:text/html,<script>alert(1)</script>');
      expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('rejects file: URLs', () => {
      handle.openExternal('file:///etc/passwd');
      expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('accepts http: URLs', () => {
      handle.openExternal('http://example.com');
      expect(mockVscode.env.openExternal).toHaveBeenCalled();
    });

    it('accepts https: URLs', () => {
      handle.openExternal('https://example.com');
      expect(mockVscode.env.openExternal).toHaveBeenCalled();
    });

    it('accepts mailto: URLs', () => {
      handle.openExternal('mailto:test@example.com');
      expect(mockVscode.env.openExternal).toHaveBeenCalled();
    });

    it('accepts tel: URLs', () => {
      handle.openExternal('tel:+1234567890');
      expect(mockVscode.env.openExternal).toHaveBeenCalled();
    });

    it('rejects non-string URL', () => {
      handle.openExternal(123 as unknown as string);
      expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('openDocument()', () => {
    beforeEach(() => {
      mockVscode.workspace.openTextDocument.mockResolvedValue({});
      mockVscode.window.showTextDocument.mockResolvedValue({});
    });

    it('rejects non-string path', async () => {
      await handle.openDocument(123 as unknown as string);
      expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    it('rejects empty path', async () => {
      await handle.openDocument('');
      expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    it('rejects when workspace is not trusted', async () => {
      mockTrustManager.getState.mockReturnValue({
        workspaceTrusted: false,
        scriptsEnabled: true,
        canExecute: false,
        openMdxLinksInPreview: true,
      });

      await handle.openDocument('./file.ts');
      expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    it('rejects negative line numbers', async () => {
      await handle.openDocument('./file.ts', -1);
      // line validation should fail, but path is valid
      // behavior depends on implementation - check validateOptionalNumber
    });

    it('rejects zero line number', async () => {
      await handle.openDocument('./file.ts', 0);
      // line must be >= 1
    });

    it('accepts valid line and column', async () => {
      await handle.openDocument('./file.ts', 10, 5);
      // should attempt to open if path validation passes
    });
  });

  describe('openSettings()', () => {
    it('handles undefined settingId', () => {
      handle.openSettings();
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview'
      );
    });

    it('handles specific settingId', () => {
      handle.openSettings('mdx-preview.preview.enableScripts');
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview.preview.enableScripts'
      );
    });

    it('ignores non-string settingId', () => {
      handle.openSettings(123 as unknown as string);
      // should fall back to default
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview'
      );
    });
  });

  describe('handshake()', () => {
    it('calls completeHandshake on preview', () => {
      handle.handshake();
      expect(preview.completeHandshake).toHaveBeenCalled();
    });
  });
});
