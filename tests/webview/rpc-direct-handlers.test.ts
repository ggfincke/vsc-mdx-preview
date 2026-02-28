// tests/webview/rpc-direct-handlers.test.ts
// unit tests for direct webview RPC handlers
//
// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StyleInjector,
  STYLE_IDS,
} from '../../packages/webview-client/src/shared/utils/StyleInjector';
import { createRpcDirectHandlers } from '../../packages/webview-client/src/platform/rpc/rpc-direct-handlers';

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('createRpcDirectHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('setCustomCss injects custom CSS style tag', () => {
    const injectSpy = vi
      .spyOn(StyleInjector, 'inject')
      .mockImplementation(() => {});
    const handlers = createRpcDirectHandlers({ log: createLogger() });

    handlers.setCustomCss('.foo { color: red; }');

    expect(injectSpy).toHaveBeenCalledWith(
      STYLE_IDS.CUSTOM_CSS,
      '.foo { color: red; }'
    );
  });

  it('setTailwindCss toggles tailwind style channels correctly', () => {
    const injectSpy = vi
      .spyOn(StyleInjector, 'inject')
      .mockImplementation(() => {});
    const removeSpy = vi
      .spyOn(StyleInjector, 'remove')
      .mockImplementation(() => {});
    const handlers = createRpcDirectHandlers({ log: createLogger() });

    handlers.setTailwindCss('');
    expect(removeSpy).toHaveBeenCalledWith(
      STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS
    );
    expect(removeSpy).toHaveBeenCalledWith(STYLE_IDS.TAILWIND_CSS);

    handlers.setTailwindCss('.x { color: blue; }');
    expect(injectSpy).toHaveBeenCalledWith(
      STYLE_IDS.TAILWIND_CSS,
      '.x { color: blue; }',
      { insertBefore: STYLE_IDS.CUSTOM_CSS }
    );
  });

  it('setTailwindBrowserCss injects browser input CSS with attributes', () => {
    const injectSpy = vi
      .spyOn(StyleInjector, 'inject')
      .mockImplementation(() => {});
    const removeSpy = vi
      .spyOn(StyleInjector, 'remove')
      .mockImplementation(() => {});
    const handlers = createRpcDirectHandlers({ log: createLogger() });

    handlers.setTailwindBrowserCss('@theme { --x: 1; }');

    expect(removeSpy).toHaveBeenCalledWith(STYLE_IDS.TAILWIND_CSS);
    expect(injectSpy).toHaveBeenCalledWith(
      STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS,
      '@theme { --x: 1; }',
      {
        insertBefore: STYLE_IDS.CUSTOM_CSS,
        attributes: { type: 'text/tailwindcss' },
      }
    );
  });

  it('loads framework/components shims and handles invalidate/clearAllCaches', async () => {
    const ensureFrameworkShimsLoaded = vi.fn();
    const ensureGenericShimsLoaded = vi.fn();
    const invalidateModule = vi.fn();
    const clearAllCaches = vi.fn();
    const loadModuleSystemFn = vi.fn(async () => ({
      ensureFrameworkShimsLoaded,
      ensureGenericShimsLoaded,
      invalidateModule,
      clearAllCaches,
    }));

    const staleStyle = document.createElement('style');
    staleStyle.setAttribute('data-mdx-module', 'true');
    document.head.appendChild(staleStyle);

    const handlers = createRpcDirectHandlers({
      log: createLogger(),
      loadModuleSystemFn: loadModuleSystemFn as any,
      documentRef: document,
    });

    handlers.setFramework('nextra');
    handlers.setUsedComponents(['Callout']);
    await Promise.resolve();

    await handlers.invalidate('/workspace/x.ts');
    await handlers.clearAllCaches();

    expect(ensureFrameworkShimsLoaded).toHaveBeenCalledWith('nextra');
    expect(ensureGenericShimsLoaded).toHaveBeenCalledWith(['Callout']);
    expect(invalidateModule).toHaveBeenCalledWith('/workspace/x.ts');
    expect(clearAllCaches).toHaveBeenCalledTimes(1);
    expect(document.querySelector('style[data-mdx-module]')).toBeNull();
  });
});
