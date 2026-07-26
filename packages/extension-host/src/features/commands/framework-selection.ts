// packages/extension-host/src/features/commands/framework-selection.ts
// framework selection QuickPick command

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { FRAMEWORK_IDS, LogTags } from '@mdx-preview/contracts';
import { getConfigManager, getFrameworkDetector } from '../../app/services';
import {
  type FrameworkId,
  type FrameworkSetting,
  FRAMEWORK_METADATA,
} from '@mdx-preview/contracts';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const log = createTaggedLogger(LogTags.FRAMEWORK);

const selectFramework = async (): Promise<void> => {
  log.debug('selectFramework command triggered');

  const configManager = getConfigManager();
  const currentSetting = configManager.get(SETTINGS.FRAMEWORK);
  const frameworkDetector = getFrameworkDetector();

  // detect framework from active editor
  const editor = vscode.window.activeTextEditor;
  let detectedFramework: FrameworkId = 'generic';
  if (editor) {
    const info = frameworkDetector.getFramework(editor.document.uri);
    if (info.detected) {
      detectedFramework = info.framework;
    }
  }

  const detectedDisplayName =
    frameworkDetector.getFrameworkDisplayName(detectedFramework);

  // build picker items from canonical framework metadata
  const frameworks: Array<{
    label: string;
    description?: string;
    value: string;
  }> = [
    {
      label: 'Auto-detect',
      description:
        currentSetting === 'auto'
          ? `(current - detected: ${detectedDisplayName})`
          : `(detected: ${detectedDisplayName})`,
      value: 'auto',
    },
    ...FRAMEWORK_IDS.map((id) => ({
      label: FRAMEWORK_METADATA[id].pickerLabel,
      description: currentSetting === id ? '(current)' : undefined,
      value: id,
    })),
  ];

  const selected = await vscode.window.showQuickPick(frameworks, {
    placeHolder: 'Select MDX framework',
    matchOnDescription: true,
  });

  if (selected) {
    await configManager.set(
      SETTINGS.FRAMEWORK,
      selected.value as FrameworkSetting,
      vscode.ConfigurationTarget.Workspace
    );

    vscode.window.showInformationMessage(
      `MDX framework set to ${selected.label}.`
    );
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SELECT_FRAMEWORK, handler: selectFramework },
];
