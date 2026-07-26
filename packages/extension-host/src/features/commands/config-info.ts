// packages/extension-host/src/features/commands/config-info.ts
// configuration inspection command for debugging & troubleshooting

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags, FRONTMATTER_OVERRIDES } from '@mdx-preview/contracts';
import { ErrorContext } from '../../shared/errors/ErrorReporter';
import { notifyWarning } from '../../shared/errors';
import {
  getConfigManager,
  getTrustManager,
  getFrameworkDetector,
  getErrorReporter,
} from '../../app/services';
import { resolveConfig } from '../preview/configuration/ConfigResolver';
import { buildEffectivePreviewConfig } from '../preview/configuration/EffectivePreviewConfig';
import type {
  EffectivePreviewConfig,
  ResolvedConfig,
} from '../../shared/config/types';
import { extractFrontmatter } from 'mdx-forge/compiler';
import { CommandNames } from './command-names';
import type { CommandDefinition } from './types';
import { SETTINGS } from '../../shared/config/ConfigManager';
import type { SettingKey } from '../../shared/config/ConfigManager';

const log = createTaggedLogger(LogTags.CMD);

// define source type for each configuration value
type ConfigSourceType =
  | 'frontmatter'
  | 'config-file'
  | 'workspace-settings'
  | 'user-settings'
  | 'default';

// define source info for a configuration value
interface ConfigSource {
  source: ConfigSourceType;
  file?: string;
}

// define effective config w/ source info & metadata
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
  // derive frontmatter override keys from canonical metadata
  const frontmatterKeys: Record<string, string> = Object.fromEntries(
    FRONTMATTER_OVERRIDES.map((d) => [d.settingKey, d.key])
  );

  // define config file keys that can override settings
  const configFileKeys: Record<string, string> = {
    [SETTINGS.FRAMEWORK]: 'framework',
    [SETTINGS.TAILWIND_ENABLED]: 'tailwind',
    [SETTINGS.COMPONENTS_UNKNOWN_BEHAVIOR]: 'unknownBehavior',
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
    SETTINGS.UPDATE_MODE,
    SETTINGS.DEBOUNCE_DELAY,
    SETTINGS.ENABLE_SCRIPTS,
    SETTINGS.OPEN_MDX_LINKS_IN_PREVIEW,
    SETTINGS.SECURITY,
    SETTINGS.USE_VSCODE_MARKDOWN_STYLES,
    SETTINGS.USE_WHITE_BACKGROUND,
    SETTINGS.CUSTOM_CSS,
    SETTINGS.PREVIEW_THEME,
    SETTINGS.CODE_BLOCK_THEME,
    SETTINGS.AUTO_THEME,
    SETTINGS.PLANTUML_SERVER,
    SETTINGS.USE_SUCRASE,
    SETTINGS.TAILWIND_ENABLED,
    SETTINGS.FRAMEWORK,
    SETTINGS.FRAMEWORK_SHIMS,
    SETTINGS.COMPONENTS_BUILTINS,
    SETTINGS.COMPONENTS_UNKNOWN_BEHAVIOR,
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
      plantUmlServer: configWithSources.effectiveConfig.plantUmlServer,
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
  log.debug('showEffectiveConfig command triggered');

  // get active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    notifyWarning('No active editor. Open an MDX file first.');
    return;
  }

  const document = editor.document;

  // check if document is MDX or Markdown
  if (!['mdx', 'markdown'].includes(document.languageId)) {
    notifyWarning('Active document is not an MDX or Markdown file.');
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

    log.debug('showEffectiveConfig complete');
  } catch (error: unknown) {
    getErrorReporter().reportToUser(error, ErrorContext.Config);
  }
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.SHOW_EFFECTIVE_CONFIG, handler: showEffectiveConfig },
];
