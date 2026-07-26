// tests/webview/safe-mode-processing.test.ts
// unit tests for safe-mode HTML sanitization & DOM injection
// @vitest-environment jsdom

import { act, createElement, useRef, type JSX, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSafeModeProcessing } from '../../packages/webview-client/src/features/preview/safe/hooks/useSafeModeProcessing';
import { STYLE_IDS } from '../../packages/webview-client/src/shared/utils/StyleInjector';

const SAFE_MODE_STYLE_ID = STYLE_IDS.SAFE_MODE;

interface HarnessProps {
  html: string;
  onRef?: (ref: RefObject<HTMLDivElement>) => void;
}

function SafeModeHarness({ html, onRef }: HarnessProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  useSafeModeProcessing(containerRef, html);

  if (onRef) {
    onRef(containerRef);
  }

  return createElement('div', { ref: containerRef });
}

function createMount(): {
  root: Root;
  host: HTMLElement;
  rerender: (html: string) => Promise<void>;
  unmount: () => Promise<void>;
} {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  return {
    root,
    host,
    rerender: async (html: string) => {
      await act(async () => {
        root.render(createElement(SafeModeHarness, { html }));
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

describe('useSafeModeProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    document
      .querySelectorAll(`#${SAFE_MODE_STYLE_ID}`)
      .forEach((node) => node.remove());
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
    document
      .querySelectorAll(`#${SAFE_MODE_STYLE_ID}`)
      .forEach((node) => node.remove());
  });

  it('injects sanitized HTML & reuses the Safe Mode style', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender('<h1>Hello</h1><p>World</p>');

    expect(host.querySelector('h1')?.textContent).toBe('Hello');
    expect(host.querySelector('p')?.textContent).toBe('World');
    expect(SAFE_MODE_STYLE_ID).toBe('mdx-safe-mode-styles');

    const safeModeStyle = document.getElementById(SAFE_MODE_STYLE_ID);
    const safeModeCss = safeModeStyle?.textContent;
    expect(safeModeStyle).toBeInstanceOf(HTMLStyleElement);
    expect(safeModeCss).toContain('.mdx-jsx-placeholder,');
    expect(safeModeCss).toContain('.mdx-expression-placeholder');
    expect(safeModeCss).toContain('.mdx-safe-preview');

    if (safeModeStyle) {
      safeModeStyle.textContent = 'stale';
    }
    await rerender('<h2>Updated</h2>');

    expect(document.getElementById(SAFE_MODE_STYLE_ID)).toBe(safeModeStyle);
    expect(safeModeStyle?.textContent).toBe(safeModeCss);
    expect(document.querySelectorAll(`#${SAFE_MODE_STYLE_ID}`)).toHaveLength(1);

    await unmount();
  });

  it('sanitizes unsafe payloads before DOM insertion', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender(
      '<script>alert("xss")</script><a href="javascript:alert(1)" onclick="alert(1)">bad</a><img src="x" onerror="alert(1)" />'
    );

    expect(host.querySelector('script')).toBeNull();
    expect(host.innerHTML).not.toContain('onclick');
    expect(host.innerHTML).not.toContain('onerror');
    expect(host.innerHTML).not.toContain('javascript:');

    await unmount();
  });

  it('preserves safe HTML elements & attributes', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender(
      '<a href="https://example.com">Link</a><img src="/cat.png" alt="cat" />'
    );

    const link = host.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');

    const img = host.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/cat.png');
    expect(img?.getAttribute('alt')).toBe('cat');

    await unmount();
  });
});
