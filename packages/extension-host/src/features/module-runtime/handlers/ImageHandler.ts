// packages/extension-host/src/features/module-runtime/handlers/ImageHandler.ts
// handler for image files - convert to webview URI

import type { FetchResult } from '@mdx-preview/contracts';
import type {
  FileTypeHandler,
  ModuleExecutionContext,
} from '../types/handlers';
import { createTransformError } from '../../../shared/errors';
import { buildModuleExportResult } from './result-builders';
import { IMAGE_EXTENSIONS } from '../../../shared/constants';

// handler for image files - convert file path to webview-accessible URI & wrap as module export
export class ImageHandler implements FileTypeHandler {
  extensions = [...IMAGE_EXTENSIONS];

  async handle(
    _code: string,
    fsPath: string,
    context: ModuleExecutionContext
  ): Promise<FetchResult> {
    const webviewUri = context.getWebviewUri(fsPath);

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
