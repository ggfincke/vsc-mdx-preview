// tests/webview/safe-mode-processing.test.ts
// unit tests for safe-mode HTML sanitization & DOM injection
// @vitest-environment jsdom

import { act, createElement, useRef, type JSX, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCodeBlockEnhancement } from '../../packages/webview-client/src/features/code-block/hooks/useCodeBlockEnhancement';
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

function EnhancedSafeModeHarness({ html }: { html: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  useSafeModeProcessing(containerRef, html);
  useCodeBlockEnhancement({ containerRef, trigger: html });
  return createElement('div', {
    ref: containerRef,
    'data-code-block-root': 'true',
  });
}

function codeBlockHtml(
  index: number,
  language = 'ts',
  highlightLines = '2'
): string {
  return [
    `<div class="mdx-preview-codeblock-shiki" data-code="code-${index}"`,
    ` data-language="${language}" data-highlight-lines="${highlightLines}">`,
    '<pre><code><span class="line">first</span>',
    '<span class="line">second</span></code></pre></div>',
  ].join('');
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
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalClipboard = navigator.clipboard;
    document.body.innerHTML = '';
    document
      .querySelectorAll(`#${SAFE_MODE_STYLE_ID}`)
      .forEach((node) => node.remove());
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
    document
      .querySelectorAll(`#${SAFE_MODE_STYLE_ID}`)
      .forEach((node) => node.remove());
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    await rerender(
      '<script>alert("xss")</script><a href="javascript:alert(1)" onclick="alert(1)">bad</a><img src="x" onerror="alert(1)" />'
    );
    expect(host.querySelector('script')).toBeNull();
    expect(host.innerHTML).not.toContain('onclick');
    expect(host.innerHTML).not.toContain('onerror');
    expect(host.innerHTML).not.toContain('javascript:');

    await rerender(
      '<a href="https://example.com">Link</a><img src="/cat.png" alt="cat" />'
    );
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com'
    );
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/cat.png');
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('cat');

    await unmount();
  });

  it('delegates code-copy feedback across Safe replacements', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = async (html: string): Promise<void> => {
      await act(async () => {
        root.render(createElement(EnhancedSafeModeHarness, { html }));
      });
    };

    await render(
      Array.from({ length: 3 }, (_, index) => codeBlockHtml(index)).join('')
    );

    expect(host.querySelectorAll('.mdx-preview-codeblock-copy')).toHaveLength(
      3
    );
    expect(
      Array.from(
        host.querySelectorAll<HTMLButtonElement>('.mdx-preview-codeblock-copy')
      ).every((button) => button.type === 'button')
    ).toBe(true);

    const firstButton = host.querySelector<HTMLButtonElement>(
      '.mdx-preview-codeblock-copy'
    )!;
    const originalMarkup = firstButton.innerHTML;
    await act(async () => {
      firstButton
        .querySelector('path')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('code-0');
    expect(firstButton.classList.contains('copied')).toBe(true);
    expect(firstButton.innerHTML).not.toBe(originalMarkup);

    act(() => {
      vi.runAllTimers();
    });
    expect(firstButton.classList.contains('copied')).toBe(false);
    expect(firstButton.innerHTML).toBe(originalMarkup);

    writeText.mockRejectedValueOnce(new Error('clipboard unavailable'));
    await act(async () => {
      firstButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(firstButton.classList.contains('copied')).toBe(false);

    await act(async () => {
      firstButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(firstButton.classList.contains('copied')).toBe(true);

    await render(codeBlockHtml(999, 'js', '1'));
    const detachedMarkup = firstButton.innerHTML;
    expect(firstButton.isConnected).toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(host.querySelectorAll('.mdx-preview-codeblock-copy')).toHaveLength(
      1
    );
    expect(host.querySelector('.mdx-preview-codeblock-lang')?.textContent).toBe(
      'js'
    );
    expect(host.querySelector('.line.highlighted')?.textContent).toBe('first');

    act(() => {
      vi.runAllTimers();
    });
    expect(firstButton.innerHTML).toBe(detachedMarkup);

    await act(async () => {
      root.unmount();
    });
  });
});
