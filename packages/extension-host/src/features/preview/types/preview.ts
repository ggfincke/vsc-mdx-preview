// packages/extension/types/vscode/preview.ts
// type definitions for preview system

import type * as vscode from 'vscode';
import type {
  UpdateModeValue,
  TailwindEnabledValue,
} from '@mdx-preview/shared';
import type { SecurityPolicy } from '../../security/types/csp';

// webview app URIs (loaded from Vite manifest)
export interface WebviewAppUris {
  mainScript: vscode.Uri;
  mainStyle: vscode.Uri | undefined;
}

// style configuration for preview rendering
export interface StyleConfiguration {
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
}

// complete preview configuration state
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

// result of configuration change detection
export interface ConfigChangeResult {
  needsWebviewRefresh: boolean;
  needsDebounceRecreate: boolean;
  needsCssWatcherUpdate: boolean;
  oldCssPath: string;
}

// re-export canonical preview state types from runtime modules
export type { DocumentState } from '../PreviewDocumentHandler';
export type { HandshakeResult } from '../PreviewInitializer';
export type {
  TrustedEvaluationResult,
  SafeEvaluationResult,
  TailwindProcessParams,
} from '../EvaluationEngine';

// webview handle type re-exported for convenience
export type { WebviewHandleType as WebviewHandle } from '../../../platform/rpc/extension-endpoint';
