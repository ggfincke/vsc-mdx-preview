// tests/webview/TrustedPreview-source-line-highlight.test.ts
// @vitest-environment jsdom

import React, { createElement, useState, type ComponentType } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  '../../packages/webview-client/src/features/module-runtime',
  () => ({
    evaluateModuleToComponent: vi.fn(async () => {
      return function Demo() {
        return createElement(
          'div',
          { id: 'custom-widget', className: 'trusted-widget' },
          createElement('button', { type: 'button' }, 'Increment'),
          createElement('span', null, '42')
        );
      } as ComponentType;
    }),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/code-block/hooks/useKatexDetection',
  () => ({
    useKatexDetection: vi.fn(),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/code-block/hooks/useCodeBlockEnhancement',
  () => ({
    useCodeBlockEnhancement: vi.fn(),
  })
);

import { TrustedPreviewRenderer } from '../../packages/webview-client/src/features/preview/trusted/TrustedPreview';
import { TocProvider } from '../../packages/webview-client/src/app/state/TocContext';
import { LightboxProvider } from '../../packages/webview-client/src/app/state/LightboxContext';
import type { TrustedPreviewContent } from '../../packages/webview-client/src/app/types';

const content: TrustedPreviewContent = {
  mode: 'trusted',
  code: 'export default function Demo() { return null; }',
  entryFilePath: '/workspace/doc.mdx',
  dependencies: [],
};

function Harness() {
  const [evaluatedComponent, setEvaluatedComponent] =
    useState<ComponentType | null>(null);

  return createElement(
    TocProvider,
    null,
    createElement(
      LightboxProvider,
      null,
      createElement(TrustedPreviewRenderer, {
        content,
        evaluatedComponent,
        onComponentReady: setEvaluatedComponent,
        onError: () => {},
      })
    )
  );
}

function mountHarness(): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(Harness));
  });

  return { container, root };
}

describe('TrustedPreviewRenderer source-line highlight', () => {
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
    vi.clearAllMocks();
  });

  it('highlights trusted custom component roots that have no source-line markup', async () => {
    const { container, root } = mountHarness();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const customWidget = container.querySelector('#custom-widget');
    expect(customWidget).toBeTruthy();

    customWidget!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(customWidget!.classList.contains('highlight-line')).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
