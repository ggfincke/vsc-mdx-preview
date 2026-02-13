// packages/extension/config/ConfigManager.ts
// centralized configuration management for MDX Preview extension

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging/logger';
import { WithSubscribers } from '../../app/services/SingletonService';
import { SecurityPolicy } from '../../features/security/SecurityPolicy';
import {
  type FrameworkSetting,
  type TailwindEnabledValue,
  type UnknownBehaviorValue,
  type UpdateModeValue,
  LogTags,
} from '@mdx-preview/contracts';
import { SETTINGS_DEFAULTS } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.CONFIG_MANAGER);

// VS Code setting keys (relative to 'mdx-preview' namespace)
export type SettingKey =
  | 'preview.updateMode'
  | 'preview.debounceDelay'
  | 'preview.enableScripts'
  | 'preview.openMdxLinksInPreview'
  | 'preview.security'
  | 'preview.useVscodeMarkdownStyles'
  | 'preview.useWhiteBackground'
  | 'preview.customCss'
  | 'preview.mdx.customLayoutFilePath'
  | 'preview.previewTheme'
  | 'preview.codeBlockTheme'
  | 'preview.mermaidTheme'
  | 'preview.autoTheme'
  | 'diagrams.plantUmlServer'
  | 'build.useSucraseTranspiler'
  | 'tailwind.enabled'
  | 'tailwind.maxFileSizeBytes'
  | 'tailwind.maxCssFilesToSearch'
  | 'tailwind.cacheMaxEntries'
  | 'tailwind.cacheTtlSeconds'
  | 'tailwind.compilationTimeout'
  | 'framework'
  | 'framework.componentShims'
  | 'components.builtins'
  | 'components.unknownBehavior'
  | 'advanced.watcherDebounceMs'
  | 'advanced.debugOutput';

// type mapping for settings
// enum types imported from @mdx-preview/shared (canonical source)
export interface SettingTypes {
  'preview.updateMode': UpdateModeValue;
  'preview.debounceDelay': number;
  'preview.enableScripts': boolean;
  'preview.openMdxLinksInPreview': boolean;
  'preview.security': SecurityPolicy;
  'preview.useVscodeMarkdownStyles': boolean;
  'preview.useWhiteBackground': boolean;
  'preview.customCss': string;
  'preview.mdx.customLayoutFilePath': string;
  'preview.previewTheme': string;
  'preview.codeBlockTheme': string;
  'preview.mermaidTheme': string;
  'preview.autoTheme': boolean;
  'diagrams.plantUmlServer': string;
  'build.useSucraseTranspiler': boolean;
  'tailwind.enabled': TailwindEnabledValue;
  'tailwind.maxFileSizeBytes': number;
  'tailwind.maxCssFilesToSearch': number;
  'tailwind.cacheMaxEntries': number;
  'tailwind.cacheTtlSeconds': number;
  'tailwind.compilationTimeout': number;
  framework: FrameworkSetting;
  'framework.componentShims': boolean;
  'components.builtins': boolean;
  'components.unknownBehavior': UnknownBehaviorValue;
  'advanced.watcherDebounceMs': number;
  'advanced.debugOutput': boolean;
}

