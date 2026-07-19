// packages/extension-host/src/app/extension-context.ts
// module-level holder for the ExtensionContext (set once during activation)

import type * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext | undefined;

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export function getExtensionContext(): vscode.ExtensionContext | undefined {
  return extensionContext;
}
