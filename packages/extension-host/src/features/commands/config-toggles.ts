// packages/extension-host/src/features/commands/config-toggles.ts
// simple configuration toggle commands

import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';
import { getConfigManager } from '../../app/services';
import { SETTINGS } from '../../shared/config/ConfigManager';

// boolean config keys used by toggle commands
type BooleanToggleKey =
  | typeof SETTINGS.USE_VSCODE_MARKDOWN_STYLES
  | typeof SETTINGS.USE_WHITE_BACKGROUND;

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
    handler: createBooleanToggle(SETTINGS.USE_VSCODE_MARKDOWN_STYLES),
  },
  {
    id: CommandNames.TOGGLE_WHITE_BACKGROUND,
    handler: createBooleanToggle(SETTINGS.USE_WHITE_BACKGROUND),
  },
];
