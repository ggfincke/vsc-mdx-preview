// tests/webview/SafePreview.test.ts
// verify representative safe-mode sanitization boundaries & lightbox wiring
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createElement, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../../packages/webview-client/src/features/preview/safe/security/allowlist';

// stub heavy diagram coordinator so usePreviewSetup keeps the real lightbox handler
vi.mock(
  '../../packages/webview-client/src/features/diagrams/hooks/useDiagramScanCoordinator',
  () => ({
    useDiagramScanCoordinator: () => ({
      renderPortals: () => null,
      scan: vi.fn(),
    }),
  })
);

// stub unrelated interaction wiring (scroll sync, code-block, katex)
vi.mock(
  '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewInteractions',
  () => ({
    usePreviewInteractions: () => undefined,
  })
);

describe('SafePreview sanitization', () => {
  it('strips script tags', () => {
    const result = DOMPurify.sanitize(
      '<div><script>alert("xss")</script>safe</div>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toContain('<script');
    expect(result).toContain('safe');
  });

  it('strips event handler attributes', () => {
    const result = DOMPurify.sanitize(
      '<img src=x onerror="alert(1)"><div onclick="malicious()">x</div>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/on\w+=/);
  });

  it('strips script and foreignObject content from SVG payloads', () => {
    const result = DOMPurify.sanitize(
      '<svg><script>alert(1)</script><foreignObject><div onclick="xss()">test</div></foreignObject></svg>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toContain('<script');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('onclick');
  });

  it('strips dangerous protocols from links', () => {
    const result = DOMPurify.sanitize(
      '<a href="javascript:alert(1)">click</a><a href="data:text/html,test">x</a>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/javascript:|data:/);
  });

  it('strips form and iframe embedding vectors', () => {
    const result = DOMPurify.sanitize(
      '<form action="https://evil.com"><input name="pw"></form><iframe src="https://evil.com"></iframe>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/<(form|iframe|input)/);
  });

  it('preserves standard markdown-rendered HTML', () => {
    const result = DOMPurify.sanitize(
      '<h1>Title</h1><p>Text w/ <strong>bold</strong> & <em>italic</em></p>',
      DOMPURIFY_CONFIG
    );

    expect(result).toContain('<h1>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  // pin WC-3: clicking an img inside the safe preview opens the lightbox
  it('opens the lightbox when an img inside the safe preview is clicked', async () => {
    const { SafePreviewRenderer } = await import(
      '../../packages/webview-client/src/features/preview/safe/SafePreview'
    );
    const { LightboxProvider, useLightbox } = await import(
      '../../packages/webview-client/src/app/state/LightboxContext'
    );

    let openedSrc: string | null = null;
    function LightboxProbe() {
      const { isOpen, currentImage } = useLightbox();
      useEffect(() => {
        if (isOpen && currentImage) {
          openedSrc = currentImage.src;
        }
      });
      return null;
    }

    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        createElement(
          LightboxProvider,
          null,
          createElement(SafePreviewRenderer, {
            html: '<p><img src="https://example.test/cat.png" alt="cat"></p>',
          }),
          createElement(LightboxProbe)
        )
      );
    });

    const img = host.querySelector('img');
    expect(img).toBeTruthy();

    act(() => {
      img!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });

    expect(openedSrc).toBe('https://example.test/cat.png');

    act(() => {
      root.unmount();
    });
    document.body.removeChild(host);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });
});
