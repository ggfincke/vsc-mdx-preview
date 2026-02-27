// tests/webview/features/preview/shared/ui/TableOfContents.test.ts
// unit tests for TOC rendering, active state, & heading navigation
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { tocState, mockScrollIntoView } = vi.hoisted(() => ({
  tocState: {
    headings: null as Array<{
      id: string;
      text: string;
      level: 1 | 2 | 3 | 4 | 5 | 6;
    }> | null,
    showToc: false,
    activeHeadingId: null as string | null,
    setActiveHeadingId: vi.fn((headingId: string | null) => {
      tocState.activeHeadingId = headingId;
    }),
  },
  mockScrollIntoView: vi.fn(),
}));

vi.mock('../../packages/webview-client/src/app/state/TocContext', () => ({
  useToc: () => tocState,
}));

import { TableOfContents } from '../../packages/webview-client/src/features/preview/shared/ui/TableOfContents/TableOfContents';

function makeRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 200,
    height: 20,
    top,
    right: 200,
    bottom: top + 20,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function setHeadingPosition(id: string, top: number): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => makeRect(top),
  });
}

function mountToc(): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(TableOfContents));
  });

  return { container, root };
}

function unmount(root: Root): void {
  act(() => {
    root.unmount();
  });
}

describe('TableOfContents', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    tocState.headings = null;
    tocState.showToc = false;
    tocState.activeHeadingId = null;

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: mockScrollIntoView,
    });

    document.body.innerHTML = '';
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
  });

  it('does not render when TOC is disabled', () => {
    tocState.showToc = false;
    tocState.headings = [{ id: 'intro', text: 'Intro', level: 1 }];

    const { container, root } = mountToc();

    expect(container.querySelector('.mdx-toc-panel')).toBeNull();
    unmount(root);
  });

  it('renders headings & marks current heading as active', () => {
    tocState.showToc = true;
    tocState.activeHeadingId = 'usage';
    tocState.headings = [
      { id: 'intro', text: 'Intro', level: 1 },
      { id: 'usage', text: 'Usage', level: 2 },
    ];

    const { container, root } = mountToc();

    const activeLink = container.querySelector('.mdx-toc-link--active');
    expect(activeLink).toBeTruthy();
    expect(activeLink?.textContent).toContain('Usage');
    unmount(root);
  });

  it('navigates to heading on click', () => {
    tocState.showToc = true;
    tocState.headings = [{ id: 'intro', text: 'Intro', level: 1 }];

    const heading = document.createElement('h1');
    heading.id = 'intro';
    document.body.appendChild(heading);
    setHeadingPosition('intro', 40);

    const { container, root } = mountToc();

    const link = container.querySelector('a.mdx-toc-link');
    expect(link).toBeTruthy();

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(tocState.setActiveHeadingId).toHaveBeenCalledWith('intro');
    expect(mockScrollIntoView).toHaveBeenCalled();
    unmount(root);
  });
});
