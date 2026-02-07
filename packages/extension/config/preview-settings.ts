// packages/extension/config/preview-settings.ts
// shared helpers for preview settings mapping

import type * as vscode from 'vscode';
import type { ConfigManager, SettingTypes } from './ConfigManager';
import type { ConfigurationState } from '../types';

// map full settings snapshot to preview configuration state
export function mapSettingsToPreviewConfiguration(
  settings: SettingTypes
): ConfigurationState {
  return {
    updateMode: settings['preview.updateMode'],
    debounceDelay: settings['preview.debounceDelay'],
    useVscodeMarkdownStyles: settings['preview.useVscodeMarkdownStyles'],
    useWhiteBackground: settings['preview.useWhiteBackground'],
    customLayoutFilePath: settings['preview.mdx.customLayoutFilePath'],
    customCss: settings['preview.customCss'],
    plantUmlServer: settings['diagrams.plantUmlServer'],
    useSucraseTranspiler: settings['build.useSucraseTranspiler'],
    securityPolicy: settings['preview.security'],
    tailwindEnabled: settings['tailwind.enabled'],
  };
}

// read preview configuration state from VS Code settings
export function readPreviewConfigurationState(
  configManager: ConfigManager,
  docUri: vscode.Uri
): ConfigurationState {
  return mapSettingsToPreviewConfiguration(configManager.getAll(docUri));
}
