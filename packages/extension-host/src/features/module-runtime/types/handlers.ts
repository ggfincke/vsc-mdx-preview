// packages/extension-host/src/features/module-runtime/types/handlers.ts
// type definitions for file type handlers

import type * as vscode from 'vscode';
import type { FetchResult } from '@mdx-preview/contracts';

// capabilities needed while executing one fetched module
export interface ModuleExecutionContext {
  documentUri: vscode.Uri;
  entryFsDirectory: string | null;
  useSucraseTranspiler: boolean;
  getWebviewUri(fsPath: string): string | undefined;
}

// handler for a specific file type
// each handler knows how to transform its file type into a module result
export interface FileTypeHandler {
  // file extensions this handler processes (e.g., ['.json'])
  extensions: string[];

  // handle a file of this type (returns FetchResult w/ transformed code & dependencies)
  handle(
    code: string,
    fsPath: string,
    context: ModuleExecutionContext
  ): Promise<FetchResult>;
}
