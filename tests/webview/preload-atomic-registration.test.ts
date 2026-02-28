// tests/webview/preload-atomic-registration.test.ts
// preload atomic registration test coverage
import { beforeEach, describe, expect, it } from 'vitest';
import { setPreloadEntries } from 'mdx-forge/browser';
import { registry } from 'mdx-forge/browser';
import { createSyncRequire } from 'mdx-forge/browser';
import {
  loadDocusaurusShims,
  preloadGenericShims,
} from '../../packages/webview-client/src/generated/preload/preload.generated';

describe('preload atomic registration', () => {
  beforeEach(() => {
    registry.clear();
    setPreloadEntries([]);
  });

  it('registers module exports and aliases in one atomic preload entry', () => {
    preloadGenericShims(registry);

    const requireFromEntry = createSyncRequire('/workspace/docs/index.mdx');
    const byBareAlias = requireFromEntry('Callout') as Record<string, unknown>;
    const byShimPath = requireFromEntry(
      '@mdx-preview/shims/generic/Callout'
    ) as Record<string, unknown>;

    expect(registry.has('npm://@mdx-preview/shims-generic/Callout')).toBe(true);
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
});
