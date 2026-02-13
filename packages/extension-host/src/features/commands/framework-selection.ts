// packages/extension/commands/framework-selection.ts
// framework selection QuickPick command

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import {
  getConfigManager,
  getFrameworkDetector,
  getPreviewManager,
} from '../../app/services';
import type { FrameworkId, FrameworkSetting } from '@mdx-preview/contracts';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';

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

  const frameworks: Array<{
    label: string;
    description?: string;
    value: string;
  }> = [
    {
      label: 'Auto-detect',
      description:
        currentSetting === 'auto'
          ? `(current - detected: ${frameworkDetector.getFrameworkDisplayName(detectedFramework)})`
          : `(detected: ${frameworkDetector.getFrameworkDisplayName(detectedFramework)})`,
      value: 'auto',
    },
    {
      label: 'Generic',
      description: currentSetting === 'generic' ? '(current)' : undefined,
      value: 'generic',
    },
    {
      label: 'Docusaurus',
      description: currentSetting === 'docusaurus' ? '(current)' : undefined,
      value: 'docusaurus',
    },
    {
      label: 'Next.js',
      description: currentSetting === 'nextjs' ? '(current)' : undefined,
      value: 'nextjs',
    },
    {
      label: 'Astro Starlight',
      description: currentSetting === 'starlight' ? '(current)' : undefined,
      value: 'starlight',
    },
    {
      label: 'Nextra',
      description: currentSetting === 'nextra' ? '(current)' : undefined,
      value: 'nextra',
    },
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

    // refresh previews to apply framework changes
    getPreviewManager().refreshAllPreviews();

    vscode.window.showInformationMessage(
      `MDX framework set to ${selected.label}.`
    );
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SELECT_FRAMEWORK, handler: selectFramework },
];
