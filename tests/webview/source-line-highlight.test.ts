// tests/webview/source-line-highlight.test.ts
// tests source-line hover, click navigation & preview scroll sync
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  createElement,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO,
  SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS,
  SOURCE_LINE_SCROLL_SYNC_SETTLE_MS,
  type PreviewSourceLineReportResult,
} from '@mdx-preview/contracts';

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
import { usePreviewScrollSync } from '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewScrollSync';
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

  return createElement(
    'div',
    { ref, 'data-source-highlight-root': 'true' },
    children
  );
}

function SafeReplacementHarness({
  html,
  enabled,
  onOpenSourceLine,
}: {
  html: string;
  enabled: boolean;
  onOpenSourceLine: (line: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  useSourceLineHighlight({
    containerRef: ref,
    trigger: html,
    enabled,
    onOpenSourceLine,
  });

  return createElement('div', { ref });
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
  typeof window.requestAnimationFrame | undefined;

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

function installAnimationFrameQueue(
  fakeTimers = false
): FrameRequestCallback[] {
  if (fakeTimers) {
    vi.useFakeTimers();
  }

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

  return frames;
}

function createDeferredReport(): {
  promise: Promise<PreviewSourceLineReportResult>;
  resolve: (result: PreviewSourceLineReportResult) => void;
} {
  let resolve!: (result: PreviewSourceLineReportResult) => void;
  const promise = new Promise<PreviewSourceLineReportResult>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
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
      Array.from({ length: 5 }, (_, index) =>
        createElement(
          'p',
          { key: index, 'data-source-line': String(index + 12) },
          `Mapped paragraph ${index + 1}`
        )
      ),
      onOpenSourceLine
    );
    const paragraph = host.querySelector('[data-source-line="12"]')!;

    act(() => {
      paragraph.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
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

  it('promotes child mappings & resolves the nearest nested owner', async () => {
    const onOpenSourceLine = vi.fn();
    const host = await mountHarness(
      [
        createElement(
          'section',
          { key: 'nested', id: 'outer-owner', 'data-source-line': '10' },
          createElement(
            'span',
            { id: 'inner-owner', 'data-source-line': '11' },
            'Nested'
          )
        ),
        createElement(
          'p',
          { key: 'image' },
          createElement('img', {
            src: 'data:image/png;base64,abc',
            'data-source-line': '27',
          })
        ),
      ],
      onOpenSourceLine
    );
    const outer = host.querySelector('#outer-owner')!;
    const inner = host.querySelector('#inner-owner')!;
    const paragraph = host.querySelector('p')!;

    act(() => {
      outer.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    });
    expect(outer.classList.contains('highlight-line')).toBe(true);

    act(() => {
      inner.dispatchEvent(
        new MouseEvent('pointerover', {
          bubbles: true,
          relatedTarget: outer,
        })
      );
    });
    expect(outer.classList.contains('highlight-line')).toBe(false);
    expect(inner.classList.contains('highlight-line')).toBe(true);

    act(() => {
      inner.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        })
      );
      inner.dispatchEvent(
        new MouseEvent('pointerout', {
          bubbles: true,
          relatedTarget: outer,
        })
      );
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
          button: 0,
        })
      );
    });

    expect(onOpenSourceLine.mock.calls).toEqual([[11], [27]]);
    expect(inner.classList.contains('highlight-active')).toBe(false);
    expect(inner.classList.contains('highlight-line')).toBe(false);
    expect(outer.classList.contains('highlight-line')).toBe(true);
  });

  it('gates clicks & cleans Safe replacement interactions', async () => {
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
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          button: 1,
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

    await act(async () => {
      mountedRoot?.render(
        createElement(SafeReplacementHarness, {
          html: '<p data-source-line="4">First</p>',
          enabled: true,
          onOpenSourceLine,
        })
      );
    });

    const first = host.querySelector('p')!;
    act(() => {
      first.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
      first.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          button: 0,
        })
      );
    });
    expect(first.classList.contains('highlight-active')).toBe(true);

    await act(async () => {
      mountedRoot?.render(
        createElement(SafeReplacementHarness, {
          html: '<p data-source-line="9">Replacement</p>',
          enabled: true,
          onOpenSourceLine,
        })
      );
    });

    const replacement = host.querySelector('p')!;
    expect(first.isConnected).toBe(false);
    expect(first.classList.contains('highlight-line')).toBe(false);
    expect(first.classList.contains('highlight-active')).toBe(false);
    expect(replacement.classList.contains('highlight-line')).toBe(false);

    act(() => {
      replacement.dispatchEvent(
        new MouseEvent('pointerover', { bubbles: true })
      );
    });
    expect(replacement.classList.contains('highlight-line')).toBe(true);

    await act(async () => {
      mountedRoot?.render(
        createElement(SafeReplacementHarness, {
          html: '<p data-source-line="9">Replacement</p>',
          enabled: false,
          onOpenSourceLine,
        })
      );
    });

    expect(replacement.classList.contains('highlight-line')).toBe(false);
    act(() => {
      replacement.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          button: 0,
        })
      );
    });
    expect(onOpenSourceLine).toHaveBeenCalledTimes(1);
  });

  it('animates, coalesces, and defers source-line scroll targets', () => {
    const container = renderMappedPreview();
    const exactTarget = document.getElementById('line-12')!;
    const scrollAnchorY =
      window.innerHeight * SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO;
    setElementTop(exactTarget, scrollAnchorY + 120);

    const frames = installAnimationFrameQueue();

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
    const frames = installAnimationFrameQueue(true);

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
      vi.advanceTimersByTime(
        SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS +
          SOURCE_LINE_SCROLL_SYNC_SETTLE_MS +
          16
      );
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
    const container = host.firstElementChild as HTMLElement;
    const querySelectorAll = vi.spyOn(container, 'querySelectorAll');

    host
      .querySelector('#line-24')!
      .setAttribute('style', 'transform: translateY(1px)');
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(360);
      await Promise.resolve();
    });

    expect(querySelectorAll).not.toHaveBeenCalled();

    const nextLine = document.createElement('p');
    nextLine.setAttribute('data-source-line', '24');
    nextLine.textContent = 'B';
    container.appendChild(nextLine);
    setElementTop(nextLine, 300);

    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(376);
      await Promise.resolve();
    });

    expect(querySelectorAll).toHaveBeenCalled();
  });

  it('reports preview source lines with retry and interval throttling', async () => {
    const frames = installAnimationFrameQueue(true);
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

  it('bounds ignored retries & isolates newer scroll work', async () => {
    const frames = installAnimationFrameQueue(true);
    const resetHarness = (): void => {
      act(() => {
        mountedRoot?.unmount();
      });
      mountedRoot = undefined;
      document.body.innerHTML = '';
      frames.length = 0;
      mockReportPreviewSourceLine.mockReset();
    };

    mockReportPreviewSourceLine
      .mockResolvedValueOnce('ignored')
      .mockResolvedValue('accepted');
    const environmentHost = await mountScrollSyncHarness(
      createElement('p', { id: 'line-12', 'data-source-line': '12' }, 'A')
    );
    setElementTop(environmentHost.querySelector('#line-12')!, 250);

    await act(async () => {
      frames.shift()?.(0);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {
      frames.shift()?.(16);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(49);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(2);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(12);

    resetHarness();
    mockReportPreviewSourceLine
      .mockResolvedValueOnce('ignored')
      .mockResolvedValueOnce('ignored')
      .mockResolvedValueOnce('ignored')
      .mockResolvedValueOnce('ignored')
      .mockResolvedValue('accepted');
    const lineChangeHost = await mountScrollSyncHarness(
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
    setElementTop(lineChangeHost.querySelector('#line-12')!, 250);
    setElementTop(lineChangeHost.querySelector('#line-24')!, 520);

    await act(async () => {
      frames.shift()?.(100);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_750);
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(4);
    expect(mockReportPreviewSourceLine.mock.calls).toEqual([
      [12],
      [12],
      [12],
      [12],
    ]);

    setElementTop(lineChangeHost.querySelector('#line-12')!, -40);
    setElementTop(lineChangeHost.querySelector('#line-24')!, 250);
    act(() => {
      lineChangeHost
        .querySelector('#line-24')!
        .setAttribute('style', 'transform: translateY(1px)');
    });
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(2_000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(49);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(4);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(5);
    expect(mockReportPreviewSourceLine).toHaveBeenLastCalledWith(24);

    resetHarness();
    const staleIgnoredReport = createDeferredReport();
    mockReportPreviewSourceLine
      .mockImplementationOnce(() => staleIgnoredReport.promise)
      .mockResolvedValue('ignored');
    const ignoredSettlementHost = await mountScrollSyncHarness(
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
    setElementTop(ignoredSettlementHost.querySelector('#line-12')!, 250);
    setElementTop(ignoredSettlementHost.querySelector('#line-24')!, 520);

    await act(async () => {
      frames.shift()?.(3_000);
      await Promise.resolve();
    });
    setElementTop(ignoredSettlementHost.querySelector('#line-12')!, -40);
    setElementTop(ignoredSettlementHost.querySelector('#line-24')!, 250);
    act(() => {
      ignoredSettlementHost
        .querySelector('#line-24')!
        .setAttribute('style', 'transform: translateY(1px)');
    });
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(3_016);
      await Promise.resolve();
      staleIgnoredReport.resolve('ignored');
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(49);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });
    expect(mockReportPreviewSourceLine.mock.calls).toEqual([
      [12],
      [24],
      [24],
      [24],
      [24],
      [24],
    ]);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(6);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      frames.shift()?.(4_000);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(7);

    act(() => {
      mountedRoot?.unmount();
    });
    mountedRoot = undefined;
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(7);

    resetHarness();
    const staleRetryReport = createDeferredReport();
    mockReportPreviewSourceLine
      .mockImplementationOnce(() => staleRetryReport.promise)
      .mockResolvedValue('accepted');
    const retrySettlementHost = await mountScrollSyncHarness(
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
    setElementTop(retrySettlementHost.querySelector('#line-12')!, 250);
    setElementTop(retrySettlementHost.querySelector('#line-24')!, 520);

    await act(async () => {
      frames.shift()?.(5_000);
      await Promise.resolve();
    });
    setElementTop(retrySettlementHost.querySelector('#line-12')!, -40);
    setElementTop(retrySettlementHost.querySelector('#line-24')!, 250);
    act(() => {
      retrySettlementHost
        .querySelector('#line-24')!
        .setAttribute('style', 'transform: translateY(1px)');
    });
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(5_016);
      await Promise.resolve();
      staleRetryReport.resolve('retry');
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(49);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine.mock.calls).toEqual([[12], [24]]);

    resetHarness();
    const currentLineReport = createDeferredReport();
    mockReportPreviewSourceLine
      .mockImplementationOnce(() => currentLineReport.promise)
      .mockResolvedValue('accepted');
    const returnHost = await mountScrollSyncHarness(
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
    setElementTop(returnHost.querySelector('#line-12')!, 250);
    setElementTop(returnHost.querySelector('#line-24')!, 520);

    await act(async () => {
      frames.shift()?.(6_000);
      await Promise.resolve();
    });
    setElementTop(returnHost.querySelector('#line-12')!, -40);
    setElementTop(returnHost.querySelector('#line-24')!, 250);
    act(() => {
      returnHost
        .querySelector('#line-24')!
        .setAttribute('style', 'transform: translateY(1px)');
    });
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(6_016);
      await Promise.resolve();
    });

    setElementTop(returnHost.querySelector('#line-12')!, 250);
    setElementTop(returnHost.querySelector('#line-24')!, 520);
    act(() => {
      returnHost
        .querySelector('#line-12')!
        .setAttribute('style', 'transform: translateY(1px)');
    });
    await act(async () => {
      await Promise.resolve();
      frames.shift()?.(6_032);
      await Promise.resolve();
      currentLineReport.resolve('accepted');
      await Promise.resolve();
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(mockReportPreviewSourceLine.mock.calls).toEqual([[12]]);
  });
});
