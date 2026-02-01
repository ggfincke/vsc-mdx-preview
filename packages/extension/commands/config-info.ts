// packages/extension/commands/config-info.ts
// configuration inspection command for debugging & troubleshooting

import * as vscode from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import {
  getConfigManager,
  getTrustManager,
  getFrameworkDetector,
} from '../services';
import { resolveConfig } from '../preview/config/ConfigResolver';
import { buildEffectivePreviewConfig } from '../config/EffectivePreviewConfig';
import type { ResolvedConfig, EffectivePreviewConfig } from '../types';
import { extractFrontmatter } from '../compiler/shared/mdx-common';
import { CommandNames } from './command-names';
import type { CommandDefinition } from '../types';
import type { SettingKey } from '../config/ConfigManager';

// source type for each configuration value
type ConfigSourceType =
  | 'frontmatter'
  | 'config-file'
  | 'workspace-settings'
  | 'user-settings'
  | 'default';

// source info for a configuration value
interface ConfigSource {
  source: ConfigSourceType;
  file?: string;
}

// effective config w/ source info & metadata
interface EffectiveConfigWithSources {
  metadata: {
    documentPath: string;
    documentUri: string;
    framework: string;
    frameworkDetected: boolean;
    frameworkVersion?: string;
    configFilePath: string | null;
    trustState: {
      workspaceTrusted: boolean;
      scriptsEnabled: boolean;
      canExecute: boolean;
      reason?: string;
    };
  };
  effectiveConfig: EffectivePreviewConfig;
  sources: Record<string, ConfigSource>;
}

// determine source for a setting by inspecting VS Code config
function getSettingSource(
  key: SettingKey,
  docUri: vscode.Uri,
  frontmatter: Record<string, unknown> | undefined,
  configFile: ResolvedConfig | null
): ConfigSource {
  // frontmatter keys that can override settings
  const frontmatterKeys: Record<string, string> = {
    'preview.previewTheme': 'previewTheme',
    'preview.codeBlockTheme': 'codeBlockTheme',
  };

  // config file keys that can override settings
  const configFileKeys: Record<string, string> = {
    framework: 'framework',
    'tailwind.enabled': 'tailwind',
    'components.unknownBehavior': 'unknownBehavior',
  };

  // check frontmatter first (highest priority)
  const fmKey = frontmatterKeys[key];
  if (fmKey && frontmatter?.[fmKey] !== undefined) {
    return { source: 'frontmatter' };
  }

  // check config file
  const cfKey = configFileKeys[key];
  if (cfKey && configFile?.config) {
    const fileConfig = configFile.config as Record<string, unknown>;
    // handle nested keys like tailwind.enabled
    if (cfKey === 'tailwind' && fileConfig.tailwind) {
      const tw = fileConfig.tailwind as Record<string, unknown>;
      if (tw.enabled !== undefined) {
        return { source: 'config-file', file: configFile.configPath };
      }
    } else if (fileConfig[cfKey] !== undefined) {
      return { source: 'config-file', file: configFile.configPath };
    }
  }

  // check VS Code settings scope via ConfigManager
  const configManager = getConfigManager();
  const inspection = configManager.inspect(key, docUri);

  if (inspection?.workspaceFolderValue !== undefined) {
    return { source: 'workspace-settings' };
  }
  if (inspection?.workspaceValue !== undefined) {
    return { source: 'workspace-settings' };
  }
  if (inspection?.globalValue !== undefined) {
    return { source: 'user-settings' };
  }

  return { source: 'default' };
}

// build sources map for all relevant settings
function buildSourcesMap(
  docUri: vscode.Uri,
  frontmatter: Record<string, unknown> | undefined,
  configFile: ResolvedConfig | null
): Record<string, ConfigSource> {
  const sources: Record<string, ConfigSource> = {};

  // settings to track
  const settingsToTrack: SettingKey[] = [
    'preview.updateMode',
    'preview.debounceDelay',
    'preview.enableScripts',
    'preview.openMdxLinksInPreview',
    'preview.security',
    'preview.useVscodeMarkdownStyles',
    'preview.useWhiteBackground',
    'preview.customCss',
    'preview.previewTheme',
    'preview.codeBlockTheme',
    'preview.autoTheme',
    'build.useSucraseTranspiler',
    'tailwind.enabled',
    'framework',
    'framework.componentShims',
    'components.builtins',
    'components.unknownBehavior',
  ];

  for (const key of settingsToTrack) {
    sources[key] = getSettingSource(key, docUri, frontmatter, configFile);
  }

  // config file additions (plugins, components) always from config file
  if (configFile?.config?.remarkPlugins) {
    sources['remarkPlugins'] = {
      source: 'config-file',
      file: configFile.configPath,
    };
  }
  if (configFile?.config?.rehypePlugins) {
    sources['rehypePlugins'] = {
      source: 'config-file',
      file: configFile.configPath,
    };
  }
  if (configFile?.config?.components) {
    sources['components'] = {
      source: 'config-file',
      file: configFile.configPath,
    };
  }

  return sources;
}

