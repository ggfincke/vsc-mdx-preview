// packages/extension/module-system/handlers/ImageHandler.ts
// handler for image files - converts to webview URI

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { createTransformError } from '../../errors/module-error-factories';
import { buildModuleExportResult } from './result-builders';

// handler for image files (.gif, .png, .jpg, .jpeg, .svg) - converts file path to webview-accessible URI & wraps as module export
export class ImageHandler implements FileTypeHandler {
  extensions = ['.gif', '.png', '.jpg', '.jpeg', '.svg'];

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
