// packages/extension/module-system/handlers/JsonHandler.ts
// handler for JSON files - wraps as CommonJS module

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { buildModuleExportResult } from './result-builders';
import { JSON_EXTENSIONS } from '../../constants';

// handler for .json files - wraps JSON content as a CommonJS module export
export class JsonHandler implements FileTypeHandler {
  extensions = [...JSON_EXTENSIONS];

  async handle(
    code: string,
    fsPath: string,
    _preview: Preview
  ): Promise<FetchResult> {
    return buildModuleExportResult(fsPath, code);
  }
}
