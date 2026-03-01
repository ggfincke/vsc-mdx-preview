// packages/extension-host/src/features/preview/PreviewConfiguration.ts
// configuration management for preview instances

import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import { getConfigManager } from '../../app/services';
import { SecurityPolicy } from '../security/SecurityPolicy';
import { readPreviewConfigurationState } from '../../shared/config/preview-settings';
import type {
  StyleConfiguration,
  ConfigurationState,
  PreviewRuntimeConfig,
  ConfigChangeResult,
} from '../types';

// re-export canonical type definitions from types/
export type {
  StyleConfiguration,
  ConfigurationState,
  PreviewRuntimeConfig,
  ConfigChangeResult,
} from '../types';

function projectRuntimeConfiguration(
  configuration: ConfigurationState
): PreviewRuntimeConfig {
  return {
    sourceLineHighlight: configuration.sourceLineHighlight,
    sourceLineHighlightColor: configuration.sourceLineHighlightColor,
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

  get securityConfiguration(): { securityPolicy: SecurityPolicy } {
    return { securityPolicy: this._configuration.securityPolicy };
  }

  get runtimeConfiguration(): PreviewRuntimeConfig {
    return projectRuntimeConfiguration(this._configuration);
  }

  get debouncedUpdateWebview(): ReturnType<typeof debounce> {
    return this._debouncedUpdateWebview;
  }

  // update configuration from VS Code settings (returns change info for caller)
  updateConfiguration(
    docUri: vscode.Uri,
    updateWebviewFn: () => void
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

    const needsDebounceRecreate =
      newConfig.debounceDelay !== this._configuration.debounceDelay;
    const needsCssWatcherUpdate =
      newConfig.customCss !== this._configuration.customCss;
    const oldCssPath = this._configuration.customCss;

    // recreate debounced function if delay changed
    if (needsDebounceRecreate) {
      this._debouncedUpdateWebview = debounce(
        updateWebviewFn,
        newConfig.debounceDelay
      );
    }

    this._configuration = newConfig;

    return {
      needsWebviewRefresh,
      needsRuntimeConfigPush,
      needsDebounceRecreate,
      needsCssWatcherUpdate,
      oldCssPath,
    };
  }
}
