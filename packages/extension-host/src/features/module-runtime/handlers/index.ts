// packages/extension-host/src/features/module-runtime/handlers/index.ts
// file type handler registry & dispatch for module fetching

import type { FetchResult } from '@mdx-preview/contracts';
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
import { CSS_EXTENSIONS, JSON_EXTENSIONS } from '../../../shared/constants';
import { SassHandler } from './SassHandler';
import { ImageHandler } from './ImageHandler';
import { ScriptHandler } from './ScriptHandler';

// shared script handler instance (reused as the unknown-type fallback)
const scriptHandlerInstance = new ScriptHandler();

// expose the shared script handler for fallback dispatch
export function getScriptHandler(): FileTypeHandler {
  return scriptHandlerInstance;
}

// handler instances
const handlers: FileTypeHandler[] = [
  createSimpleHandler(JSON_EXTENSIONS, buildModuleExportResult),
  createSimpleHandler(CSS_EXTENSIONS, buildCssResult),
  new SassHandler(),
  new ImageHandler(),
  scriptHandlerInstance,
];

// build extension -> handler lookup map
const handlerMap = new Map<string, FileTypeHandler>();
for (const handler of handlers) {
  for (const ext of handler.extensions) {
    handlerMap.set(ext.toLowerCase(), handler);
  }
}

// get the appropriate handler for a file extension (returns undefined if not found)
function getHandler(extname: string): FileTypeHandler | undefined {
  return handlerMap.get(extname.toLowerCase());
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
