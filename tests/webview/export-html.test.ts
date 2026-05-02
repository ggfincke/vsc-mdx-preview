// tests/webview/export-html.test.ts
// tests exportable HTML DOM snapshot generation
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExportableHtml } from '../../packages/webview-client/src/platform/rpc/export-html';

describe('createExportableHtml', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.className = '';
    document.body.className = '';
    document.title = 'MDX Preview';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports preview content w/ inline styles and CSS variables', async () => {
    document.documentElement.className = 'vscode-dark';
    document.documentElement.style.setProperty(
      '--vscode-editor-foreground',
      '#112233'
    );
    document.body.className = 'wordWrap';
    document.head.innerHTML = `
      <style>.markdown-body { color: var(--vscode-editor-foreground); }</style>
    `;
    document.body.innerHTML = `
      <div class="mdx-preview-container" data-mpe-theme-active="true" style="zoom: 1.2;">
        <div class="mdx-preview-stale-indicator">Outdated</div>
        <div class="mdx-preview-trust-banner">Trust warning</div>
        <div class="mdx-preview-content">
          <div class="markdown-body">
            <h1>Exported Page</h1>
            <p>Rendered content</p>
            <a href="javascript:alert('xss')">Unsafe link</a>
            <button onclick="alert('xss')">Unsafe button</button>
            <script>alert('xss')</script>
            <img src="data:image/png;base64,abc" alt="Already inline">
          </div>
        </div>
      </div>
    `;

    const html = await createExportableHtml();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Exported Page</title>');
    expect(html).toContain('class="vscode-dark"');
    expect(html).toContain('class="wordWrap"');
    expect(html).toContain(
      '.markdown-body { color: var(--vscode-editor-foreground); }'
    );
    expect(html).toContain('--vscode-editor-foreground: #112233;');
    expect(html).toContain('<p>Rendered content</p>');
    expect(html).toContain('src="data:image/png;base64,abc"');
    expect(html).toContain('<a>Unsafe link</a>');
    expect(html).toContain('<button>Unsafe button</button>');
    expect(html).not.toContain('Outdated');
    expect(html).not.toContain('Trust warning');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('zoom: 1.2');
  });

  it('inlines linked stylesheets and image sources when fetch succeeds', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('app.css')) {
        return new Response(
          '.from-link { background: url("./font.woff2"); color: red; }'
        );
      }

      if (value.endsWith('font.woff2')) {
        return new Response('font', {
          headers: { 'Content-Type': 'font/woff2' },
        });
      }

      return new Response('abc', {
        headers: { 'Content-Type': 'image/png' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    document.head.innerHTML =
      '<link rel="stylesheet" href="https://example.com/app.css">';
    document.body.innerHTML = `
      <div class="mdx-preview-container">
        <div class="mdx-preview-content">
          <div class="markdown-body">
            <h1>Assets</h1>
            <img src="https://example.com/photo.png" srcset="photo-2x.png 2x">
          </div>
        </div>
      </div>
    `;

    const html = await createExportableHtml();

    expect(html).toContain(
      '.from-link { background: url("data:font/woff2;base64,Zm9udA=="); color: red; }'
    );
    expect(html).toContain('src="data:image/png;base64,YWJj"');
    expect(html).not.toContain('srcset=');
  });

  it('throws when no rendered preview content exists', async () => {
    await expect(createExportableHtml()).rejects.toThrow(
      'No rendered preview content is available to export.'
    );
  });
});
