// tests/webview/ErrorBoundary.test.ts
// tests/webview/shared/ui/error-boundary/ErrorBoundary.test.tsx
// unit tests for stack-frame navigation behavior in ErrorDisplay
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { mockOpenDocument } = vi.hoisted(() => ({
  mockOpenDocument: vi.fn(async () => undefined),
}));

vi.mock(
  '../../packages/webview-client/src/platform/rpc/webview-rpc-client',
  () => ({
    ExtensionHandle: {
      openDocument: (...args: unknown[]) => mockOpenDocument(...args),
    },
  })
);

import { ErrorDisplay } from '../../packages/webview-client/src/shared/ui/error-boundary/ErrorBoundary';

function mountErrorDisplay(error: Error): {
  container: HTMLElement;
  root: Root;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ErrorDisplay, { error }));
  });

  return { container, root };
}

function unmount(root: Root): void {
  act(() => {
    root.unmount();
  });
}

describe('ErrorDisplay stack frame navigation', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
  });

  it('opens user-code stack frames in the editor', () => {
    const error = new Error('Runtime exploded');
    error.stack =
      'Error: Runtime exploded\n    at renderThing (/workspace/src/pages/doc.mdx:12:7)';

    const { container, root } = mountErrorDisplay(error);

    const frame = container.querySelector(
      '.mdx-preview-error-stack-frame.navigable'
    );
    expect(frame).toBeTruthy();

    act(() => {
      frame?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockOpenDocument).toHaveBeenCalledWith(
      '/workspace/src/pages/doc.mdx',
      12,
      7
    );

    unmount(root);
  });

  it('does not mark non-user-code frames as navigable', () => {
    const error = new Error('Module failed');
    error.stack =
      'Error: Module failed\n    at doThing (/workspace/node_modules/pkg/index.js:5:2)';

    const { container, root } = mountErrorDisplay(error);

    const frame = container.querySelector(
      '.mdx-preview-error-stack-frame.navigable'
    );
    expect(frame).toBeNull();
    expect(mockOpenDocument).not.toHaveBeenCalled();

    unmount(root);
  });
});
