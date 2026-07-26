// packages/extension-host/src/features/preview/types/preview.ts
// type definitions for preview system

import type * as vscode from 'vscode';

// webview app URIs (loaded from Vite manifest)
export interface WebviewAppUris {
  mainScript: vscode.Uri;
  mainStyle: vscode.Uri | undefined;
  tailwindBrowserScript?: vscode.Uri;
}

// style configuration for preview rendering
export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

// result of configuration change detection
export interface ConfigChangeResult {
  needsWebviewRefresh: boolean;
  needsRuntimeConfigPush: boolean;
  needsCssWatcherUpdate: boolean;
  scrollSyncChanged: boolean;
}
