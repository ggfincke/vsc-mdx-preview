// packages/extension/module-system/handlers/index.ts
// file type handler registry & dispatch for module fetching

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';
import type { FileTypeHandler } from '../../types';

// re-export canonical type definition from types/
export type { FileTypeHandler } from '../../types';

// import individual handlers
import {
  createSimpleHandler,
  buildCssResult,
  buildModuleExportResult,
} from './result-builders';
import { CSS_EXTENSIONS, JSON_EXTENSIONS } from '../../constants';
import { SassHandler } from './SassHandler';
import { ImageHandler } from './ImageHandler';
import { ScriptHandler } from './ScriptHandler';

// handler instances
const handlers: FileTypeHandler[] = [
  createSimpleHandler(JSON_EXTENSIONS, buildModuleExportResult),
  createSimpleHandler(CSS_EXTENSIONS, buildCssResult),
  new SassHandler(),
  new ImageHandler(),
  new ScriptHandler(),
];

// build extension -> handler lookup map
const handlerMap = new Map<string, FileTypeHandler>();
for (const handler of handlers) {
  for (const ext of handler.extensions) {
    handlerMap.set(ext.toLowerCase(), handler);
  }
}

// get the appropriate handler for a file extension (returns undefined if not found)
export function getHandler(extname: string): FileTypeHandler | undefined {
  return handlerMap.get(extname.toLowerCase());
}

// check if we have a handler for this file type
export function hasHandler(extname: string): boolean {
  return handlerMap.has(extname.toLowerCase());
}

// handle a file based on its extension (returns FetchResult or undefined if no handler)
export async function handleByExtension(
  code: string,
  fsPath: string,
  extname: string,
  preview: Preview
): Promise<FetchResult | undefined> {
  const handler = getHandler(extname);
  if (handler) {
    return handler.handle(code, fsPath, preview);
  }
  return undefined;
}

// re-export cache clearing for handlers that support it
export { clearSassCache } from './SassHandler';
