// packages/extension/commands/types.ts
// command handler types & interfaces

// command handler function signature (sync or async, no arguments)
export type CommandHandler = () => void | Promise<void>;

// command definition for registration
export interface CommandDefinition {
  // command ID (e.g., 'mdx-preview.commands.openPreview')
  id: string;
  // handler function
  handler: CommandHandler;
}

