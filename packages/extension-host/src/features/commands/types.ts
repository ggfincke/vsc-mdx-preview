// packages/extension-host/src/features/commands/types.ts
// type definitions for command handlers

import type * as vscode from 'vscode';

// command definition for registration
export interface CommandDefinition {
  // command ID (e.g., 'mdx-preview.commands.openPreview')
  id: string;
  // handler function
  handler: () => void | Promise<void>;
}

// command definition for Uri-accepting commands
export interface UriCommandDefinition {
  id: string;
  handler: (uri?: vscode.Uri) => void | Promise<void>;
}
