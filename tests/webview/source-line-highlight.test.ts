// tests/webview/source-line-highlight.test.ts
// regression tests for source-line hover behavior in lists and tables
//
// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { createElement, useRef, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSourceLineHighlight } from '../../packages/webview-client/src/features/preview/shared/hooks/useSourceLineHighlight';

interface HarnessProps {
  html: string;
  enabled?: boolean;
}

function HighlightHarness({ html, enabled = true }: HarnessProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useSourceLineHighlight({
    containerRef,
    trigger: html,
    enabled,
  });

  return createElement('div', {
    ref: containerRef,
    dangerouslySetInnerHTML: { __html: html },
  });
}

interface MountedHarness {
  container: HTMLElement;
  root: Root;
  render: (props: HarnessProps) => void;
}

function mountHarness(initialProps: HarnessProps): MountedHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const render = (props: HarnessProps): void => {
    act(() => {
      root.render(createElement(HighlightHarness, props));
    });
  };

  render(initialProps);
  return { container, root, render };
}

function unmountHarness(root: Root): void {
  act(() => {
    root.unmount();
  });
}

function mouseEnter(element: Element): void {
  element.dispatchEvent(new MouseEvent('mouseenter'));
}

function mouseLeave(element: Element, relatedTarget?: Element | null): void {
  element.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget }));
}

