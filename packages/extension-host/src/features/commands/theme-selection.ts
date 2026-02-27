// packages/extension/commands/theme-selection.ts
// theme selection QuickPick commands

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import {
  LogTags,
  SOURCE_LINE_HIGHLIGHT_COLOR_VALUES,
  type SourceLineHighlightColorValue,
} from '@mdx-preview/contracts';
import { getConfigManager, getPreviewManager } from '../../app/services';
import {
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
  type PreviewTheme,
  type CodeBlockTheme,
  type MermaidTheme,
} from '../themes';
import { SETTINGS } from '../../shared/config/ConfigManager';
import type { SettingKey } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.THEME);

// theme selector factory options
interface ThemeSelectorOptions<T extends string> {
  configKey: SettingKey;
  themes: readonly T[];
  labels: Record<T, string>;
  placeHolder: string;
  logMessage: string;
}

const SOURCE_LINE_HIGHLIGHT_COLOR_LABELS: Record<
  SourceLineHighlightColorValue,
  string
> = {
  dependent: 'Dependent (VS Code Theme)',
  white: 'White',
  black: 'Black',
  auto: 'Auto (White/Black by Theme)',
};

// create QuickPick handler for a theme setting
function createThemeSelector<T extends string>(
  options: ThemeSelectorOptions<T>
): () => Promise<void> {
  return async (): Promise<void> => {
    log.debug(options.logMessage);

    const configManager = getConfigManager();
    const currentTheme = configManager.get(options.configKey) as T;

    const items = options.themes.map((theme) => ({
      label: options.labels[theme],
      description: theme === currentTheme ? '(current)' : undefined,
      theme,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: options.placeHolder,
      matchOnDescription: true,
    });

    if (selected) {
      await configManager.set(
        options.configKey,
        selected.theme,
        vscode.ConfigurationTarget.Global
      );
      getPreviewManager().refreshAllPreviews();
    }
  };
}

export const commands: CommandDefinition[] = [
  {
    id: CommandNames.SELECT_PREVIEW_THEME,
    handler: createThemeSelector<PreviewTheme>({
      configKey: SETTINGS.PREVIEW_THEME,
      themes: PREVIEW_THEMES,
      labels: PREVIEW_THEME_LABELS,
      placeHolder: 'Select preview theme',
      logMessage: 'selectPreviewTheme command triggered',
    }),
  },
  {
    id: CommandNames.SELECT_CODE_BLOCK_THEME,
    handler: createThemeSelector<CodeBlockTheme>({
      configKey: SETTINGS.CODE_BLOCK_THEME,
      themes: CODE_BLOCK_THEMES,
      labels: CODE_BLOCK_THEME_LABELS,
      placeHolder: 'Select code block theme',
      logMessage: 'selectCodeBlockTheme command triggered',
    }),
  },
  {
    id: CommandNames.SELECT_MERMAID_THEME,
    handler: createThemeSelector<MermaidTheme>({
      configKey: SETTINGS.MERMAID_THEME,
      themes: MERMAID_THEMES,
      labels: MERMAID_THEME_LABELS,
      placeHolder: 'Select Mermaid diagram theme',
      logMessage: 'selectMermaidTheme command triggered',
    }),
  },
  {
    id: CommandNames.SELECT_SOURCE_LINE_HIGHLIGHT_COLOR,
    handler: createThemeSelector<SourceLineHighlightColorValue>({
      configKey: SETTINGS.SOURCE_LINE_HIGHLIGHT_COLOR,
      themes: SOURCE_LINE_HIGHLIGHT_COLOR_VALUES,
      labels: SOURCE_LINE_HIGHLIGHT_COLOR_LABELS,
      placeHolder: 'Select source-line highlight color mode',
      logMessage: 'selectSourceLineHighlightColor command triggered',
    }),
  },
];
