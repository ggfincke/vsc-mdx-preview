// packages/extension/commands/theme-selection.ts
// theme selection QuickPick commands

import * as vscode from 'vscode';
import { debug } from '../logging';
import { getConfigManager, getPreviewManager } from '../services';
import {
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  type PreviewTheme,
  type CodeBlockTheme,
} from '../themes';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const selectPreviewTheme = async (): Promise<void> => {
  debug('[CMD] selectPreviewTheme command triggered');

  const configManager = getConfigManager();
  const currentTheme = configManager.get('preview.previewTheme') as PreviewTheme;

  const items = PREVIEW_THEMES.map((theme) => ({
    label: PREVIEW_THEME_LABELS[theme],
    description: theme === currentTheme ? '(current)' : undefined,
    theme,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select preview theme',
    matchOnDescription: true,
  });

  if (selected) {
    await configManager.set(
      'preview.previewTheme',
      selected.theme,
      vscode.ConfigurationTarget.Global
    );
    // refresh previews to apply theme
    getPreviewManager().refreshAllPreviews();
  }
};

const selectCodeBlockTheme = async (): Promise<void> => {
  debug('[CMD] selectCodeBlockTheme command triggered');

  const configManager = getConfigManager();
  const currentTheme = configManager.get('preview.codeBlockTheme') as CodeBlockTheme;

  const items = CODE_BLOCK_THEMES.map((theme) => ({
    label: CODE_BLOCK_THEME_LABELS[theme],
    description: theme === currentTheme ? '(current)' : undefined,
    theme,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select code block theme',
    matchOnDescription: true,
  });

  if (selected) {
    await configManager.set(
      'preview.codeBlockTheme',
      selected.theme,
      vscode.ConfigurationTarget.Global
    );
    // refresh previews to apply theme
    getPreviewManager().refreshAllPreviews();
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SELECT_PREVIEW_THEME, handler: selectPreviewTheme },
  { id: CommandNames.SELECT_CODE_BLOCK_THEME, handler: selectCodeBlockTheme },
];
