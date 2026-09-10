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
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    const binaryReads = new Map<string, ReturnType<typeof vi.fn>>();
    const encode = vi.spyOn(globalThis, 'btoa');
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('app.css')) {
        return new Response(
          '.from-link { background: url("./font.woff2"); color: red; }' +
            '.logo { background-image: url("./photo.png"); }'
        );
      }

      if (value.endsWith('font.woff2')) {
        return new Response('font', {
          headers: { 'Content-Type': 'font/woff2' },
        });
      }

      const response = new Response(
        value.includes('other.example.com') ? 'other' : 'abc',
        {
          headers: { 'Content-Type': 'image/png' },
        }
      );
      binaryReads.set(value, vi.spyOn(response, 'blob'));
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);

    document.head.innerHTML = `
      <link rel="stylesheet" href="https://example.com/app.css">
      <link rel="stylesheet" href="https://other.example.com/app.css">
    `;
    document.body.innerHTML = `
      <div class="mdx-preview-container">
        <div class="mdx-preview-content">
          <div class="markdown-body">
            <h1>Assets</h1>
            <img src="https://example.com/photo.png" srcset="photo-2x.png 2x">
            <img src="https://example.com/photo.png" alt="Repeated logo">
          </div>
        </div>
      </div>
    `;

    const html = await createExportableHtml();

    expect(html).toContain(
      '.from-link { background: url("data:font/woff2;base64,Zm9udA=="); color: red; }'
    );
    expect(html).toContain('src="data:image/png;base64,YWJj"');
    expect(html).toContain('url("data:image/png;base64,YWJj")');
    expect(html).toContain('url("data:image/png;base64,b3RoZXI=")');
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => String(url) === 'https://example.com/photo.png'
      )
    ).toHaveLength(1);
    expect(
      binaryReads.get('https://example.com/photo.png')
    ).toHaveBeenCalledTimes(1);
    expect(encode.mock.calls.filter(([bytes]) => bytes === 'abc')).toHaveLength(
      1
    );
    expect(binaryReads.has('https://other.example.com/photo.png')).toBe(true);
    expect(html).not.toContain('srcset=');
  });

  it('settles a partial export when response bodies stall after headers', async () => {
    vi.useFakeTimers();
    const stalledSignals: AbortSignal[] = [];
    const readStalledStylesheet = vi.fn();
    const readStalledImage = vi.fn(() => new Promise<Blob>(() => {}));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('ready.png')) {
          return new Response('ready', {
            headers: { 'Content-Type': 'image/png' },
          });
        }
        const signal = options.signal as AbortSignal;
        stalledSignals.push(signal);
        if (url.endsWith('stalled.css')) {
          readStalledStylesheet.mockImplementation(
            () =>
              new Promise<string>((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                  reject(new Error('body aborted'));
                });
              })
          );
          return { ok: true, text: readStalledStylesheet };
        }
        return { ok: true, blob: readStalledImage };
      })
    );
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://example.com/stalled.css">';
    document.body.innerHTML = `
      <div class="mdx-preview-container">
        <div class="mdx-preview-content">
          <h1>Partial export</h1>
          <p>Preserved content</p>
          <img src="https://example.com/stalled.png">
          <img src="https://example.com/ready.png">
        </div>
      </div>
    `;

    const pending = createExportableHtml();
    await vi.advanceTimersByTimeAsync(0);
    expect(readStalledStylesheet).toHaveBeenCalledTimes(1);
    expect(readStalledImage).toHaveBeenCalledTimes(1);
    expect(stalledSignals.every((signal) => !signal.aborted)).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    const html = await pending;

    expect(stalledSignals).toHaveLength(2);
    expect(stalledSignals.every((signal) => signal.aborted)).toBe(true);
    expect(html).toContain('<p>Preserved content</p>');
    expect(html).toContain('src="https://example.com/stalled.png"');
    expect(html).toContain('src="data:image/png;base64,cmVhZHk="');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('throws when no rendered preview content exists', async () => {
    await expect(createExportableHtml()).rejects.toThrow(
      'No rendered preview content is available to export.'
    );
  });
});
