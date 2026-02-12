// tests/webview/features/preview/trusted/TrustedPreview.test.ts
// unit tests for trusted preview rendering & export resolution
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

const { asyncBehavior } = vi.hoisted(() => ({
  asyncBehavior: {
    mode: 'none' as 'none' | 'success' | 'error',
    result: undefined as unknown,
    error: new Error('evaluation failed'),
  },
}));

vi.mock('../../packages/webview-client/src/features/module-runtime', () => ({
  evaluateModuleToComponent: vi.fn(),
}));

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewSetup',
  () => ({
    usePreviewSetup: () => ({
      containerRef: { current: {} },
      handleImageClick: vi.fn(),
      renderPortals: () => null,
      scan: vi.fn(),
    }),
  })
);

vi.mock(
  '../../packages/webview-client/src/shared/hooks/useAsyncEffect',
  () => ({
    useAsyncEffect: (_fn: any, _deps: any[], options: any) => {
      if (asyncBehavior.mode === 'success') {
        options?.onSuccess?.(asyncBehavior.result);
      } else if (asyncBehavior.mode === 'error') {
        options?.onError?.(asyncBehavior.error);
      }
    },
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

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/ui/PreviewContainer/PreviewContainer',
  () => ({
    PreviewContainer: ({ mode, children, diagramPortals }: any) =>
      createElement(
        'section',
        { 'data-preview-mode': mode },
        children,
        diagramPortals
      ),
  })
);

import { TrustedPreviewRenderer } from '../../packages/webview-client/src/features/preview/trusted/TrustedPreview';
import type { TrustedPreviewContent } from '../../packages/webview-client/src/app/types';

const content: TrustedPreviewContent = {
  mode: 'trusted',
  code: 'export default function Test() { return null; }',
  entryFilePath: '/workspace/doc.mdx',
  dependencies: [],
};

function mountRenderer(props: Parameters<typeof TrustedPreviewRenderer>[0]): {
  container: HTMLElement;
  root: Root;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(TrustedPreviewRenderer, props));
  });
  return { container, root };
}

function unmountRenderer(root: Root): void {
  act(() => {
    root.unmount();
  });
}

describe('TrustedPreviewRenderer', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    asyncBehavior.mode = 'none';
    asyncBehavior.result = undefined;
    asyncBehavior.error = new Error('evaluation failed');
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
  });

  it('shows evaluating state when component is not available', () => {
    const { container, root } = mountRenderer({
      content,
      evaluatedComponent: null,
      onComponentReady: vi.fn(),
      onError: vi.fn(),
    });

    expect(container.textContent).toContain('Evaluating');
    unmountRenderer(root);
  });

  it('renders function component exports', () => {
    const DemoComponent = () => createElement('div', null, 'Rendered Demo');
    const { container, root } = mountRenderer({
      content,
      evaluatedComponent: DemoComponent as any,
      onComponentReady: vi.fn(),
      onError: vi.fn(),
    });

    const previewRoot = container.querySelector(
      '[data-preview-mode="trusted"]'
    );
    expect(previewRoot).toBeTruthy();
    expect(container.textContent).toContain('Rendered Demo');
    unmountRenderer(root);
  });

  it('unwraps nested default exports', () => {
    const NestedComponent = () => createElement('div', null, 'Nested Render');
    const nested = { default: { default: NestedComponent } };
    const { container, root } = mountRenderer({
      content,
      evaluatedComponent: nested as any,
      onComponentReady: vi.fn(),
      onError: vi.fn(),
    });

    expect(container.textContent).toContain('Nested Render');
    unmountRenderer(root);
  });

  it('renders pre-built React element exports', () => {
    const elementExport = createElement('p', null, 'Element Export');
    const { container, root } = mountRenderer({
      content,
      evaluatedComponent: elementExport as any,
      onComponentReady: vi.fn(),
      onError: vi.fn(),
    });

    expect(container.textContent).toContain('Element Export');
    unmountRenderer(root);
  });

  it('throws for invalid exports', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(TrustedPreviewRenderer, {
          content,
          evaluatedComponent: { bad: 'export' } as any,
          onComponentReady: vi.fn(),
          onError: vi.fn(),
        })
      )
    ).toThrow(/Invalid MDX export/);
  });

  it('calls onComponentReady when async evaluation succeeds', () => {
    const onComponentReady = vi.fn();
    const Evaluated = () => createElement('div', null, 'Eval result');
    asyncBehavior.mode = 'success';
    asyncBehavior.result = Evaluated;

    const { root } = mountRenderer({
      content,
      evaluatedComponent: null,
      onComponentReady,
      onError: vi.fn(),
    });

    expect(onComponentReady).toHaveBeenCalledWith(Evaluated);
    unmountRenderer(root);
  });

  it('calls onError with normalized message when async evaluation fails', () => {
    const onError = vi.fn();
    asyncBehavior.mode = 'error';
    asyncBehavior.error = new Error('module evaluation failed');

    const { root } = mountRenderer({
      content,
      evaluatedComponent: null,
      onComponentReady: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'module evaluation failed',
        stack: expect.any(String),
      })
    );
    unmountRenderer(root);
  });
});