describe('useSourceLineHighlight regressions', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
  });

  it('highlights only the nearest nested list item', () => {
    const html = `
      <ol data-source-line="1">
        <li id="item-1" data-source-line="2">
          <span data-source-line="2">First item</span>
        </li>
        <li id="item-2" data-source-line="3">
          <span data-source-line="3">Second item</span>
          <ol data-source-line="3">
            <li id="nested-1" data-source-line="4">
              <span data-source-line="4">Nested item 2.1</span>
            </li>
            <li id="nested-2" data-source-line="5">
              <span data-source-line="5">Nested item 2.2</span>
            </li>
          </ol>
        </li>
      </ol>
    `;

    const { container, root } = mountHarness({ html });
    const nestedListItem = container.querySelector('#nested-1');
    const parentListItem = container.querySelector('#item-2');
    const siblingListItem = container.querySelector('#item-1');

    expect(nestedListItem).toBeTruthy();
    expect(parentListItem).toBeTruthy();
    expect(siblingListItem).toBeTruthy();

    mouseEnter(nestedListItem!);

    expect(nestedListItem!.classList.contains('highlight-line')).toBe(true);
    expect(parentListItem!.classList.contains('highlight-line')).toBe(false);
    expect(siblingListItem!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('restores parent list-item highlight when leaving nested item downward', () => {
    const html = `
      <ol data-source-line="1">
        <li id="parent" data-source-line="2">
          <span data-source-line="2">Second item</span>
          <ol data-source-line="2">
            <li id="nested" data-source-line="3">
              <span data-source-line="3">Nested item</span>
            </li>
          </ol>
        </li>
      </ol>
    `;

    const { container, root } = mountHarness({ html });
    const parent = container.querySelector('#parent');
    const nested = container.querySelector('#nested');

    expect(parent).toBeTruthy();
    expect(nested).toBeTruthy();

    mouseEnter(parent!);
    expect(parent!.classList.contains('highlight-line')).toBe(true);

    mouseEnter(nested!);
    expect(nested!.classList.contains('highlight-line')).toBe(true);
    expect(parent!.classList.contains('highlight-line')).toBe(false);

    // leaving nested item into parent should restore parent highlight
    mouseLeave(nested!, parent);
    expect(parent!.classList.contains('highlight-line')).toBe(true);
    expect(nested!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('does not highlight tables on hover', () => {
    const html = `
      <table id="table" data-source-line="10">
        <thead data-source-line="10">
          <tr id="head-row" data-source-line="10">
            <th id="head-cell" data-source-line="10">Feature</th>
          </tr>
        </thead>
        <tbody data-source-line="11">
          <tr id="row-1" data-source-line="11">
            <td id="cell-1" data-source-line="11">One</td>
          </tr>
          <tr id="row-2" data-source-line="12">
            <td id="cell-2" data-source-line="12">Two</td>
          </tr>
        </tbody>
      </table>
    `;

    const { container, root } = mountHarness({ html });
    const table = container.querySelector('#table');
    const row = container.querySelector('#row-1');
    const cell = container.querySelector('#cell-1');
    const headerCell = container.querySelector('#head-cell');

    expect(table).toBeTruthy();
    expect(row).toBeTruthy();
    expect(cell).toBeTruthy();
    expect(headerCell).toBeTruthy();

    mouseEnter(table!);

    expect(table!.classList.contains('highlight-line')).toBe(false);
    expect(row!.classList.contains('highlight-line')).toBe(false);
    expect(cell!.classList.contains('highlight-line')).toBe(false);
    expect(headerCell!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('keeps table internals unhighlighted while moving across cells', () => {
    const html = `
      <table id="table" data-source-line="20">
        <tbody data-source-line="20">
          <tr data-source-line="20">
            <td id="cell-a" data-source-line="20">A</td>
            <td id="cell-b" data-source-line="21">B</td>
          </tr>
        </tbody>
      </table>
    `;

    const { container, root } = mountHarness({ html });
    const table = container.querySelector('#table');
    const cellA = container.querySelector('#cell-a');
    const cellB = container.querySelector('#cell-b');

    expect(table).toBeTruthy();
    expect(cellA).toBeTruthy();
    expect(cellB).toBeTruthy();

    mouseEnter(table!);
    mouseEnter(cellA!);
    mouseLeave(cellA!);
    mouseEnter(cellB!);

    expect(table!.classList.contains('highlight-line')).toBe(false);
    expect(cellA!.classList.contains('highlight-line')).toBe(false);
    expect(cellB!.classList.contains('highlight-line')).toBe(false);

    mouseLeave(table!);
    expect(table!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('highlights the whole callout root only', () => {
    const html = `
      <div id="alert" class="github-alert github-alert-note" data-source-line="24">
        <p id="alert-title" class="github-alert-title" data-source-line="24">
          <span id="alert-title-text" data-source-line="24">Note</span>
        </p>
        <div id="alert-content" class="github-alert-content" data-source-line="25">
          <p id="alert-paragraph" data-source-line="25">Alert body</p>
        </div>
      </div>
    `;

    const { container, root } = mountHarness({ html });
    const alert = container.querySelector('#alert');
    const alertTitle = container.querySelector('#alert-title');
    const alertContent = container.querySelector('#alert-content');
    const alertParagraph = container.querySelector('#alert-paragraph');

    expect(alert).toBeTruthy();
    expect(alertTitle).toBeTruthy();
    expect(alertContent).toBeTruthy();
    expect(alertParagraph).toBeTruthy();

    mouseEnter(alert!);
    mouseEnter(alertParagraph!);

    expect(alert!.classList.contains('highlight-line')).toBe(true);
    expect(alertTitle!.classList.contains('highlight-line')).toBe(false);
    expect(alertContent!.classList.contains('highlight-line')).toBe(false);
    expect(alertParagraph!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('prefers callout root over nested list item highlighting', () => {
    const html = `
      <div
        id="callout-list-root"
        class="github-alert github-alert-tip"
        data-source-line="26"
      >
        <div class="github-alert-content" data-source-line="27">
          <ol data-source-line="27">
            <li id="callout-list-item" data-source-line="28">
              <span id="callout-list-text" data-source-line="28">Nested list item</span>
            </li>
          </ol>
        </div>
      </div>
    `;

    const { container, root } = mountHarness({ html });
    const calloutRoot = container.querySelector('#callout-list-root');
    const listItem = container.querySelector('#callout-list-item');
    const listText = container.querySelector('#callout-list-text');

    expect(calloutRoot).toBeTruthy();
    expect(listItem).toBeTruthy();
    expect(listText).toBeTruthy();

    mouseEnter(calloutRoot!);
    mouseEnter(listText!);

    expect(calloutRoot!.classList.contains('highlight-line')).toBe(true);
    expect(listItem!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('promotes nextra wrapper hover ownership to callout root', () => {
    const html = `
      <div
        id="nextra-wrapper"
        class="mdx-preview-nextra-callout-wrapper"
        data-source-line="29"
      >
        <aside
          id="nextra-callout"
          class="mdx-preview-nextra-callout mdx-preview-nextra-callout-info"
          data-source-line="29"
        >
          <div
            id="nextra-content"
            class="mdx-preview-nextra-callout-content"
            data-source-line="30"
          >
            <p id="nextra-text" data-source-line="30">Nextra callout body</p>
          </div>
        </aside>
      </div>
    `;

    const { container, root } = mountHarness({ html });
    const wrapper = container.querySelector('#nextra-wrapper');
    const callout = container.querySelector('#nextra-callout');
    const content = container.querySelector('#nextra-content');
    const text = container.querySelector('#nextra-text');

    expect(wrapper).toBeTruthy();
    expect(callout).toBeTruthy();
    expect(content).toBeTruthy();
    expect(text).toBeTruthy();

    mouseEnter(callout!);
    mouseEnter(text!);

    expect(callout!.classList.contains('highlight-line')).toBe(true);
    expect(wrapper!.classList.contains('highlight-line')).toBe(false);
    expect(content!.classList.contains('highlight-line')).toBe(false);
    expect(text!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('removes and prevents highlights when disabled', () => {
    const html = `
      <ol data-source-line="30">
        <li id="list-item" data-source-line="31">Item</li>
      </ol>
    `;

    const { container, root, render } = mountHarness({ html, enabled: true });
    const listItem = container.querySelector('#list-item');
    expect(listItem).toBeTruthy();

    mouseEnter(listItem!);
    expect(listItem!.classList.contains('highlight-line')).toBe(true);

    render({ html, enabled: false });
    expect(container.querySelectorAll('.highlight-line').length).toBe(0);

    mouseEnter(listItem!);
    expect(container.querySelectorAll('.highlight-line').length).toBe(0);

    unmountHarness(root);
  });

  it('removes and prevents callout highlights when disabled', () => {
    const html = `
      <div id="disabled-alert" class="github-alert github-alert-warning" data-source-line="32">
        <div class="github-alert-content" data-source-line="33">
          <p id="disabled-alert-text" data-source-line="33">Disabled callout</p>
        </div>
      </div>
    `;

    const { container, root, render } = mountHarness({ html, enabled: true });
    const alert = container.querySelector('#disabled-alert');
    const alertText = container.querySelector('#disabled-alert-text');
    expect(alert).toBeTruthy();
    expect(alertText).toBeTruthy();

    mouseEnter(alert!);
    mouseEnter(alertText!);
    expect(alert!.classList.contains('highlight-line')).toBe(true);

    render({ html, enabled: false });
    expect(container.querySelectorAll('.highlight-line').length).toBe(0);

    mouseEnter(alert!);
    mouseEnter(alertText!);
    expect(container.querySelectorAll('.highlight-line').length).toBe(0);

    unmountHarness(root);
  });

  it('highlights only the hovered block-math container', () => {
    const html = `
      <div id="math-1" class="katex-display" data-source-line="40">
        <span data-source-line="40">formula 1</span>
      </div>
      <div id="math-2" class="katex-display" data-source-line="41">
        <span data-source-line="41">formula 2</span>
      </div>
      <div id="math-3" class="katex-display" data-source-line="42">
        <span data-source-line="42">formula 3</span>
      </div>
    `;

    const { container, root } = mountHarness({ html });
    const math1 = container.querySelector('#math-1');
    const math2 = container.querySelector('#math-2');
    const math3 = container.querySelector('#math-3');

    expect(math1).toBeTruthy();
    expect(math2).toBeTruthy();
    expect(math3).toBeTruthy();

    mouseEnter(math2!);

    expect(math1!.classList.contains('highlight-line')).toBe(false);
    expect(math2!.classList.contains('highlight-line')).toBe(true);
    expect(math3!.classList.contains('highlight-line')).toBe(false);

    unmountHarness(root);
  });

  it('defines a list-specific offset for highlighted list items', () => {
    const cssPath = path.join(
      process.cwd(),
      'packages/webview-client/src/app/styles/App.css'
    );
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.markdown-body li.highlight-line');
    expect(css).toContain('--mdx-source-line-offset: -26px;');
  });

  it('defines shim-specific highlight color plumbing in App.css', () => {
    const cssPath = path.join(
      process.cwd(),
      'packages/webview-client/src/app/styles/App.css'
    );
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('--mdx-source-line-color');
    expect(css).toContain('--mdx-source-line-width: 4px;');
    expect(css).toContain("data-source-line-highlight-color='white'");
    expect(css).toContain("data-source-line-highlight-color='black'");
    expect(css).toContain("data-source-line-highlight-color='auto'");
    expect(css).toContain('vscode-dark');
    expect(css).toContain('.highlight-line:is(');
    expect(css).toContain('.highlight-line.mdx-preview-admonition');
    expect(css).toContain('.highlight-line.github-alert-note');
  });

  it('defines shim side-rail toggle and consolidated table style rules in App.css', () => {
    const cssPath = path.join(
      process.cwd(),
      'packages/webview-client/src/app/styles/App.css'
    );
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain("data-shim-side-rail='off'");
    expect(css).toContain('border-left-color: transparent;');
    expect(css).toContain('--mdx-source-line-offset: -10px;');
    expect(css).toContain('--mdx-table-rail-track-width: 4px;');
    expect(css).toContain(
      'border-inline-start: var(--mdx-table-rail-track-width) solid transparent;'
    );
    expect(css).not.toContain('.markdown-body table.highlight-line');
    expect(css).not.toContain('background-image: linear-gradient(');
    expect(css).not.toContain('--mdx-table-highlight-gutter');
    expect(css).not.toContain("data-table-style='minimal'");
    expect(css).not.toContain("data-table-style='grid'");
    expect(css).not.toContain("data-table-style='legacy'");
    expect(css).toContain(
      ".mdx-preview-container:not([data-mpe-theme-active='true']) .markdown-body table"
    );
    expect(css).toContain('border-bottom-width: 2px;');
    expect(css).toContain('tr:nth-child(2n)');
    expect(css).toContain(
      'border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.45));'
    );
  });
});
