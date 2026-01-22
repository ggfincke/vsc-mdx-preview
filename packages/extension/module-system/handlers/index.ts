// packages/extension/module-system/handlers/index.ts
// file type handler registry & dispatch for module fetching

import type { FetchResult } from '@mdx-preview/shared';
import type { Preview } from '../../preview/preview-manager';

// handler for a specific file type - each handler knows how to transform its file type into a module result
export interface FileTypeHandler {
  // file extensions this handler processes (e.g., ['.json'])
  extensions: string[];

  // handle a file of this type (returns FetchResult w/ transformed code & dependencies)
  handle(code: string, fsPath: string, preview: Preview): Promise<FetchResult>;
}

// import individual handlers
import { JsonHandler } from './JsonHandler';
import { CssHandler } from './CssHandler';
import { SassHandler } from './SassHandler';
import { ImageHandler } from './ImageHandler';
import { ScriptHandler } from './ScriptHandler';

// handler instances
const handlers: FileTypeHandler[] = [
  new JsonHandler(),
  new CssHandler(),
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
