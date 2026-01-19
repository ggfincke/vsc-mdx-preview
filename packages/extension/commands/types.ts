// packages/extension/commands/types.ts
// command handler types and interfaces

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

