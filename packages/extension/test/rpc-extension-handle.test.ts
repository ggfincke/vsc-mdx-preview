// packages/extension/test/rpc-extension-handle.test.ts
// unit tests for ExtensionHandle (RPC methods exposed to webview)

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __setMockWorkspaceFolders,
  __resetMocks,
  commands,
  env,
  workspace,
  window,
} from './__mocks__/vscode';
import { TrustManager } from '../security/TrustManager';
import { handleDidChangeWorkspaceFolders } from '../security/checkFsPath';

// mock module-fetcher
vi.mock('../module-fetcher/module-fetcher', () => ({
  fetchLocal: vi.fn(),
  FetchResult: {},
}));

// mock logging to suppress output during tests
vi.mock('../logging', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

// import after mocks are set up
import ExtensionHandle from '../rpc-extension-handle';
import { fetchLocal } from '../module-fetcher/module-fetcher';
import type { Preview } from '../preview/preview-manager';

// create mock Preview object
const createMockPreview = (overrides: Partial<Preview> = {}): Preview =>
  ({
    entryFsDirectory: '/projects/test-workspace/src',
    resolveWebviewHandshakePromise: vi.fn(),
    evaluationDuration: 0,
    ...overrides,
  }) as unknown as Preview;

// reset TrustManager singleton between tests
const resetTrustManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('ExtensionHandle', () => {
  let handle: ExtensionHandle;
  let mockPreview: Preview;

  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
    handleDidChangeWorkspaceFolders();
    vi.clearAllMocks();

    __setMockWorkspaceFolders([
      { uri: { fsPath: '/projects/test-workspace' } },
    ]);
    handleDidChangeWorkspaceFolders();

    mockPreview = createMockPreview();
    handle = new ExtensionHandle(mockPreview);
  });

  afterEach(() => {
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // ignore if already disposed
    }
    resetTrustManager();
  });

  describe('handshake', () => {
    test('resolves preview handshake promise', () => {
      handle.handshake();
      expect(mockPreview.resolveWebviewHandshakePromise).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('reportPerformance', () => {
    test('records valid evaluation duration', () => {
      // set up the required performance mark first
      performance.mark('preview/start');
      handle.reportPerformance(123.45);
      expect(mockPreview.evaluationDuration).toBe(123.45);
      // clean up performance entries
      performance.clearMarks();
      performance.clearMeasures();
    });

    test('rejects non-number values', () => {
      // @ts-expect-error testing invalid input
      handle.reportPerformance('not a number');
      expect(mockPreview.evaluationDuration).toBe(0);
    });

    test('rejects Infinity', () => {
      handle.reportPerformance(Infinity);
      expect(mockPreview.evaluationDuration).toBe(0);
    });

    test('rejects NaN', () => {
      handle.reportPerformance(NaN);
      expect(mockPreview.evaluationDuration).toBe(0);
    });

    test('rejects negative Infinity', () => {
      handle.reportPerformance(-Infinity);
      expect(mockPreview.evaluationDuration).toBe(0);
    });
  });

  describe('fetch - input validation', () => {
    beforeEach(() => {
      // enable trust so we can test input validation
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);
    });

    test('rejects when request is not a string', async () => {
      // @ts-expect-error testing invalid input
      const result = await handle.fetch(123, false, '/parent.js');
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects when isBare is not a boolean', async () => {
      // @ts-expect-error testing invalid input
      const result = await handle.fetch('./module.js', 'true', '/parent.js');
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects when parentId is not a string', async () => {
      // @ts-expect-error testing invalid input
      const result = await handle.fetch('./module.js', false, 123);
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects requests containing null bytes', async () => {
      const result = await handle.fetch(
        './module\0.js',
        false,
        '/projects/test-workspace/src/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects requests exceeding 2048 character limit', async () => {
      const longPath = './module/' + 'a'.repeat(2050) + '.js';
      const result = await handle.fetch(
        longPath,
        false,
        '/projects/test-workspace/src/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects javascript: URL scheme', async () => {
      const result = await handle.fetch(
        'javascript://alert(1)',
        false,
        '/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects data: URL scheme', async () => {
      const result = await handle.fetch(
        'data://text/html,<script>alert(1)</script>',
        false,
        '/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects file: URL scheme', async () => {
      const result = await handle.fetch(
        'file:///etc/passwd',
        false,
        '/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects http: URL scheme', async () => {
      const result = await handle.fetch(
        'http://evil.com/malware.js',
        false,
        '/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('rejects https: URL scheme', async () => {
      const result = await handle.fetch(
        'https://evil.com/malware.js',
        false,
        '/parent.js'
      );
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('accepts npm:// scheme (special case)', async () => {
      vi.mocked(fetchLocal).mockResolvedValueOnce({
        fsPath: '/node_modules/react/index.js',
        code: 'export default {}',
        dependencies: [],
      });

      const result = await handle.fetch('npm://react', true, '/parent.js');
      expect(fetchLocal).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('accepts valid relative paths', async () => {
      vi.mocked(fetchLocal).mockResolvedValueOnce({
        fsPath: '/projects/test-workspace/src/module.js',
        code: 'export default {}',
        dependencies: [],
      });

      const result = await handle.fetch('./module.js', false, '/parent.js');
      expect(fetchLocal).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('accepts bare imports', async () => {
      vi.mocked(fetchLocal).mockResolvedValueOnce({
        fsPath: '/node_modules/lodash/get.js',
        code: 'export default {}',
        dependencies: [],
      });

      const result = await handle.fetch('lodash/get', true, '/parent.js');
      expect(fetchLocal).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('fetch - trust gating', () => {
    test('returns undefined when canExecute is false (workspace not trusted)', async () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', true);

      const result = await handle.fetch('./module.js', false, '/parent.js');
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('returns undefined when canExecute is false (scripts disabled)', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      const result = await handle.fetch('./module.js', false, '/parent.js');
      expect(result).toBeUndefined();
      expect(fetchLocal).not.toHaveBeenCalled();
    });

    test('calls fetchLocal when trust conditions are met', async () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      vi.mocked(fetchLocal).mockResolvedValueOnce({
        fsPath: '/projects/test-workspace/src/module.js',
        code: 'export default {}',
        dependencies: [],
      });

      const result = await handle.fetch('./module.js', false, '/parent.js');
      expect(fetchLocal).toHaveBeenCalledWith(
        './module.js',
        false,
        '/parent.js',
        mockPreview
      );
      expect(result).toBeDefined();
    });
  });

  describe('openSettings', () => {
    test('opens MDX preview settings when no settingId provided', () => {
      handle.openSettings();
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview'
      );
    });

    test('opens specific setting when settingId provided', () => {
      handle.openSettings('mdx-preview.preview.enableScripts');
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview.preview.enableScripts'
      );
    });

    test('ignores non-string settingId', () => {
      // @ts-expect-error testing invalid input
      handle.openSettings(123);
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'mdx-preview'
      );
    });
  });

  describe('manageTrust', () => {
    test('opens workspace trust management', () => {
      handle.manageTrust();
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.trust.manage'
      );
    });
  });

  describe('openExternal - URL scheme validation', () => {
    test('allows http: URLs', () => {
      handle.openExternal('http://example.com');
      expect(env.openExternal).toHaveBeenCalled();
    });

    test('allows https: URLs', () => {
      handle.openExternal('https://example.com');
      expect(env.openExternal).toHaveBeenCalled();
    });

    test('allows mailto: URLs', () => {
      handle.openExternal('mailto:test@example.com');
      expect(env.openExternal).toHaveBeenCalled();
    });

    test('allows tel: URLs', () => {
      handle.openExternal('tel:+1234567890');
      expect(env.openExternal).toHaveBeenCalled();
    });

    test('rejects javascript: URLs', () => {
      handle.openExternal('javascript:alert(1)');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects data: URLs', () => {
      handle.openExternal('data:text/html,<script>alert(1)</script>');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects file: URLs', () => {
      handle.openExternal('file:///etc/passwd');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects vscode: URLs', () => {
      handle.openExternal('vscode://extension.command');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects custom scheme URLs', () => {
      handle.openExternal('custom://malicious');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects empty URL', () => {
      handle.openExternal('');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects whitespace-only URL', () => {
      handle.openExternal('   ');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects malformed URLs', () => {
      handle.openExternal('not a valid url');
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    test('rejects non-string input', () => {
      // @ts-expect-error testing invalid input
      handle.openExternal(123);
      expect(env.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('openDocument - path validation', () => {
    test('rejects empty path', async () => {
      await handle.openDocument('');
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('rejects whitespace-only path', async () => {
      await handle.openDocument('   ');
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('rejects non-string path', async () => {
      // @ts-expect-error testing invalid input
      await handle.openDocument(123);
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('rejects when no entry directory', async () => {
      const previewNoDir = createMockPreview({ entryFsDirectory: undefined });
      const handleNoDir = new ExtensionHandle(previewNoDir);

      await handleNoDir.openDocument('./file.ts');
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('rejects paths outside workspace (path traversal)', async () => {
      await handle.openDocument('../../../etc/passwd');
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
      expect(window.showWarningMessage).toHaveBeenCalledWith(
        'Cannot open file outside workspace folder.'
      );
    });

    test('rejects absolute paths outside workspace', async () => {
      await handle.openDocument('/etc/passwd');
      expect(workspace.openTextDocument).not.toHaveBeenCalled();
      expect(window.showWarningMessage).toHaveBeenCalled();
    });

    test('accepts valid relative paths within workspace', async () => {
      await handle.openDocument('./component.tsx');
      expect(workspace.openTextDocument).toHaveBeenCalled();
      expect(window.showTextDocument).toHaveBeenCalled();
    });

    test('accepts paths in parent directory still within workspace', async () => {
      await handle.openDocument('../package.json');
      expect(workspace.openTextDocument).toHaveBeenCalled();
      expect(window.showTextDocument).toHaveBeenCalled();
    });
  });

  describe('openDocument - line/column validation', () => {
    test('validates line number must be >= 1', async () => {
      await handle.openDocument('./file.ts', 0);
      // should still open document, but line is reset to undefined
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    test('validates column number must be >= 1', async () => {
      await handle.openDocument('./file.ts', 5, 0);
      // should still open document, but column is reset to undefined
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    test('rejects negative line numbers', async () => {
      await handle.openDocument('./file.ts', -1);
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    test('rejects non-number line values', async () => {
      // @ts-expect-error testing invalid input
      await handle.openDocument('./file.ts', 'five');
      expect(workspace.openTextDocument).toHaveBeenCalled();
    });

    test('opens document with valid line and column', async () => {
      await handle.openDocument('./file.ts', 10, 5);
      expect(workspace.openTextDocument).toHaveBeenCalled();
      expect(window.showTextDocument).toHaveBeenCalled();
    });
  });

  describe('openDocument - error handling', () => {
    test('shows error message when document open fails', async () => {
      vi.mocked(workspace.openTextDocument).mockRejectedValueOnce(
        new Error('File not found')
      );

      await handle.openDocument('./nonexistent.ts');
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Could not open file: ./nonexistent.ts'
      );
    });
  });
});
