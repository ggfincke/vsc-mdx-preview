// packages/extension-host/src/features/preview/PreviewConfiguration.ts
// configuration management for preview instances

import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import type { SecurityPolicyValue } from '@mdx-preview/contracts';
import { getConfigManager } from '../../app/services';
import { readPreviewConfigurationState } from '../../shared/config/preview-settings';
import type {
  ConfigurationState,
  PreviewRuntimeConfig,
} from '../../shared/config/types';
import type { ConfigChangeResult, StyleConfiguration } from './types/preview';

export type { ConfigChangeResult, StyleConfiguration } from './types/preview';

function projectRuntimeConfiguration(
  configuration: ConfigurationState
): PreviewRuntimeConfig {
  return {
    sourceLineHighlight: configuration.sourceLineHighlight,
    sourceLineHighlightColor: configuration.sourceLineHighlightColor,
    scrollSync: configuration.scrollSync,
    shimSideRail: configuration.shimSideRail,
  };
}

function hasRuntimeConfigChanges(
  previous: PreviewRuntimeConfig,
  next: PreviewRuntimeConfig
): boolean {
  return (
    previous.sourceLineHighlight !== next.sourceLineHighlight ||
    previous.sourceLineHighlightColor !== next.sourceLineHighlightColor ||
    previous.scrollSync !== next.scrollSync ||
    previous.shimSideRail !== next.shimSideRail
  );
}

// manage preview configuration state & updates
// read from VS Code settings & track changes that require preview refresh
export class PreviewConfiguration {
  private _configuration: ConfigurationState;
  private _debouncedUpdateWebview: ReturnType<typeof debounce>;

  constructor(docUri: vscode.Uri, updateWebviewFn: () => void) {
    const configManager = getConfigManager();
    this._configuration = readPreviewConfigurationState(configManager, docUri);
    this._debouncedUpdateWebview = debounce(
      updateWebviewFn,
      this._configuration.debounceDelay
    );
  }

  get configuration(): ConfigurationState {
    return this._configuration;
  }

  get styleConfiguration(): StyleConfiguration {
    return {
      useVscodeMarkdownStyles: this._configuration.useVscodeMarkdownStyles,
      useWhiteBackground: this._configuration.useWhiteBackground,
    };
  }

  get securityConfiguration(): { securityPolicy: SecurityPolicyValue } {
    return { securityPolicy: this._configuration.securityPolicy };
  }

  get runtimeConfiguration(): PreviewRuntimeConfig {
    return projectRuntimeConfiguration(this._configuration);
  }

  get debouncedUpdateWebview(): ReturnType<typeof debounce> {
    return this._debouncedUpdateWebview;
  }

  // re-read resource-scoped settings when a preview changes documents
  setDocument(
    docUri: vscode.Uri,
    updateWebviewFn: () => void
  ): ConfigChangeResult {
    return this.applyConfiguration(docUri, updateWebviewFn, true);
  }

  // update configuration from VS Code settings (returns change info for caller)
  updateConfiguration(
    docUri: vscode.Uri,
    updateWebviewFn: () => void
  ): ConfigChangeResult {
    return this.applyConfiguration(docUri, updateWebviewFn, false);
  }

  dispose(): void {
    this._debouncedUpdateWebview.cancel();
  }

  private applyConfiguration(
    docUri: vscode.Uri,
    updateWebviewFn: () => void,
    recreateDebouncer: boolean
  ): ConfigChangeResult {
    const configManager = getConfigManager();
    const newConfig = readPreviewConfigurationState(configManager, docUri);
    const previousRuntimeConfig = this.runtimeConfiguration;
    const nextRuntimeConfig = projectRuntimeConfiguration(newConfig);

    const needsWebviewRefresh =
      newConfig.useVscodeMarkdownStyles !==
        this._configuration.useVscodeMarkdownStyles ||
      newConfig.useWhiteBackground !== this._configuration.useWhiteBackground ||
      newConfig.customLayoutFilePath !==
        this._configuration.customLayoutFilePath ||
      newConfig.plantUmlServer !== this._configuration.plantUmlServer ||
      newConfig.securityPolicy !== this._configuration.securityPolicy ||
      newConfig.tailwindEnabled !== this._configuration.tailwindEnabled;
    const needsRuntimeConfigPush = hasRuntimeConfigChanges(
      previousRuntimeConfig,
      nextRuntimeConfig
    );
    const scrollSyncChanged =
      previousRuntimeConfig.scrollSync !== nextRuntimeConfig.scrollSync;

    const needsDebounceRecreate =
      recreateDebouncer ||
      newConfig.debounceDelay !== this._configuration.debounceDelay;
    const needsCssWatcherUpdate =
      newConfig.customCss !== this._configuration.customCss;

    // replace pending work when the resource or delay changes
    if (needsDebounceRecreate) {
      this._debouncedUpdateWebview.cancel();
      this._debouncedUpdateWebview = debounce(
        updateWebviewFn,
        newConfig.debounceDelay
      );
    }

    this._configuration = newConfig;

    return {
      needsWebviewRefresh,
      needsRuntimeConfigPush,
      needsCssWatcherUpdate,
      scrollSyncChanged,
    };
  }
}
