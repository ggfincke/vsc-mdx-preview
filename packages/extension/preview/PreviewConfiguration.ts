// packages/extension/preview/PreviewConfiguration.ts
// configuration management for preview instances

import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import type {
  UpdateModeValue,
  TailwindEnabledValue,
} from '@mdx-preview/shared';
import { SecurityPolicy } from '../security/security';
import { getConfigManager } from '../services';

export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

export interface ConfigurationState {
  updateMode: UpdateModeValue;
  debounceDelay: number;
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
  customLayoutFilePath: string;
  customCss: string;
  plantUmlServer: string;
  useSucraseTranspiler: boolean;
  securityPolicy: SecurityPolicy;
  tailwindEnabled: TailwindEnabledValue;
}

export interface ConfigChangeResult {
  needsWebviewRefresh: boolean;
  needsDebounceRecreate: boolean;
  needsCssWatcherUpdate: boolean;
  oldCssPath: string;
}

// manage preview configuration state & updates
// reads from VS Code settings & tracks changes that require preview refresh
export class PreviewConfiguration {
  private _configuration: ConfigurationState;
  private _debouncedUpdateWebview: ReturnType<typeof debounce>;

  constructor(docUri: vscode.Uri, updateWebviewFn: () => void) {
    const configManager = getConfigManager();

    const debounceDelay = configManager.get('preview.debounceDelay', docUri);

    this._configuration = {
      updateMode: configManager.get('preview.updateMode', docUri),
      debounceDelay,
      useSucraseTranspiler: configManager.get(
        'build.useSucraseTranspiler',
        docUri
      ),
      useVscodeMarkdownStyles: configManager.get(
        'preview.useVscodeMarkdownStyles',
        docUri
      ),
      useWhiteBackground: configManager.get(
        'preview.useWhiteBackground',
        docUri
      ),
      customLayoutFilePath: configManager.get(
        'preview.mdx.customLayoutFilePath',
        docUri
      ),
      customCss: configManager.get('preview.customCss', docUri),
      plantUmlServer: configManager.get('diagrams.plantUmlServer', docUri),
      securityPolicy: configManager.get('preview.security', docUri),
      tailwindEnabled: configManager.get('tailwind.enabled', docUri),
    };

    this._debouncedUpdateWebview = debounce(updateWebviewFn, debounceDelay);
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

  get debouncedUpdateWebview(): ReturnType<typeof debounce> {
    return this._debouncedUpdateWebview;
  }

  // update configuration from VS Code settings (returns change info for caller)
  updateConfiguration(
    docUri: vscode.Uri,
    updateWebviewFn: () => void
  ): ConfigChangeResult {
    const configManager = getConfigManager();

    const updateMode = configManager.get('preview.updateMode', docUri);
    const debounceDelay = configManager.get('preview.debounceDelay', docUri);
    const useSucraseTranspiler = configManager.get(
      'build.useSucraseTranspiler',
      docUri
    );
    const useVscodeMarkdownStyles = configManager.get(
      'preview.useVscodeMarkdownStyles',
      docUri
    );
    const useWhiteBackground = configManager.get(
      'preview.useWhiteBackground',
      docUri
    );
    const customLayoutFilePath = configManager.get(
      'preview.mdx.customLayoutFilePath',
      docUri
    );
    const customCss = configManager.get('preview.customCss', docUri);
    const plantUmlServer = configManager.get('diagrams.plantUmlServer', docUri);
    const securityPolicy = configManager.get('preview.security', docUri);
    const tailwindEnabled = configManager.get('tailwind.enabled', docUri);

    const needsWebviewRefresh =
      useVscodeMarkdownStyles !== this._configuration.useVscodeMarkdownStyles ||
      useWhiteBackground !== this._configuration.useWhiteBackground ||
      customLayoutFilePath !== this._configuration.customLayoutFilePath ||
      plantUmlServer !== this._configuration.plantUmlServer ||
      securityPolicy !== this._configuration.securityPolicy ||
      tailwindEnabled !== this._configuration.tailwindEnabled;

    const needsDebounceRecreate =
      debounceDelay !== this._configuration.debounceDelay;
    const needsCssWatcherUpdate = customCss !== this._configuration.customCss;
    const oldCssPath = this._configuration.customCss;

    // recreate debounced function if delay changed
    if (needsDebounceRecreate) {
      this._debouncedUpdateWebview = debounce(updateWebviewFn, debounceDelay);
    }

    Object.assign(this._configuration, {
      updateMode,
      debounceDelay,
      useSucraseTranspiler,
      useVscodeMarkdownStyles,
      useWhiteBackground,
      customLayoutFilePath,
      customCss,
      plantUmlServer,
      securityPolicy,
      tailwindEnabled,
    });

    return {
      needsWebviewRefresh,
      needsDebounceRecreate,
      needsCssWatcherUpdate,
      oldCssPath,
    };
  }
}
