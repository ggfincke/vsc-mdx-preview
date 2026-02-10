// packages/extension/types/handlers/index.ts
// type definitions for file type handlers

import type { FetchResult } from '@mdx-preview/contracts';
import type { Preview } from '../../preview/preview-manager';

// handler for a specific file type
// each handler knows how to transform its file type into a module result
export interface FileTypeHandler {
  // file extensions this handler processes (e.g., ['.json'])
  extensions: string[];

  // handle a file of this type (returns FetchResult w/ transformed code & dependencies)
  handle(code: string, fsPath: string, preview: Preview): Promise<FetchResult>;
}
