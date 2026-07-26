// tests/extension/handlers/css-handler.test.ts
// focused tests for CSS handler (factory-based) critical behavior

import { describe, it, expect } from 'vitest';
import {
  createSimpleHandler,
  buildCssResult,
} from '../../../packages/extension-host/src/features/module-runtime/handlers/result-builders';
import { CSS_EXTENSIONS } from '../../../packages/extension-host/src/shared/constants';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

const context = {
  getWebviewUri: () => undefined,
} as ModuleExecutionContext;

describe('CSS handler', () => {
  const handler = createSimpleHandler(CSS_EXTENSIONS, buildCssResult);

  it('handles .css files', () => {
    expect(handler.extensions).toContain('.css');
  });

  it('returns css payload for basic stylesheet', async () => {
    const css = '.button { padding: 10px; color: blue; }';
    const fsPath = '/workspace/styles/main.css';
    const result = await handler.handle(css, fsPath, context);

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

    const result = await handler.handle(
      css,
      '/workspace/styles/main.css',
      context
    );

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
      context
    );

    expect(result.css).toBe(invalidCss);
  });
});
