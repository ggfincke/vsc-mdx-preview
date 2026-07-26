// tests/webview/preload-atomic-registration.test.ts
// preload atomic registration test coverage
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPreloadEntries } from 'mdx-forge/browser';
import { registry } from 'mdx-forge/browser';
import { createSyncRequire } from 'mdx-forge/browser';
import {
  loadDocusaurusShims,
  preloadGenericShims,
} from '../../packages/webview-client/src/generated/preload/preload.generated';

const PRELOAD_GENERATED =
  '../../packages/webview-client/src/generated/preload/preload.generated';
const FRAMEWORK_CSS_LOADER =
  '../../packages/webview-client/src/generated/framework-css/frameworkCssLoader';
const TAGGED_LOGGER =
  '../../packages/webview-client/src/shared/utils/createTaggedLogger';
const APP_CONSTANTS = '../../packages/webview-client/src/app/constants';

async function importPreloadWithMocks({
  frameworkLoader,
  fallbackLoader,
  cssLoader,
}: {
  frameworkLoader: (registryValue: unknown) => Promise<void>;
  fallbackLoader: (registryValue: unknown) => void;
  cssLoader: (framework: string) => Promise<void>;
}) {
  vi.resetModules();
  vi.doMock(TAGGED_LOGGER, () => {
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };

    return {
      createTaggedLogger: () => logger,
    };
  });
  vi.doMock(APP_CONSTANTS, () => ({
    SHIM_LOAD_MAX_RETRIES: 0,
    SHIM_LOAD_RETRY_DELAY_MS: 1,
  }));
  vi.doMock(PRELOAD_GENERATED, () => ({
    FRAMEWORK_LOADERS: {
      docusaurus: frameworkLoader,
    },
    GENERIC_SHIM_LOADERS: {},
    preloadGenericShims: fallbackLoader,
  }));
  vi.doMock(FRAMEWORK_CSS_LOADER, () => ({
    loadFrameworkCss: cssLoader,
  }));
  return import('../../packages/webview-client/src/features/module-runtime/preload/index');
}

describe('preload atomic registration', () => {
  beforeEach(() => {
    registry.clear();
    setPreloadEntries([]);
  });

  afterEach(() => {
    vi.doUnmock(APP_CONSTANTS);
    vi.doUnmock(FRAMEWORK_CSS_LOADER);
    vi.doUnmock(PRELOAD_GENERATED);
    vi.doUnmock(TAGGED_LOGGER);
    vi.resetModules();
  });

  it('registers module exports and aliases in one atomic preload entry', async () => {
    const preloadGeneric = vi.fn(preloadGenericShims);
    const { initPreloadedModules } = await importPreloadWithMocks({
      frameworkLoader: vi.fn(),
      fallbackLoader: preloadGeneric,
      cssLoader: vi.fn().mockResolvedValue(undefined),
    });

    initPreloadedModules(registry, {});

    const requireFromEntry = createSyncRequire('/workspace/docs/index.mdx');
    const byBareAlias = requireFromEntry('Callout') as Record<string, unknown>;
    const byShimPath = requireFromEntry(
      '@mdx-preview/shims/generic/Callout'
    ) as Record<string, unknown>;

    expect(registry.has('npm://@mdx-preview/shims-generic/Callout')).toBe(true);
    expect(preloadGeneric).toHaveBeenCalledWith(registry);
    expect(byBareAlias).toBe(byShimPath);
    expect(typeof byBareAlias.default).toBe('function');
  });

  it('supports dynamic framework shim alias registration through the same entry model', async () => {
    await loadDocusaurusShims(registry);

    const requireFromEntry = createSyncRequire('/workspace/docs/index.mdx');
    const tabs = requireFromEntry('@theme/Tabs') as Record<string, unknown>;

    expect(registry.has('npm://@mdx-preview/shims-docusaurus/Tabs')).toBe(true);
    expect(typeof tabs.default).toBe('function');
  });

  it('retries framework shims after a generic fallback', async () => {
    let shouldFail = true;
    const frameworkLoader = vi.fn(async () => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('shim chunk failed');
      }
    });
    const fallbackLoader = vi.fn();
    const cssLoader = vi.fn().mockResolvedValue(undefined);
    const { ensureFrameworkShims } = await importPreloadWithMocks({
      frameworkLoader,
      fallbackLoader,
      cssLoader,
    });

    await ensureFrameworkShims(registry, 'docusaurus');
    await ensureFrameworkShims(registry, 'docusaurus');

    expect(frameworkLoader).toHaveBeenCalledTimes(2);
    expect(fallbackLoader).toHaveBeenCalledTimes(1);
  });

  it('clears failed framework CSS loads before retrying', async () => {
    const frameworkLoader = vi.fn().mockResolvedValue(undefined);
    const fallbackLoader = vi.fn();
    const cssLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('css chunk failed'))
      .mockResolvedValue(undefined);
    const { ensureFrameworkShims } = await importPreloadWithMocks({
      frameworkLoader,
      fallbackLoader,
      cssLoader,
    });

    await expect(ensureFrameworkShims(registry, 'docusaurus')).rejects.toThrow(
      'css chunk failed'
    );
    await expect(
      ensureFrameworkShims(registry, 'docusaurus')
    ).resolves.toBeUndefined();

    expect(frameworkLoader).toHaveBeenCalledTimes(2);
    expect(cssLoader).toHaveBeenCalledTimes(2);
  });
});
