// tests/webview/App.test.ts
// integration-style unit tests for App rendering paths & link handling
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

const {
  appState,
  mockSetError,
  mockClearError,
  mockOpenExternal,
  mockClassifyLink,
  mockTrustedPreviewRenderer,
} = vi.hoisted(() => ({
  appState: {
    trustState: { canExecute: false },
    content: null as any,
    error: null as any,
    isLoading: false,
    isStale: false,
    nextraMeta: null as any,
    shimSideRailEnabled: true,
    sourceLineHighlightColorMode: 'dependent',
    previewTheme: 'none',
  },
  mockSetError: vi.fn(),
  mockClearError: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockClassifyLink: vi.fn((href: string) =>
    href.startsWith('http') ? 'external' : 'anchor'
  ),
  mockTrustedPreviewRenderer: vi.fn(() =>
    createElement('div', { 'data-testid': 'trusted-preview' }, 'trusted')
  ),
}));

vi.mock(
  '../../packages/webview-client/src/shared/utils/createTaggedLogger',
  () => ({
    createTaggedLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  })
);

vi.mock('../../packages/webview-client/src/app/state', () => ({
  useTrust: () => ({ trustState: appState.trustState }),
  usePreview: () => ({
    content: appState.content,
    error: appState.error,
    nextraMeta: appState.nextraMeta,
    setError: mockSetError,
    clearError: mockClearError,
  }),
  useLoading: () => ({
    isLoading: appState.isLoading,
    isStale: appState.isStale,
  }),
  useUIFlags: () => ({
    shimSideRailEnabled: appState.shimSideRailEnabled,
    sourceLineHighlightColorMode: appState.sourceLineHighlightColorMode,
  }),
}));

vi.mock('../../packages/webview-client/src/features/theme/runtime', () => ({
  useTheme: () => ({ previewTheme: appState.previewTheme }),
}));

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/ui/LoadingBar/LoadingBar',
  () => ({
    default: () =>
      createElement('div', { 'data-testid': 'loading-bar' }, 'loading'),
  })
);

vi.mock(
  '../../packages/webview-client/src/shared/ui/error-boundary/ErrorBoundary',
  () => ({
    MDXErrorBoundary: ({ children }: any) =>
      createElement('div', null, children),
    ErrorDisplay: ({ error }: any) =>
      createElement('div', { 'data-testid': 'error-display' }, error.message),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/ui/TrustBanner/TrustBanner',
  () => ({
    TrustBanner: () =>
      createElement('div', { 'data-testid': 'trust-banner' }, 'trust'),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/ui/StaleIndicator/StaleIndicator',
  () => ({
    StaleIndicator: ({ isStale }: { isStale: boolean }) =>
      createElement(
        'div',
        { 'data-testid': 'stale-indicator' },
        String(isStale)
      ),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/safe/SafePreview',
  () => ({
    SafePreviewRenderer: () =>
      createElement(
        'a',
        { href: 'https://example.com', 'data-testid': 'safe-preview' },
        'safe'
      ),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/trusted/TrustedPreview',
  () => ({
    TrustedPreviewRenderer: (props: any) => mockTrustedPreviewRenderer(props),
  })
);

vi.mock(
  '../../packages/webview-client/src/platform/rpc/webview-rpc-client',
  () => ({
    ExtensionHandle: {
      openExternal: (...args: any[]) => mockOpenExternal(...args),
    },
  })
);

vi.mock('../../packages/webview-client/src/shared/utils/linkHandler', () => ({
  classifyLink: (...args: any[]) => mockClassifyLink(...args),
}));

import App from '../../packages/webview-client/src/app/App';

function renderAppToString(): string {
  return renderToStaticMarkup(createElement(App));
}

function mountApp(): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(App));
  });
  return { container, root };
}

function unmountApp(root: Root): void {
  act(() => {
    root.unmount();
  });
}

describe('App', () => {
  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    appState.trustState = { canExecute: false };
    appState.content = null;
    appState.error = null;
    appState.isLoading = false;
    appState.isStale = false;
    appState.nextraMeta = null;
    appState.shimSideRailEnabled = true;
    appState.sourceLineHighlightColorMode = 'dependent';
    appState.previewTheme = 'none';
  });

  it('renders initial loading state when loading and no content', () => {
    appState.isLoading = true;
    appState.content = null;
    appState.error = null;

    const html = renderAppToString();

    expect(html).toContain('data-testid="loading-bar"');
  });

  it('renders error state with ErrorDisplay', () => {
    appState.error = {
      message: 'Compilation failed',
      type: 'compile',
    };

    const html = renderAppToString();

    expect(html).toContain('data-testid="error-display"');
    expect(html).toContain('Compilation failed');
  });

  it('renders preview content according to trust state', () => {
    appState.trustState = { canExecute: false };
    appState.isStale = true;
    appState.content = {
      mode: 'safe',
      html: '<p>safe</p>',
    };
    appState.nextraMeta = {
      title: 'Safe Page',
      layout: 'full',
    };

    const html = renderAppToString();

    expect(html).toContain('data-testid="safe-preview"');
    expect(html).toContain('data-testid="trust-banner"');
    expect(html).toContain('Safe Page');
    expect(html).toContain('nextra-layout-full');
    expect(html).toContain('data-testid="stale-indicator"');

    appState.content = {
      mode: 'trusted',
      code: 'export default function Demo() {}',
      entryFilePath: '/workspace/doc.mdx',
      dependencies: [],
    };

    const blockedTrustedHtml = renderAppToString();

    expect(blockedTrustedHtml).toContain('data-testid="trust-banner"');
    expect(mockTrustedPreviewRenderer).not.toHaveBeenCalled();

    appState.trustState = { canExecute: true };

    const allowedTrustedHtml = renderAppToString();

    expect(allowedTrustedHtml).toContain('data-testid="trusted-preview"');
    expect(mockTrustedPreviewRenderer).toHaveBeenCalledTimes(1);
  });

  it('opens external links on Ctrl/Cmd+click', () => {
    appState.trustState = { canExecute: true };
    appState.content = {
      mode: 'safe',
      html: '<p>safe</p>',
    };

    const { container, root } = mountApp();
    const link = container.querySelector('a');
    expect(link).toBeTruthy();

    act(() => {
      link!.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          ctrlKey: true,
        })
      );
    });

    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com');
    unmountApp(root);
  });
});
