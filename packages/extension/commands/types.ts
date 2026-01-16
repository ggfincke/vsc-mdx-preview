// packages/extension/commands/types.ts
// command handler types and interfaces

import type * as vscode from 'vscode';

// Command handler function signature.
// Commands can be sync or async, w/ no arguments.
export type CommandHandler = () => void | Promise<void>;

// Command definition for registration.
export interface CommandDefinition {
  // Command ID (e.g., 'mdx-preview.commands.openPreview')
  id: string;
  // Handler function
  handler: CommandHandler;
}

// Command module interface - each command file exports this.
export interface CommandModule {
  // Array of command definitions to register
  commands: CommandDefinition[];
}

// Utility type for QuickPick items w/ extra data.
export interface QuickPickItemWithValue<T> extends vscode.QuickPickItem {
  value: T;
}
