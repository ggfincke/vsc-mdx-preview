// tests/webview/safe-mode-processing.test.ts
// unit tests for safe-mode HTML post-processing hook behavior
//
// @vitest-environment jsdom

import { act, createElement, useRef, type JSX, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnhanceCodeBlocks } = vi.hoisted(() => ({
  mockEnhanceCodeBlocks: vi.fn(),
}));

vi.mock(
  '../../packages/webview-client/src/features/code-block/ui/CodeBlock',
  () => ({
    enhanceCodeBlocks: (...args: unknown[]) => mockEnhanceCodeBlocks(...args),
  })
);

import { useSafeModeProcessing } from '../../packages/webview-client/src/features/preview/safe/hooks/useSafeModeProcessing';

const SAFE_MODE_STYLE_ID = 'mdx-safe-mode-styles';

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

  it('adds target and rel for external links', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender('<a href="https://example.com/docs">External</a>');

    const external = host.querySelector('a');

    expect(external?.getAttribute('target')).toBe('_blank');
    expect(external?.getAttribute('rel')).toBe('noopener noreferrer');
    await unmount();
  });

  it('leaves hash links unchanged', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender('<a href="#section">Internal</a>');

    const internal = host.querySelector('a');
    expect(internal?.getAttribute('target')).toBeNull();
    expect(internal?.getAttribute('rel')).toBeNull();

    await unmount();
  });

  it('adds zoom-in cursor styling to images', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender('<img src="/cat.png" alt="cat" />');

    const image = host.querySelector('img');
    expect(image).toBeTruthy();
    expect((image as HTMLImageElement).style.cursor).toBe('zoom-in');

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

  it('injects safe-mode style tag only once across rerenders', async () => {
    const { rerender, unmount } = createMount();

    await rerender('<p>first</p>');
    await rerender('<p>second</p>');
    await rerender('<p>third</p>');

    const styleNodes = document.querySelectorAll(`#${SAFE_MODE_STYLE_ID}`);
    expect(styleNodes).toHaveLength(1);

    await unmount();
  });

  it('runs code-block enhancement after sanitized DOM is mounted', async () => {
    const { host, rerender, unmount } = createMount();

    await rerender(
      '<div class="mdx-preview-codeblock-shiki" data-code="const x = 1" data-language="ts"><pre><code>const x = 1</code></pre></div>'
    );

    expect(mockEnhanceCodeBlocks).toHaveBeenCalledTimes(1);

    const enhancementTarget = mockEnhanceCodeBlocks.mock.calls[0]?.[0] as
      | HTMLElement
      | undefined;
    expect(enhancementTarget).toBeTruthy();
    expect(
      enhancementTarget?.querySelector('.mdx-preview-codeblock-shiki')
    ).toBeTruthy();
    expect(host.querySelector('pre code')?.textContent).toContain(
      'const x = 1'
    );

    await unmount();
  });
});
