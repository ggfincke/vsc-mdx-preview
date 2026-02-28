// tests/extension/config/setting-keys.test.ts
// guard key groups used by workspace configuration subscriptions

import { describe, expect, it } from 'vitest';
import {
  PREVIEW_CONFIG_KEYS,
  PREVIEW_RUNTIME_CONFIG_KEYS,
  SETTINGS,
} from '../../../packages/extension-host/src/shared/config/setting-keys';

describe('setting key groups', () => {
  it('defines show-frontmatter & show-toc constants', () => {
    expect(SETTINGS.SHOW_FRONTMATTER).toBe('preview.showFrontmatter');
    expect(SETTINGS.SHOW_TOC).toBe('preview.showToc');
  });

  it('includes runtime keys in preview subscription group', () => {
    expect(PREVIEW_CONFIG_KEYS).toContain(SETTINGS.SHOW_FRONTMATTER);
    expect(PREVIEW_CONFIG_KEYS).toContain(SETTINGS.SHOW_TOC);
    expect(PREVIEW_CONFIG_KEYS).toContain(SETTINGS.SOURCE_LINE_HIGHLIGHT);
    expect(PREVIEW_CONFIG_KEYS).toContain(SETTINGS.SOURCE_LINE_HIGHLIGHT_COLOR);
    expect(PREVIEW_CONFIG_KEYS).toContain(SETTINGS.SHIM_SIDE_RAIL);
  });

  it('keeps runtime key group explicit for runtime-only pushes', () => {
    expect(PREVIEW_RUNTIME_CONFIG_KEYS).toEqual(
      expect.arrayContaining([
        SETTINGS.SHOW_FRONTMATTER,
        SETTINGS.SHOW_TOC,
        SETTINGS.SOURCE_LINE_HIGHLIGHT,
        SETTINGS.SOURCE_LINE_HIGHLIGHT_COLOR,
        SETTINGS.SHIM_SIDE_RAIL,
      ])
    );
  });
});
