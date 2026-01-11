// packages/extension/test/module-fetcher.test.ts
// tests for module-fetcher image URI handling - verifies:
// 1. source code uses preview.getWebviewUri() for images (not vscode-resource://)
// 2. there's proper error handling when webview is not initialized
//
// ? note: we test source code content directly because module-fetcher has
// dependencies (typescript, sass) that are difficult to mock in unit tests.
// integration testing via VS Code extension host covers actual behavior.
//
// The image handling logic is now in handlers/ImageHandler.ts

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createMockWebview, Uri } from './__mocks__/vscode';

describe('module-fetcher image URI handling', () => {
  let imageHandlerSource: string;
  let moduleFetcherSource: string;

  beforeAll(() => {
    // Image handling is now in ImageHandler.ts
    const imageHandlerPath = path.join(
      __dirname,
      '../module-fetcher/handlers/ImageHandler.ts'
    );
    imageHandlerSource = fs.readFileSync(imageHandlerPath, 'utf-8');

    // Also read module-fetcher for no-deprecated-scheme check
    const moduleFetcherPath = path.join(
      __dirname,
      '../module-fetcher/module-fetcher.ts'
    );
    moduleFetcherSource = fs.readFileSync(moduleFetcherPath, 'utf-8');
  });

  describe('webview URI usage', () => {
    it('does NOT use deprecated vscode-resource:// scheme', () => {
      // The old code was: `module.exports = "vscode-resource://${fsPath}"`
      expect(imageHandlerSource).not.toContain('vscode-resource://');
      expect(moduleFetcherSource).not.toContain('vscode-resource://');
    });

    it('uses preview.getWebviewUri() for image paths', () => {
      // Should call getWebviewUri to convert paths
      expect(imageHandlerSource).toContain('preview.getWebviewUri(fsPath)');
    });

    it('handles image file extensions', () => {
      // Should have extensions listed for image handler
      expect(imageHandlerSource).toContain('.gif');
      expect(imageHandlerSource).toContain('.png');
      expect(imageHandlerSource).toContain('.jpg');
      expect(imageHandlerSource).toContain('.jpeg');
      expect(imageHandlerSource).toContain('.svg');
    });
  });

  describe('error handling', () => {
    it('checks if webviewUri is undefined', () => {
      // Should have a check for undefined webview URI
      expect(imageHandlerSource).toContain('if (!webviewUri)');
    });

    it('throws descriptive error when webview not initialized', () => {
      // Should include helpful error message
      expect(imageHandlerSource).toContain('Preview webview not initialized');
      expect(imageHandlerSource).toContain('cannot create webview URI');
    });

    it('includes the file path in the error message', () => {
      // Error should include fsPath for debugging (uses ModuleFetchError)
      expect(imageHandlerSource).toMatch(
        /throw new ModuleFetchError\([^)]*fsPath/
      );
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
