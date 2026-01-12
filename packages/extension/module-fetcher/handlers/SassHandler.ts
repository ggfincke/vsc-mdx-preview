// packages/extension/module-fetcher/handlers/SassHandler.ts
// handler for SASS/SCSS files - compiles to CSS

import * as path from 'path';
import * as sass from 'sass';
import type { FetchResult } from '@mdx-preview/shared-types';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from './index';
import { getBrowserResolver } from '../resolver-factory';

// handler for .scss & .sass files - compiles SASS/SCSS to CSS using the sass compiler
export class SassHandler implements FileTypeHandler {
  extensions = ['.scss', '.sass'];

  async handle(
    _code: string,
    fsPath: string,
    _preview: Preview
  ): Promise<FetchResult> {
    const browserResolver = getBrowserResolver();

    const result = await sass.compileAsync(fsPath, {
      importers: [
        {
          findFileUrl: (url: string) => {
            const resolved = browserResolver.resolveSync(
              {},
              path.dirname(fsPath),
              url
            );
            if (resolved === false || resolved === undefined) {
              return null;
            }
            return new URL(`file://${resolved}`);
          },
        },
      ],
    });

    return {
      fsPath,
      css: result.css,
      code: '',
      dependencies: [],
    };
  }
}
