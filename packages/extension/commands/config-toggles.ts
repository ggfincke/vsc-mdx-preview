// packages/extension/commands/config-toggles.ts
// simple configuration toggle commands

import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';
import { getConfigManager } from '../services';

const toggleUseVscodeMarkdownStyles = async (): Promise<void> => {
  const configManager = getConfigManager();
  const currentValue = configManager.get('preview.useVscodeMarkdownStyles');
  await configManager.set('preview.useVscodeMarkdownStyles', !currentValue);
};

const toggleUseWhiteBackground = async (): Promise<void> => {
  const configManager = getConfigManager();
  const currentValue = configManager.get('preview.useWhiteBackground');
  await configManager.set('preview.useWhiteBackground', !currentValue);
};

export const commands: CommandDefinition[] = [
  {
    id: CommandNames.TOGGLE_VSCODE_MARKDOWN_STYLES,
    handler: toggleUseVscodeMarkdownStyles,
  },
  {
    id: CommandNames.TOGGLE_WHITE_BACKGROUND,
    handler: toggleUseWhiteBackground,
  },
];
