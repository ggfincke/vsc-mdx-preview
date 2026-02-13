// packages/extension/config/preview-settings.ts
// shared helpers for preview settings mapping

import type * as vscode from 'vscode';
import { SETTINGS } from './ConfigManager';
import type { ConfigManager, SettingTypes } from './ConfigManager';
import type { ConfigurationState } from '../types';

// map full settings snapshot to preview configuration state
export function mapSettingsToPreviewConfiguration(
  settings: SettingTypes
): ConfigurationState {
  return {
    updateMode: settings[SETTINGS.UPDATE_MODE],
    debounceDelay: settings[SETTINGS.DEBOUNCE_DELAY],
    useVscodeMarkdownStyles: settings[SETTINGS.USE_VSCODE_MARKDOWN_STYLES],
    useWhiteBackground: settings[SETTINGS.USE_WHITE_BACKGROUND],
    customLayoutFilePath: settings[SETTINGS.CUSTOM_LAYOUT_PATH],
    customCss: settings[SETTINGS.CUSTOM_CSS],
    plantUmlServer: settings[SETTINGS.PLANTUML_SERVER],
    useSucraseTranspiler: settings[SETTINGS.USE_SUCRASE],
    securityPolicy: settings[SETTINGS.SECURITY],
    tailwindEnabled: settings[SETTINGS.TAILWIND_ENABLED],
  };
}

// read preview configuration state from VS Code settings
export function readPreviewConfigurationState(
  configManager: ConfigManager,
  docUri: vscode.Uri
): ConfigurationState {
  return mapSettingsToPreviewConfiguration(configManager.getAll(docUri));
}
