// packages/extension/commands/framework-selection.ts
// framework selection QuickPick command

import * as vscode from 'vscode';
import { debug } from '../logging';
import {
  getConfigManager,
  getFrameworkDetector,
  getPreviewManager,
} from '../services';
import type { Framework } from '../framework';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';

const selectFramework = async (): Promise<void> => {
  debug('[CMD] selectFramework command triggered');

  const configManager = getConfigManager();
  const currentSetting = configManager.get('framework');
  const frameworkDetector = getFrameworkDetector();

  // Detect framework from active editor
  const editor = vscode.window.activeTextEditor;
  let detectedFramework: Framework = 'generic';
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
      description:
        currentSetting === 'astro-starlight' ? '(current)' : undefined,
      value: 'astro-starlight',
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
      'framework',
      selected.value as
        | 'auto'
        | 'generic'
        | 'docusaurus'
        | 'nextjs'
        | 'astro-starlight'
        | 'nextra',
      vscode.ConfigurationTarget.Workspace
    );

    // Refresh previews to apply framework changes
    getPreviewManager().refreshAllPreviews();

    vscode.window.showInformationMessage(
      `MDX framework set to ${selected.label}.`
    );
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SELECT_FRAMEWORK, handler: selectFramework },
];
