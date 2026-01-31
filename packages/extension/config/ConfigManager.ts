// packages/extension/config/ConfigManager.ts
// centralized configuration management for MDX Preview extension

import * as vscode from 'vscode';
import { debug } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SubscriberManager } from '../utils/SubscriberManager';
import { SecurityPolicy } from '../security/security';
import {
  type FrameworkSetting,
  type TailwindEnabledValue,
  type UnknownBehaviorValue,
  type UpdateModeValue,
  LogTags,
} from '@mdx-preview/shared';
import { SETTINGS_DEFAULTS } from '@mdx-preview/shared';

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
  | 'advanced.watcherDebounceMs';

// type mapping for settings
// Note: enum types imported from @mdx-preview/shared (canonical source)
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
  };
}

// default values for all settings
const DEFAULTS: SettingTypes = mapDefaults();

type ConfigChangeCallback = (affectedKeys: SettingKey[]) => void;

// * centralized configuration manager for MDX Preview w/ type safety & change notifications
export class ConfigManager extends SingletonService<ConfigManager> {
  protected static override instance: ConfigManager | undefined;
  protected readonly logTag = LogTags.CONFIG_MANAGER;

  private subscriberManager = new SubscriberManager<SettingKey[]>(
    LogTags.CONFIG_MANAGER
  );

  protected constructor() {
    super();
    // handle VS Code configuration changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview')) {
          this.notifySubscribers(e);
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

  // register callback for configuration changes
  onDidChangeConfiguration(callback: ConfigChangeCallback): vscode.Disposable {
    return this.subscriberManager.subscribe(callback);
  }

  // determine if a specific setting affects the configuration change event
  static affectsConfiguration(
    event: vscode.ConfigurationChangeEvent,
    key: SettingKey
  ): boolean {
    return event.affectsConfiguration(`mdx-preview.${key}`);
  }

  // dispatch configuration change notifications to subscribers
  private notifySubscribers(event: vscode.ConfigurationChangeEvent): void {
    // determine which keys changed
    const affectedKeys = (Object.keys(DEFAULTS) as SettingKey[]).filter((key) =>
      event.affectsConfiguration(`mdx-preview.${key}`)
    );

    if (affectedKeys.length === 0) {
      return;
    }

    debug(
      `[${LogTags.CONFIG_MANAGER}] Settings changed: ${affectedKeys.join(', ')}`
    );
    this.subscriberManager.notify(affectedKeys);
  }

  // clear subscribers on dispose
  protected override onDispose(): void {
    this.subscriberManager.clear();
  }
}
