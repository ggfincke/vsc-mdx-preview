// packages/extension/types/vscode/commands.ts
// type definitions for command handlers

import type * as vscode from 'vscode';

// command handler function signature (sync or async, no arguments)
export type CommandHandler = () => void | Promise<void>;

// command definition for registration
export interface CommandDefinition {
  // command ID (e.g., 'mdx-preview.commands.openPreview')
  id: string;
  // handler function
  handler: CommandHandler;
}

// command handler w/ optional Uri (for context menu commands)
export type UriCommandHandler = (uri?: vscode.Uri) => void | Promise<void>;

// command definition for Uri-accepting commands
export interface UriCommandDefinition {
  id: string;
  handler: UriCommandHandler;
}