// build effective config w/ source tracking
function buildEffectiveConfigWithSources(
  document: vscode.TextDocument
): EffectiveConfigWithSources {
  const docUri = document.uri;
  const docFsPath = docUri.fsPath;
  const text = document.getText();

  // extract frontmatter
  const { frontmatter } = extractFrontmatter(text);

  // resolve config file
  const configFile = resolveConfig(docFsPath);

  // build effective config
  const effectiveConfig = buildEffectivePreviewConfig({
    docUri,
    docFsPath,
    frontmatter,
  });

  // get framework info
  const frameworkInfo = getFrameworkDetector().getFramework(docUri);

  // get trust state
  const trustState = getTrustManager().getStateForDocument(docUri);

  // build sources map
  const sources = buildSourcesMap(docUri, frontmatter, configFile);

  return {
    metadata: {
      documentPath: docFsPath,
      documentUri: docUri.toString(),
      framework: frameworkInfo.framework,
      frameworkDetected: frameworkInfo.detected,
      frameworkVersion: frameworkInfo.version,
      configFilePath: configFile?.configPath ?? null,
      trustState: {
        workspaceTrusted: trustState.workspaceTrusted,
        scriptsEnabled: trustState.scriptsEnabled,
        canExecute: trustState.canExecute,
        reason: trustState.reason,
      },
    },
    effectiveConfig,
    sources,
  };
}

// format config as JSON for display
function formatConfigOutput(
  configWithSources: EffectiveConfigWithSources
): string {
  // create a serializable version (remove circular refs & functions)
  const output = {
    metadata: configWithSources.metadata,
    effectiveConfig: {
      updateMode: configWithSources.effectiveConfig.updateMode,
      debounceDelay: configWithSources.effectiveConfig.debounceDelay,
      enableScripts: configWithSources.effectiveConfig.enableScripts,
      openMdxLinksInPreview:
        configWithSources.effectiveConfig.openMdxLinksInPreview,
      securityPolicy: configWithSources.effectiveConfig.securityPolicy,
      useVscodeMarkdownStyles:
        configWithSources.effectiveConfig.useVscodeMarkdownStyles,
      useWhiteBackground: configWithSources.effectiveConfig.useWhiteBackground,
      customCss: configWithSources.effectiveConfig.customCss
        ? `[${configWithSources.effectiveConfig.customCss.length} chars]`
        : '',
      customLayoutFilePath:
        configWithSources.effectiveConfig.customLayoutFilePath,
      useSucraseTranspiler:
        configWithSources.effectiveConfig.useSucraseTranspiler,
      previewTheme: configWithSources.effectiveConfig.previewTheme,
      codeBlockTheme: configWithSources.effectiveConfig.codeBlockTheme,
      autoTheme: configWithSources.effectiveConfig.autoTheme,
      tailwind: configWithSources.effectiveConfig.tailwind,
      framework: configWithSources.effectiveConfig.framework,
      frameworkComponentShims:
        configWithSources.effectiveConfig.frameworkComponentShims,
      componentsBuiltins: configWithSources.effectiveConfig.componentsBuiltins,
      componentsUnknownBehavior:
        configWithSources.effectiveConfig.componentsUnknownBehavior,
      remarkPlugins: configWithSources.effectiveConfig.remarkPlugins
        ? `[${configWithSources.effectiveConfig.remarkPlugins.length} plugins]`
        : undefined,
      rehypePlugins: configWithSources.effectiveConfig.rehypePlugins
        ? `[${configWithSources.effectiveConfig.rehypePlugins.length} plugins]`
        : undefined,
      components: configWithSources.effectiveConfig.components
        ? Object.keys(configWithSources.effectiveConfig.components)
        : undefined,
    },
    sources: configWithSources.sources,
  };

  return JSON.stringify(output, null, 2);
}

// show effective configuration command handler
const showEffectiveConfig = async (): Promise<void> => {
  debug(`[${LogTags.CMD}] showEffectiveConfig command triggered`);

  // get active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(
      'MDX Preview: No active editor. Open an MDX file first.'
    );
    return;
  }

  const document = editor.document;

  // check if document is MDX or Markdown
  if (!['mdx', 'markdown'].includes(document.languageId)) {
    vscode.window.showWarningMessage(
      'MDX Preview: Active document is not an MDX or Markdown file.'
    );
    return;
  }

  try {
    // build config w/ sources
    const configWithSources = buildEffectiveConfigWithSources(document);
    const content = formatConfigOutput(configWithSources);

    // create virtual document & show
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'json',
    });

    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: true,
    });

    debug(`[${LogTags.CMD}] showEffectiveConfig complete`);
  } catch (error) {
    debug(`[${LogTags.CMD}] showEffectiveConfig error: ${error}`);
    vscode.window.showErrorMessage(
      `MDX Preview: Failed to show effective config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SHOW_EFFECTIVE_CONFIG, handler: showEffectiveConfig },
];
