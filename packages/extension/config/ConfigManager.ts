// packages/extension/config/ConfigManager.ts
// Centralized configuration management for MDX Preview extension

import * as vscode from 'vscode';
import { debug } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { SecurityPolicy } from '../security/security';
import { PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS } from '../constants';

// VS Code setting keys (relative to 'mdx-preview' namespace)
export type SettingKey =
  | 'preview.updateMode'
  | 'preview.debounceDelay'
  | 'preview.enableScripts'
  | 'preview.security'
  | 'preview.useVscodeMarkdownStyles'
  | 'preview.useWhiteBackground'
  | 'preview.customCss'
  | 'preview.mdx.customLayoutFilePath'
  | 'preview.previewTheme'
  | 'preview.codeBlockTheme'
  | 'preview.autoTheme'
  | 'build.useSucraseTranspiler'
  | 'tailwind.enabled'
  | 'framework'
  | 'framework.componentShims'
  | 'components.builtins'
  | 'components.unknownBehavior';

// Type mapping for settings
export interface SettingTypes {
  'preview.updateMode': 'onType' | 'onSave' | 'manual';
  'preview.debounceDelay': number;
  'preview.enableScripts': boolean;
  'preview.security': SecurityPolicy;
  'preview.useVscodeMarkdownStyles': boolean;
  'preview.useWhiteBackground': boolean;
  'preview.customCss': string;
  'preview.mdx.customLayoutFilePath': string;
  'preview.previewTheme': string;
  'preview.codeBlockTheme': string;
  'preview.autoTheme': boolean;
  'build.useSucraseTranspiler': boolean;
  'tailwind.enabled': 'auto' | 'enabled' | 'disabled';
  framework: 'auto' | 'generic' | 'docusaurus' | 'nextjs' | 'astro-starlight';
  'framework.componentShims': boolean;
  'components.builtins': boolean;
  'components.unknownBehavior': 'strip' | 'placeholder' | 'raw';
}

// Default values for all settings
const DEFAULTS: SettingTypes = {
  'preview.updateMode': 'onType',
  'preview.debounceDelay': PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS,
  'preview.enableScripts': false,
  'preview.security': SecurityPolicy.Strict,
  'preview.useVscodeMarkdownStyles': true,
  'preview.useWhiteBackground': false,
  'preview.customCss': '',
  'preview.mdx.customLayoutFilePath': '',
  'preview.previewTheme': 'none',
  'preview.codeBlockTheme': 'auto',
  'preview.autoTheme': true,
  'build.useSucraseTranspiler': false,
  'tailwind.enabled': 'enabled',
  framework: 'auto',
  'framework.componentShims': true,
  'components.builtins': true,
  'components.unknownBehavior': 'placeholder',
};

type ConfigChangeCallback = (affectedKeys: SettingKey[]) => void;

// * centralized configuration manager for MDX Preview
// benefits:
// - single source of truth for defaults
// - type-safe configuration access
// - centralized change notification
// - registered w/ ServiceRegistry for proper lifecycle
export class ConfigManager extends SingletonService<ConfigManager> {
  protected static override instance: ConfigManager | undefined;
  protected readonly logTag = 'CONFIG-MANAGER';

  private subscribers = new Set<ConfigChangeCallback>();

  protected constructor() {
    super();
    // subscribe to VS Code configuration changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview')) {
          this.notifySubscribers(e);
        }
      })
    );
  }

  // get a configuration value w/ type safety
  get<K extends SettingKey>(key: K, scope?: vscode.Uri): SettingTypes[K] {
    const config = vscode.workspace.getConfiguration('mdx-preview', scope);
    return config.get<SettingTypes[K]>(key, DEFAULTS[key]);
  }

  // get all configuration values as an object
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

  // update a configuration value
  async set<K extends SettingKey>(
    key: K,
    value: SettingTypes[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdx-preview');
    await config.update(key, value, target);
  }

  // subscribe to configuration changes
  onDidChangeConfiguration(callback: ConfigChangeCallback): vscode.Disposable {
    this.subscribers.add(callback);
    return {
      dispose: () => {
        this.subscribers.delete(callback);
      },
    };
  }

  // check if a specific setting affects the configuration change event
  static affectsConfiguration(
    event: vscode.ConfigurationChangeEvent,
    key: SettingKey
  ): boolean {
    return event.affectsConfiguration(`mdx-preview.${key}`);
  }

  // notify subscribers of configuration changes
  private notifySubscribers(event: vscode.ConfigurationChangeEvent): void {
    // determine which keys changed
    const affectedKeys = (Object.keys(DEFAULTS) as SettingKey[]).filter((key) =>
      event.affectsConfiguration(`mdx-preview.${key}`)
    );

    if (affectedKeys.length === 0) {
      return;
    }

    debug(`[CONFIG-MANAGER] Settings changed: ${affectedKeys.join(', ')}`);

    for (const callback of this.subscribers) {
      try {
        callback(affectedKeys);
      } catch (err) {
        debug(`[CONFIG-MANAGER] Error in subscriber: ${err}`);
      }
    }
  }

  // custom cleanup - subscribers are cleared, disposables handled by base class
  protected override onDispose(): void {
    this.subscribers.clear();
  }
}
