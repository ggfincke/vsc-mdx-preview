// packages/extension/commands/config-toggles.ts
// simple configuration toggle commands

import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';
import { getConfigManager } from '../services';

// boolean config keys used by toggle commands
type BooleanToggleKey =
  | 'preview.useVscodeMarkdownStyles'
  | 'preview.useWhiteBackground';

// create toggle handler for a boolean config key
function createBooleanToggle(key: BooleanToggleKey): () => Promise<void> {
  return async (): Promise<void> => {
    const configManager = getConfigManager();
    const currentValue = configManager.get(key);
    await configManager.set(key, !currentValue);
  };
}

export const commands: CommandDefinition[] = [
  {
    id: CommandNames.TOGGLE_VSCODE_MARKDOWN_STYLES,
    handler: createBooleanToggle('preview.useVscodeMarkdownStyles'),
  },
  {
    id: CommandNames.TOGGLE_WHITE_BACKGROUND,
    handler: createBooleanToggle('preview.useWhiteBackground'),
  },
];