// map shared defaults to extension setting types
function mapDefaults(): SettingTypes {
  return {
    'preview.updateMode': SETTINGS_DEFAULTS['preview.updateMode'],
    'preview.debounceDelay': SETTINGS_DEFAULTS['preview.debounceDelay'],
    'preview.enableScripts': SETTINGS_DEFAULTS['preview.enableScripts'],
    'preview.openMdxLinksInPreview':
      SETTINGS_DEFAULTS['preview.openMdxLinksInPreview'],
    'preview.security':
      (SETTINGS_DEFAULTS['preview.security'] as string) === 'disabled'
        ? SecurityPolicy.Disabled
        : SecurityPolicy.Strict,
    'preview.useVscodeMarkdownStyles':
      SETTINGS_DEFAULTS['preview.useVscodeMarkdownStyles'],
    'preview.useWhiteBackground':
      SETTINGS_DEFAULTS['preview.useWhiteBackground'],
    'preview.customCss': SETTINGS_DEFAULTS['preview.customCss'],
    'preview.mdx.customLayoutFilePath':
      SETTINGS_DEFAULTS['preview.mdx.customLayoutFilePath'],
    'preview.previewTheme': SETTINGS_DEFAULTS['preview.previewTheme'],
    'preview.codeBlockTheme': SETTINGS_DEFAULTS['preview.codeBlockTheme'],
    'preview.mermaidTheme': SETTINGS_DEFAULTS['preview.mermaidTheme'],
    'preview.autoTheme': SETTINGS_DEFAULTS['preview.autoTheme'],
    'diagrams.plantUmlServer': SETTINGS_DEFAULTS['diagrams.plantUmlServer'],
    'build.useSucraseTranspiler':
      SETTINGS_DEFAULTS['build.useSucraseTranspiler'],
    'tailwind.enabled': SETTINGS_DEFAULTS['tailwind.enabled'],
    'tailwind.maxFileSizeBytes': SETTINGS_DEFAULTS['tailwind.maxFileSizeBytes'],
    'tailwind.maxCssFilesToSearch':
      SETTINGS_DEFAULTS['tailwind.maxCssFilesToSearch'],
    'tailwind.cacheMaxEntries': SETTINGS_DEFAULTS['tailwind.cacheMaxEntries'],
    'tailwind.cacheTtlSeconds': SETTINGS_DEFAULTS['tailwind.cacheTtlSeconds'],
    'tailwind.compilationTimeout':
      SETTINGS_DEFAULTS['tailwind.compilationTimeout'],
    framework: SETTINGS_DEFAULTS.framework,
    'framework.componentShims': SETTINGS_DEFAULTS['framework.componentShims'],
    'components.builtins': SETTINGS_DEFAULTS['components.builtins'],
    'components.unknownBehavior':
      SETTINGS_DEFAULTS['components.unknownBehavior'],
    'advanced.watcherDebounceMs':
      SETTINGS_DEFAULTS['advanced.watcherDebounceMs'],
    'advanced.debugOutput': SETTINGS_DEFAULTS['advanced.debugOutput'],
  };
}

// default values for all settings
const DEFAULTS: SettingTypes = mapDefaults();

// centralized key constants for high-churn settings
// reduce string repetition across the codebase
export const SETTINGS = {
  ENABLE_SCRIPTS: 'preview.enableScripts' as const,
  SECURITY: 'preview.security' as const,
  UPDATE_MODE: 'preview.updateMode' as const,
  DEBOUNCE_DELAY: 'preview.debounceDelay' as const,
  PREVIEW_THEME: 'preview.previewTheme' as const,
  CODE_BLOCK_THEME: 'preview.codeBlockTheme' as const,
  MERMAID_THEME: 'preview.mermaidTheme' as const,
  AUTO_THEME: 'preview.autoTheme' as const,
  USE_VSCODE_MARKDOWN_STYLES: 'preview.useVscodeMarkdownStyles' as const,
  USE_WHITE_BACKGROUND: 'preview.useWhiteBackground' as const,
  CUSTOM_CSS: 'preview.customCss' as const,
  CUSTOM_LAYOUT_PATH: 'preview.mdx.customLayoutFilePath' as const,
  USE_SUCRASE: 'build.useSucraseTranspiler' as const,
  TAILWIND_ENABLED: 'tailwind.enabled' as const,
  FRAMEWORK: 'framework' as const,
  FRAMEWORK_SHIMS: 'framework.componentShims' as const,
  COMPONENTS_BUILTINS: 'components.builtins' as const,
  COMPONENTS_UNKNOWN_BEHAVIOR: 'components.unknownBehavior' as const,
  PLANTUML_SERVER: 'diagrams.plantUmlServer' as const,
  OPEN_MDX_LINKS_IN_PREVIEW: 'preview.openMdxLinksInPreview' as const,
  DEBUG_OUTPUT: 'advanced.debugOutput' as const,
  WATCHER_DEBOUNCE_MS: 'advanced.watcherDebounceMs' as const,
  TAILWIND_MAX_FILE_SIZE: 'tailwind.maxFileSizeBytes' as const,
  TAILWIND_MAX_CSS_FILES: 'tailwind.maxCssFilesToSearch' as const,
  TAILWIND_CACHE_MAX_ENTRIES: 'tailwind.cacheMaxEntries' as const,
  TAILWIND_CACHE_TTL: 'tailwind.cacheTtlSeconds' as const,
  TAILWIND_COMPILATION_TIMEOUT: 'tailwind.compilationTimeout' as const,
} satisfies Record<string, SettingKey>;

// key groups for common subscription patterns
export const THEME_KEYS: readonly SettingKey[] = [
  SETTINGS.PREVIEW_THEME,
  SETTINGS.CODE_BLOCK_THEME,
  SETTINGS.MERMAID_THEME,
  SETTINGS.AUTO_THEME,
  SETTINGS.PLANTUML_SERVER,
] as const;

