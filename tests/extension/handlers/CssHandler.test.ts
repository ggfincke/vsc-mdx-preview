// tests/extension/handlers/CssHandler.test.ts
// focused tests for CSS handler critical behavior

import { describe, it, expect } from 'vitest';
import { CssHandler } from '../../../packages/extension/module-system/handlers/CssHandler';
import type { Preview } from '../../../packages/extension/preview/preview-manager';

const mockPreview = {} as Preview;

describe('CssHandler', () => {
  const handler = new CssHandler();

  it('handles .css files', () => {
    expect(handler.extensions).toContain('.css');
  });

  it('returns css payload for basic stylesheet', async () => {
    const css = '.button { padding: 10px; color: blue; }';
    const fsPath = '/workspace/styles/main.css';
    const result = await handler.handle(css, fsPath, mockPreview);

    expect(result).toEqual({
      fsPath,
      css,
      code: '',
      dependencies: [],
    });
  });

  it('preserves @import statements as browser-managed CSS', async () => {
    const css = `
      @import url('./reset.css');
      @import './theme.css';
      .main { color: red; }
    `;

    const result = await handler.handle(css, '/workspace/styles/main.css', mockPreview);

    expect(result.css).toBe(css);
    expect(result.dependencies).toEqual([]);
  });

  it('passes malformed CSS through without throwing', async () => {
    const invalidCss = `
      .broken { color: ; }
      .incomplete {
    `;

    const result = await handler.handle(
      invalidCss,
      '/workspace/styles/broken.css',
      mockPreview
    );

    expect(result.css).toBe(invalidCss);
  });

  it('supports empty files', async () => {
    const result = await handler.handle(
      '',
      '/workspace/styles/empty.css',
      mockPreview
    );

    expect(result.css).toBe('');
    expect(result.code).toBe('');
    expect(result.dependencies).toEqual([]);
  });

  it('preserves provided file path verbatim', async () => {
    const fsPath = 'C:\\Users\\dev\\workspace\\styles\\main.css';
    const result = await handler.handle('.x{}', fsPath, mockPreview);

    expect(result.fsPath).toBe(fsPath);
  });
});
