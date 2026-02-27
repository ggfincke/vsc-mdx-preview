// tests/webview/TrustBanner.test.ts
// unit tests for TrustBanner dismissal persistence behavior
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { TrustState } from '@mdx-preview/contracts';

const { mockManageTrust, mockOpenSettings } = vi.hoisted(() => ({
  mockManageTrust: vi.fn(),
  mockOpenSettings: vi.fn(),
}));

vi.mock(
  '../../packages/webview-client/src/platform/rpc/webview-rpc-client',
  () => ({
    ExtensionHandle: {
      manageTrust: (...args: unknown[]) => mockManageTrust(...args),
      openSettings: (...args: unknown[]) => mockOpenSettings(...args),
    },
  })
);

import { TrustBanner } from '../../packages/webview-client/src/features/preview/shared/ui/TrustBanner/TrustBanner';

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
  });
}

function mountTrustBanner(
  trustState: TrustState,
  dismissible = true
): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(TrustBanner, { trustState, dismissible }));
  });

  return { container, root };
}

function unmount(root: Root): void {
  act(() => {
    root.unmount();
  });
}

function createTrustState(overrides: Partial<TrustState>): TrustState {
  return {
    workspaceTrusted: true,
    scriptsEnabled: true,
    canExecute: true,
    openMdxLinksInPreview: false,
    ...overrides,
  };
}

describe('TrustBanner', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    installLocalStorageMock();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  it('persists dismissal for scripts-disabled banner across remounts', () => {
    const scriptsDisabledState = createTrustState({
      canExecute: false,
      scriptsEnabled: false,
      reason:
        'Scripts are not enabled. Enable "mdx-preview.preview.enableScripts" in settings.',
    });

    const firstMount = mountTrustBanner(scriptsDisabledState);
    expect(firstMount.container.textContent).toContain('Safe Mode');

    const dismissButton = firstMount.container.querySelector(
      '[aria-label="Dismiss banner"]'
    );
    expect(dismissButton).toBeTruthy();
    act(() => {
      dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(firstMount.container.textContent).toBe('');
    unmount(firstMount.root);

    const secondMount = mountTrustBanner(scriptsDisabledState);
    expect(secondMount.container.textContent).toBe('');
    unmount(secondMount.root);
  });

  it('clears persisted dismissal after returning to trusted mode', () => {
    const scriptsDisabledState = createTrustState({
      canExecute: false,
      scriptsEnabled: false,
      reason:
        'Scripts are not enabled. Enable "mdx-preview.preview.enableScripts" in settings.',
    });

    const firstMount = mountTrustBanner(scriptsDisabledState);
    const dismissButton = firstMount.container.querySelector(
      '[aria-label="Dismiss banner"]'
    );
    act(() => {
      dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    unmount(firstMount.root);

    const trustedMount = mountTrustBanner(
      createTrustState({
        canExecute: true,
        scriptsEnabled: true,
      })
    );
    expect(trustedMount.container.textContent).toBe('');
    unmount(trustedMount.root);

    const scriptsDisabledAgain = mountTrustBanner(scriptsDisabledState);
    expect(scriptsDisabledAgain.container.textContent).toContain('Safe Mode');
    unmount(scriptsDisabledAgain.root);
  });

  it('opens the enable scripts setting from the primary action', () => {
    const scriptsDisabledState = createTrustState({
      canExecute: false,
      scriptsEnabled: false,
    });

    const { container, root } = mountTrustBanner(scriptsDisabledState);
    const enableScriptsButton = Array.from(
      container.querySelectorAll('button')
    ).find((button) => button.textContent?.includes('Enable Scripts'));
    expect(enableScriptsButton).toBeTruthy();

    act(() => {
      enableScriptsButton?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    expect(mockOpenSettings).toHaveBeenCalledWith(
      'mdx-preview.preview.enableScripts'
    );
    unmount(root);
  });
});
