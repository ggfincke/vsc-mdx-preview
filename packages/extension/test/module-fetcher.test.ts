// packages/extension/test/module-fetcher.test.ts
// tests for module-fetcher.ts image URI handling - verifies:
// 1. source code uses preview.getWebviewUri() for images (not vscode-resource://)
// 2. there's proper error handling when webview is not initialized
//
// ? note: we test source code content directly because module-fetcher.ts
// has dependencies (typescript, sass) that are difficult to mock in unit tests.
// integration testing via VS Code extension host covers actual behavior.

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createMockWebview, Uri } from './__mocks__/vscode';

describe('module-fetcher image URI handling', () => {
  let moduleFetcherSource: string;

  beforeAll(() => {
    const moduleFetcherPath = path.join(
      __dirname,
      '../module-fetcher/module-fetcher.ts'
    );
    moduleFetcherSource = fs.readFileSync(moduleFetcherPath, 'utf-8');
  });

  describe('webview URI usage', () => {
    it('does NOT use deprecated vscode-resource:// scheme', () => {
      // The old code was: `module.exports = "vscode-resource://${fsPath}"`
      expect(moduleFetcherSource).not.toContain('vscode-resource://');
    });

    it('uses preview.getWebviewUri() for image paths', () => {
      // Should call getWebviewUri to convert paths
      expect(moduleFetcherSource).toContain('preview.getWebviewUri(fsPath)');
    });

    it('handles image file extensions', () => {
      // Should have a regex for image extensions (gif, png, jpg, jpeg, svg)
      expect(moduleFetcherSource).toContain('gif|png|jpe?g|svg');
    });
  });

  describe('error handling', () => {
    it('checks if webviewUri is undefined', () => {
      // Should have a check for undefined webview URI
      expect(moduleFetcherSource).toContain('if (!webviewUri)');
    });

    it('throws descriptive error when webview not initialized', () => {
      // Should include helpful error message
      expect(moduleFetcherSource).toContain('Preview webview not initialized');
      expect(moduleFetcherSource).toContain('cannot create webview URI');
    });

    it('includes the file path in the error message', () => {
      // Error should include fsPath for debugging
      expect(moduleFetcherSource).toMatch(/throw new Error\([^)]*\$\{fsPath\}/);
    });
  });
});

describe('Preview.getWebviewUri mock behavior', () => {
  // These tests verify our mock works correctly

  it('mock webview returns proper URI format', () => {
    const mockWebview = createMockWebview();
    const uri = mockWebview.asWebviewUri(Uri.file('/path/to/image.png'));

    expect(uri.toString()).toBe(
      'https://file+.vscode-resource.vscode-cdn.net/path/to/image.png'
    );
  });

  it('mock webview URI has correct scheme', () => {
    const mockWebview = createMockWebview();
    const uri = mockWebview.asWebviewUri(Uri.file('/test.jpg'));

    expect(uri.scheme).toBe('https');
  });

  it('mock webview preserves fsPath', () => {
    const mockWebview = createMockWebview();
    const testPath = '/workspace/assets/logo.svg';
    const uri = mockWebview.asWebviewUri(Uri.file(testPath));

    expect(uri.fsPath).toBe(testPath);
  });
});
