// tests/extension/fetch/css-rewrite.test.ts
// verify imported CSS references resolve from the stylesheet directory

import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { Preview } from '../../../packages/extension-host/src/features/preview/preview-manager';
import {
  buildCssResult,
  createSimpleHandler,
} from '../../../packages/extension-host/src/features/module-runtime/handlers/result-builders';
import { CSS_EXTENSIONS } from '../../../packages/extension-host/src/shared/constants';

describe('CSS reference rewriting', () => {
  it('rewrites relative url() & @import tokens while preserving inert URLs', async () => {
    const fsPath = path.join('/workspace', 'styles', 'main.css');
    const getWebviewUri = vi.fn(
      (resourcePath: string) => `webview:${resourcePath}`
    );
    const preview = { getWebviewUri } as Preview;
    const css = `
      /* url('../ignored-comment.png') */
      .label { content: "url('../ignored-string.png')"; }
      .hero { background: url('../images/hero.png?size=2#top'); }
      .icon { mask: url(icons/mask.svg); }
      @import './theme/base.css';
      @import url("../theme/fonts.css") screen;
      .remote { background: url(https://example.com/image.png); }
      .data { background: url(data:image/png;base64,AAAA); }
      .root { background: url('/images/root.png'); }
    `;

    const result = await createSimpleHandler(
      CSS_EXTENSIONS,
      buildCssResult
    ).handle(css, fsPath, preview);

    expect(result.css).toContain(
      `url('webview:${path.join('/workspace', 'images', 'hero.png')}?size=2#top')`
    );
    expect(result.css).toContain(
      `url(webview:${path.join('/workspace', 'styles', 'icons', 'mask.svg')})`
    );
    expect(result.css).toContain(
      `@import 'webview:${path.join('/workspace', 'styles', 'theme', 'base.css')}'`
    );
    expect(result.css).toContain(
      `url("webview:${path.join('/workspace', 'theme', 'fonts.css')}")`
    );
    expect(result.css).toContain("url('../ignored-comment.png')");
    expect(result.css).toContain('"url(\'../ignored-string.png\')"');
    expect(result.css).toContain('url(https://example.com/image.png)');
    expect(result.css).toContain('url(data:image/png;base64,AAAA)');
    expect(result.css).toContain("url('/images/root.png')");
  });
});