export const PREVIEW_CONFIG_KEYS: readonly SettingKey[] = [
  SETTINGS.UPDATE_MODE,
  SETTINGS.DEBOUNCE_DELAY,
  SETTINGS.USE_VSCODE_MARKDOWN_STYLES,
  SETTINGS.USE_WHITE_BACKGROUND,
  SETTINGS.CUSTOM_CSS,
  SETTINGS.CUSTOM_LAYOUT_PATH,
  SETTINGS.SECURITY,
  SETTINGS.PLANTUML_SERVER,
  SETTINGS.TAILWIND_ENABLED,
  SETTINGS.USE_SUCRASE,
] as const;

export const TAILWIND_KEYS: readonly SettingKey[] = [
  SETTINGS.TAILWIND_ENABLED,
  SETTINGS.TAILWIND_MAX_FILE_SIZE,
  SETTINGS.TAILWIND_MAX_CSS_FILES,
  SETTINGS.TAILWIND_CACHE_MAX_ENTRIES,
  SETTINGS.TAILWIND_CACHE_TTL,
  SETTINGS.TAILWIND_COMPILATION_TIMEOUT,
] as const;

export const ADVANCED_KEYS: readonly SettingKey[] = [
  SETTINGS.DEBUG_OUTPUT,
  SETTINGS.WATCHER_DEBOUNCE_MS,
] as const;

type ConfigChangeCallback = (affectedKeys: SettingKey[]) => void;

// * centralized configuration manager for MDX Preview w/ type safety & change notifications
export class ConfigManager extends WithSubscribers<
  ConfigManager,
  SettingKey[]
> {
  protected static override instance: ConfigManager | undefined;
  protected readonly logTag = LogTags.CONFIG_MANAGER;

  protected constructor() {
    super(LogTags.CONFIG_MANAGER);
    // handle VS Code configuration changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview')) {
          this.notifyConfigurationSubscribers(e);
        }
      })
    );
  }

  // retrieve config value w/ type safety
  get<K extends SettingKey>(key: K, scope?: vscode.Uri): SettingTypes[K] {
    const config = vscode.workspace.getConfiguration('mdx-preview', scope);
    return config.get<SettingTypes[K]>(key, DEFAULTS[key]);
  }

  // retrieve all config values as an object
  getAll(scope?: vscode.Uri): SettingTypes {
    const result = {} as SettingTypes;
    for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
      (result as unknown as Record<string, unknown>)[key] = this.get(
        key,
        scope
      );
    }
    return result;
  }

  // update config value
  async set<K extends SettingKey>(
    key: K,
    value: SettingTypes[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdx-preview');
    await config.update(key, value, target);
  }

  // inspect config value at different scopes (user, workspace, folder, default)
  inspect<K extends SettingKey>(
    key: K,
    scope?: vscode.Uri
  ):
    | {
        defaultValue?: SettingTypes[K];
        globalValue?: SettingTypes[K];
        workspaceValue?: SettingTypes[K];
        workspaceFolderValue?: SettingTypes[K];
      }
    | undefined {
    const config = vscode.workspace.getConfiguration('mdx-preview', scope);
    return config.inspect<SettingTypes[K]>(key);
  }

  // register callback for configuration changes
  onDidChangeConfiguration(callback: ConfigChangeCallback): vscode.Disposable {
    return this.subscribe(callback);
  }

  // subscribe to changes for specific keys (convenience wrapper)
  onDidChangeKey(
    keys: SettingKey | SettingKey[],
    callback: () => void
  ): vscode.Disposable {
    const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
    return this.onDidChangeConfiguration((affectedKeys) => {
      if (affectedKeys.some((k) => keySet.has(k))) {
        callback();
      }
    });
  }

  // determine if a specific setting affects the configuration change event
  static affectsConfiguration(
    event: vscode.ConfigurationChangeEvent,
    key: SettingKey
  ): boolean {
    return event.affectsConfiguration(`mdx-preview.${key}`);
  }

  // dispatch configuration change notifications to subscribers
  private notifyConfigurationSubscribers(
    event: vscode.ConfigurationChangeEvent
  ): void {
    // determine which keys changed
    const affectedKeys = (Object.keys(DEFAULTS) as SettingKey[]).filter((key) =>
      event.affectsConfiguration(`mdx-preview.${key}`)
    );

    if (affectedKeys.length === 0) {
      return;
    }

    log.debug(`Settings changed: ${affectedKeys.join(', ')}`);
    this.notifySubscribers(affectedKeys);
  }
}
