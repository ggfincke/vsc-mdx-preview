// packages/extension/module-system/handlers/ImageHandler.ts
// handler for image files - converts to webview URI

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { createTransformError } from '../../errors';
import { buildModuleExportResult } from './result-builders';
import { IMAGE_EXTENSIONS } from '../../constants';

// handler for image files - converts file path to webview-accessible URI & wraps as module export
export class ImageHandler implements FileTypeHandler {
  extensions = [...IMAGE_EXTENSIONS];

  async handle(
    _code: string,
    fsPath: string,
    preview: Preview
  ): Promise<FetchResult> {
    const webviewUri = preview.getWebviewUri(fsPath);

    if (!webviewUri) {
      throw createTransformError(
        fsPath,
        undefined,
        new Error('Preview webview not initialized; cannot create webview URI')
      );
    }

    return buildModuleExportResult(fsPath, `"${webviewUri}"`);
  }
}
