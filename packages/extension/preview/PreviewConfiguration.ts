// packages/extension/preview/PreviewConfiguration.ts
// configuration management for preview instances

import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import { SecurityPolicy } from '../security/security';
import { PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS } from '../constants';

export type UpdateMode = 'onType' | 'onSave' | 'manual';
export type TailwindEnabledSetting = 'auto' | 'enabled' | 'disabled';

export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

export interface ConfigurationState {
  updateMode: UpdateMode;
  debounceDelay: number;
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
  customLayoutFilePath: string;
  customCss: string;
  useSucraseTranspiler: boolean;
  securityPolicy: SecurityPolicy;
  tailwindEnabled: TailwindEnabledSetting;
}

export interface ConfigChangeResult {
  needsWebviewRefresh: boolean;
  needsDebounceRecreate: boolean;
  needsCssWatcherUpdate: boolean;
  oldCssPath: string;
}

// manages preview configuration state & updates.
// reads from VS Code settings & tracks changes that require preview refresh.
export class PreviewConfiguration {
  private _configuration: ConfigurationState;
  private _debouncedUpdateWebview: ReturnType<typeof debounce>;

  constructor(docUri: vscode.Uri, updateWebviewFn: () => void) {
    const extensionConfig = vscode.workspace.getConfiguration(
      'mdx-preview',
      docUri
    );

    const debounceDelay = extensionConfig.get<number>(
      'preview.debounceDelay',
      PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS
    );

    this._configuration = {
      updateMode: extensionConfig.get<UpdateMode>(
        'preview.updateMode',
        'onType'
      ),
      debounceDelay,
      useSucraseTranspiler: extensionConfig.get<boolean>(
        'build.useSucraseTranspiler',
        false
      ),
      useVscodeMarkdownStyles: extensionConfig.get<boolean>(
        'preview.useVscodeMarkdownStyles',
        true
      ),
      useWhiteBackground: extensionConfig.get<boolean>(
        'preview.useWhiteBackground',
        false
      ),
      customLayoutFilePath: extensionConfig.get<string>(
        'preview.mdx.customLayoutFilePath',
        ''
      ),
      customCss: extensionConfig.get<string>('preview.customCss', ''),
      securityPolicy: extensionConfig.get<SecurityPolicy>(
        'preview.security',
        SecurityPolicy.Strict
      ),
      tailwindEnabled: extensionConfig.get<TailwindEnabledSetting>(
        'tailwind.enabled',
        'enabled'
      ),
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

  // Update configuration from VS Code settings.
  // Returns information about what changed to allow caller to react appropriately.
  updateConfiguration(
    docUri: vscode.Uri,
    updateWebviewFn: () => void
  ): ConfigChangeResult {
    const extensionConfig = vscode.workspace.getConfiguration(
      'mdx-preview',
      docUri
    );

    const updateMode = extensionConfig.get<UpdateMode>(
      'preview.updateMode',
      'onType'
    );
    const debounceDelay = extensionConfig.get<number>(
      'preview.debounceDelay',
      PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS
    );
    const useSucraseTranspiler = extensionConfig.get<boolean>(
      'build.useSucraseTranspiler',
      false
    );
    const useVscodeMarkdownStyles = extensionConfig.get<boolean>(
      'preview.useVscodeMarkdownStyles',
      true
    );
    const useWhiteBackground = extensionConfig.get<boolean>(
      'preview.useWhiteBackground',
      false
    );
    const customLayoutFilePath = extensionConfig.get<string>(
      'preview.mdx.customLayoutFilePath',
      ''
    );
    const customCss = extensionConfig.get<string>('preview.customCss', '');
    const securityPolicy = extensionConfig.get<SecurityPolicy>(
      'preview.security',
      SecurityPolicy.Strict
    );
    const tailwindEnabled = extensionConfig.get<TailwindEnabledSetting>(
      'tailwind.enabled',
      'enabled'
    );

    const needsWebviewRefresh =
      useVscodeMarkdownStyles !== this._configuration.useVscodeMarkdownStyles ||
      useWhiteBackground !== this._configuration.useWhiteBackground ||
      customLayoutFilePath !== this._configuration.customLayoutFilePath ||
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
