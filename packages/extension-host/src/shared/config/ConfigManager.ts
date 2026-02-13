// packages/extension/config/ConfigManager.ts
// centralized configuration management for MDX Preview extension

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging/logger';
import { WithSubscribers } from '../../app/services/SingletonService';
import { LogTags } from '@mdx-preview/contracts';
import { DEFAULTS, type SettingKey, type SettingTypes } from './setting-keys';

// re-export setting keys & types so existing consumers don't break
export {
  SETTINGS,
  THEME_KEYS,
  PREVIEW_CONFIG_KEYS,
  TAILWIND_KEYS,
  ADVANCED_KEYS,
  type SettingKey,
  type SettingTypes,
} from './setting-keys';

const log = createTaggedLogger(LogTags.CONFIG_MANAGER);

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
