// tests/webview/source-line-highlight.test.ts
// tests source-line hover, click navigation & preview scroll sync
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO } from '@mdx-preview/contracts';

const { mockReportPreviewSourceLine } = vi.hoisted(() => ({
  mockReportPreviewSourceLine: vi.fn(async () => 'accepted'),
}));

vi.mock(
  '../../packages/webview-client/src/platform/rpc/webview-rpc-client',
  () => ({
    ExtensionHandle: {
      reportPreviewSourceLine: mockReportPreviewSourceLine,
    },
  })
);

import { useSourceLineHighlight } from '../../packages/webview-client/src/features/preview/shared/hooks/useSourceLineHighlight';
import {
  findActivePreviewSourceLine,
  usePreviewScrollSync,
} from '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewScrollSync';
import {
  findBestSourceLineEntry,
  flushPendingScrollToSourceLine,
  isSourceLineScrollInProgress,
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

function ScrollSyncHarness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usePreviewScrollSync({
    containerRef: ref,
    trigger: 'ready',
    mode: 'previewToEditor',
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

async function mountScrollSyncHarness(
  children: ReactNode
): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  mountedRoot = createRoot(host);

  await act(async () => {
    mountedRoot?.render(createElement(ScrollSyncHarness, null, children));
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
    mockReportPreviewSourceLine.mockReset();
    mockReportPreviewSourceLine.mockResolvedValue('accepted');
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
    vi.useRealTimers();
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

  it('animates, coalesces, and defers source-line scroll targets', () => {
    const container = renderMappedPreview();
    const exactTarget = document.getElementById('line-12')!;
    const scrollAnchorY =
      window.innerHeight * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO;
    setElementTop(exactTarget, scrollAnchorY + 120);

    const frames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
      writable: true,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: vi.fn(),
      writable: true,
    });

    expect(scrollToSourceLine(12)).toBe(true);
    expect(window.scrollTo).not.toHaveBeenCalled();
    frames.shift()?.(0);
    frames.shift()?.(120);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 120,
      behavior: 'auto',
    });

    expect(findBestSourceLineEntry(container, 18)?.highlightElement).toBe(
      exactTarget
    );
    expect(findBestSourceLineEntry(container, 2)?.highlightElement).toBe(
      document.getElementById('line-5')
    );

    const table = document.createElement('table');
    const tableBody = document.createElement('tbody');
    const tableRow = document.createElement('tr');
    const tableLaterRow = document.createElement('tr');
    tableRow.setAttribute('data-source-line', '40');
    tableLaterRow.setAttribute('data-source-line', '48');
    tableBody.appendChild(tableRow);
    tableBody.appendChild(tableLaterRow);
    table.appendChild(tableBody);
    container.appendChild(table);
    const tableEntry = findBestSourceLineEntry(container, 40);
    expect(tableEntry?.highlightElement).toBe(table);
    expect(tableEntry?.targetElement).toBe(tableRow);
    setElementTop(table, scrollAnchorY + 20);
    setElementTop(tableRow, scrollAnchorY + 180);
    setElementTop(tableLaterRow, scrollAnchorY + 5);
    vi.mocked(window.scrollTo).mockClear();
    frames.length = 0;
    expect(scrollToSourceLine(40)).toBe(true);
    frames.shift()?.(140);
    frames.shift()?.(260);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 180,
      behavior: 'auto',
    });
    expect(findActivePreviewSourceLine(container, 600)).toBe(48);
    table.remove();

    setElementTop(document.getElementById('line-5')!, -40);
    setElementTop(document.getElementById('line-12')!, 160);
    setElementTop(document.getElementById('line-24')!, 320);
    expect(findActivePreviewSourceLine(container, 600)).toBe(12);

    setElementTop(document.getElementById('line-5')!, 188);
    setElementTop(document.getElementById('line-12')!, 200);
    expect(findActivePreviewSourceLine(container, 600, 5)).toBe(5);

    setElementTop(document.getElementById('line-24')!, scrollAnchorY + 200);
    vi.mocked(window.scrollTo).mockClear();
    vi.mocked(window.requestAnimationFrame).mockClear();
    frames.length = 0;

    // two schedule calls coalesce into one frame & the latest line wins
    scheduleScrollToSourceLine(5);
    scheduleScrollToSourceLine(24);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    frames.shift()?.(200);
    frames.shift()?.(200);
    frames.shift()?.(320);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 200,
      behavior: 'auto',
    });

    // w/ no rendered target the scheduled line stays pending
    document.body.innerHTML = '<div class="mdx-preview-content"></div>';
    expect(scrollToSourceLine(0)).toBe(false);
    expect(scrollToSourceLine(10)).toBe(false);
    vi.mocked(window.scrollTo).mockClear();
    scheduleScrollToSourceLine(12);
    frames.shift()?.(360);
    expect(window.scrollTo).not.toHaveBeenCalled();

    // the pending scroll flushes once matching content renders
    const lateContainer = renderMappedPreview();
    const lateTarget = lateContainer.querySelector('#line-12')!;
    setElementTop(lateTarget, scrollAnchorY + 160);
    expect(flushPendingScrollToSourceLine()).toBe(true);
    frames.shift()?.(480);
    frames.shift()?.(600);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 160,
      behavior: 'auto',
    });
  });

  it('suppresses reports caused by programmatic preview scrolls', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.useFakeTimers();
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
      writable: true,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: vi.fn(),
      writable: true,
    });

    const scrollAnchorY =
      window.innerHeight * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO;
    const host = await mountScrollSyncHarness(
      createElement(
        'div',
        { className: 'mdx-preview-content' },
        createElement(
          'div',
          { className: 'markdown-body' },
          createElement('p', { id: 'line-12', 'data-source-line': '12' }, 'A'),
          createElement('p', { id: 'line-24', 'data-source-line': '24' }, 'B')
        )
      )
    );
    setElementTop(host.querySelector('#line-12')!, scrollAnchorY + 120);
    setElementTop(host.querySelector('#line-24')!, scrollAnchorY + 420);

    scheduleScrollToSourceLine(12);

    await act(async () => {
      frames.shift()?.(0);
      frames.shift()?.(0);
      await Promise.resolve();
    });

    expect(isSourceLineScrollInProgress()).toBe(true);
    expect(mockReportPreviewSourceLine).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      frames.shift()?.(16);
      frames.shift()?.(16);
      frames.shift()?.(136);
      await Promise.resolve();
    });

    expect(isSourceLineScrollInProgress()).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      frames.shift()?.(152);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(216);
      await Promise.resolve();
    });
    expect(isSourceLineScrollInProgress()).toBe(false);

    await act(async () => {
      frames.shift()?.(240);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    setElementTop(host.querySelector('#line-12')!, -80);
    setElementTop(host.querySelector('#line-24')!, scrollAnchorY + 80);
    scheduleScrollToSourceLine(24);
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel'));
    });
    await act(async () => {
      frames.shift()?.(280);
      frames.shift()?.(296);
      frames.shift()?.(312);
      frames.shift()?.(328);
      await Promise.resolve();
    });
    expect(isSourceLineScrollInProgress()).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(24);
  });

  it('reports preview source lines with retry and interval throttling', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.useFakeTimers();
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
      writable: true,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: vi.fn(),
      writable: true,
    });
    mockReportPreviewSourceLine
      .mockResolvedValueOnce('retry')
      .mockResolvedValue('accepted');

    const host = await mountScrollSyncHarness(
      createElement('div', null, [
        createElement(
          'p',
          { key: 'a', id: 'line-12', 'data-source-line': '12' },
          'A'
        ),
        createElement(
          'p',
          { key: 'b', id: 'line-24', 'data-source-line': '24' },
          'B'
        ),
      ])
    );
    setElementTop(host.querySelector('#line-12')!, 250);
    setElementTop(host.querySelector('#line-24')!, 520);

    await act(async () => {
      frames.shift()?.(0);
      await Promise.resolve();
    });

    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    await act(async () => {
      vi.advanceTimersByTime(119);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    setElementTop(host.querySelector('#line-12')!, -40);
    setElementTop(host.querySelector('#line-24')!, 250);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      frames.shift()?.(200);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(3);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(24);
  });

  it('keeps ignored preview reports retryable with backoff', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.useFakeTimers();
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
      writable: true,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: vi.fn(),
      writable: true,
    });
    mockReportPreviewSourceLine
      .mockResolvedValueOnce('ignored')
      .mockResolvedValue('accepted');

    const host = await mountScrollSyncHarness(
      createElement('p', { id: 'line-12', 'data-source-line': '12' }, 'A')
    );
    setElementTop(host.querySelector('#line-12')!, 250);

    await act(async () => {
      frames.shift()?.(0);
      await Promise.resolve();
    });

    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    await act(async () => {
      vi.advanceTimersByTime(249);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      frames.shift()?.(300);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);
  });
});
