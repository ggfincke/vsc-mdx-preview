// tests/webview/source-line-highlight.test.ts
// tests source-line hover & click navigation binding
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useSourceLineHighlight } from '../../packages/webview-client/src/features/preview/shared/hooks/useSourceLineHighlight';
import { findActivePreviewSourceLine } from '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewScrollSync';
import {
  findBestSourceLineEntry,
  scheduleScrollToSourceLine,
  scrollToSourceLine,
} from '../../packages/webview-client/src/features/preview/shared/utils/scrollToSourceLine';

interface HarnessProps {
  children: ReactNode;
  onOpenSourceLine?: (line: number) => void;
  enabled?: boolean;
}

function Harness({ children, onOpenSourceLine, enabled = true }: HarnessProps) {
  const ref = useRef<HTMLDivElement>(null);
  useSourceLineHighlight({
    containerRef: ref,
    trigger: 'ready',
    enabled,
    onOpenSourceLine,
  });

  return createElement('div', { ref }, children);
}

let mountedRoot: Root | undefined;
let originalRequestAnimationFrame:
  | typeof window.requestAnimationFrame
  | undefined;

async function mountHarness(
  children: ReactNode,
  onOpenSourceLine?: (line: number) => void,
  enabled = true
): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  mountedRoot = createRoot(host);

  await act(async () => {
    mountedRoot?.render(
      createElement(Harness, { onOpenSourceLine, enabled }, children)
    );
  });

  return host;
}

function setElementTop(element: Element, top: number): void {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        top,
        left: 0,
        bottom: top + 20,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect
  );
}

function renderMappedPreview(): HTMLElement {
  document.body.innerHTML = `
    <div class="mdx-preview-content">
      <div class="markdown-body">
        <p id="line-5" data-source-line="5">First</p>
        <p id="line-12" data-source-line="12">Second</p>
        <p id="line-24" data-source-line="24">Third</p>
      </div>
    </div>
  `;

  return document.querySelector('.markdown-body') as HTMLElement;
}

describe('useSourceLineHighlight', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    act(() => {
      mountedRoot?.unmount();
    });
    mountedRoot = undefined;
    document.body.innerHTML = '';
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    if (originalRequestAnimationFrame) {
      Object.defineProperty(window, 'requestAnimationFrame', {
        value: originalRequestAnimationFrame,
        writable: true,
      });
    } else {
      delete (window as Partial<Window>).requestAnimationFrame;
    }
    originalRequestAnimationFrame = undefined;
    vi.restoreAllMocks();
  });

  it('opens the source line on Ctrl-click for mapped elements', async () => {
    const onOpenSourceLine = vi.fn();
    const host = await mountHarness(
      createElement('p', { 'data-source-line': '12' }, 'Mapped paragraph'),
      onOpenSourceLine
    );
    const paragraph = host.querySelector('p')!;

    act(() => {
      paragraph.dispatchEvent(new MouseEvent('mouseenter'));
    });
    act(() => {
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          button: 0,
        })
      );
    });

    expect(onOpenSourceLine).toHaveBeenCalledWith(12);
    expect(paragraph.classList.contains('highlight-line')).toBe(true);
    expect(paragraph.classList.contains('highlight-active')).toBe(true);
  });

  it('promotes child source lines to their highlight owner', async () => {
    const onOpenSourceLine = vi.fn();
    const host = await mountHarness(
      createElement(
        'p',
        null,
        createElement('img', {
          src: 'data:image/png;base64,abc',
          'data-source-line': '27',
        })
      ),
      onOpenSourceLine
    );
    const paragraph = host.querySelector('p')!;

    act(() => {
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        })
      );
    });

    expect(onOpenSourceLine).toHaveBeenCalledWith(27);
  });

  it('ignores non-navigation and interactive clicks', async () => {
    const onOpenSourceLine = vi.fn();
    const host = await mountHarness(
      createElement(
        'p',
        { 'data-source-line': '8' },
        createElement('a', { href: 'https://example.com' }, 'Link')
      ),
      onOpenSourceLine
    );
    const link = host.querySelector('a')!;
    const paragraph = host.querySelector('p')!;
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });

    act(() => {
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        })
      );
    });
    act(() => {
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          button: 0,
        })
      );
    });

    expect(onOpenSourceLine).not.toHaveBeenCalled();
  });

  it('resolves exact, nearest, and scheduled scroll targets', () => {
    const container = renderMappedPreview();
    const exactTarget = document.getElementById('line-12')!;
    setElementTop(exactTarget, 180);

    expect(scrollToSourceLine(12)).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 120,
      behavior: 'auto',
    });
    expect(findBestSourceLineEntry(container, 18)?.highlightElement).toBe(
      exactTarget
    );
    expect(findBestSourceLineEntry(container, 2)?.highlightElement).toBe(
      document.getElementById('line-5')
    );

    setElementTop(document.getElementById('line-5')!, -40);
    setElementTop(document.getElementById('line-12')!, 160);
    setElementTop(document.getElementById('line-24')!, 320);
    expect(findActivePreviewSourceLine(container, 600)).toBe(12);

    const frames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
      writable: true,
    });
    const latestTarget = document.getElementById('line-24')!;
    setElementTop(latestTarget, 260);
    vi.mocked(window.scrollTo).mockClear();

    scheduleScrollToSourceLine(5);
    scheduleScrollToSourceLine(24);

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    frames[0](100);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'auto',
    });

    document.body.innerHTML = '<div class="mdx-preview-content"></div>';
    expect(scrollToSourceLine(0)).toBe(false);
    expect(scrollToSourceLine(10)).toBe(false);
  });
});
