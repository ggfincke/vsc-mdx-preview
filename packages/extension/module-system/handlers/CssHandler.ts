// packages/extension/module-system/handlers/CssHandler.ts
// handler for CSS files - returns CSS for webview injection

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';

// handler for .css files - returns CSS content for injection into the webview
export class CssHandler implements FileTypeHandler {
  extensions = ['.css'];

  async handle(
    code: string,
    fsPath: string,
    _preview: Preview
  ): Promise<FetchResult> {
    return {
      fsPath,
      css: code,
      code: '',
      dependencies: [],
    };
  }
}
