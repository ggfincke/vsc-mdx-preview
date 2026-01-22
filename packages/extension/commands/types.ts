// packages/extension/commands/types.ts
// command handler types & interfaces

// command handler function signature
// commands can be sync or async, w/ no arguments
export type CommandHandler = () => void | Promise<void>;

// command definition for registration
export interface CommandDefinition {
  // command ID (e.g., 'mdx-preview.commands.openPreview')
  id: string;
  // handler function
  handler: CommandHandler;
}

