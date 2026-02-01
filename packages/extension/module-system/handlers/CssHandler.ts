// packages/extension/module-system/handlers/CssHandler.ts
// handler for CSS files - returns CSS for webview injection

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { buildCssResult } from './result-builders';
import { CSS_EXTENSIONS } from '../../constants';

// handler for .css files - returns CSS content for injection into the webview
export class CssHandler implements FileTypeHandler {
  extensions = [...CSS_EXTENSIONS];

  async handle(
    code: string,
    fsPath: string,
    _preview: Preview
  ): Promise<FetchResult> {
    return buildCssResult(fsPath, code);
  }
}
