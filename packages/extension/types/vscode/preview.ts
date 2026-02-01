// packages/extension/types/vscode/preview.ts
// type definitions for preview system

import type * as vscode from 'vscode';
import type { TrustState } from '@mdx-preview/shared';
import type { TypeScriptConfiguration } from '../core/module-system';
import type {
  ResolvedConfig,
  TailwindConfig,
  UpdateMode,
  TailwindEnabledSetting,
} from '../core/config';
import type { SecurityPolicy } from './csp';

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

// result of configuration change detection
export interface ConfigChangeResult {
  needsWebviewRefresh: boolean;
  needsDebounceRecreate: boolean;
  needsCssWatcherUpdate: boolean;
  oldCssPath: string;
}

// document state for preview
export interface DocumentState {
  doc: vscode.TextDocument;
  dependentFsPaths: Set<string>;
  typescriptConfiguration?: TypeScriptConfiguration;
  mdxPreviewConfig?: ResolvedConfig;
}

// result of webview handshake
export interface HandshakeResult {
  promise: Promise<void>;
  resolve: () => void;
}

// result of evaluating MDX in Trusted Mode
export interface TrustedEvaluationResult {
  // transpiled JavaScript code
  code: string;
  // resolved file path
  entryFilePath: string;
  // extracted dependencies
  dependencies: string[];
  // parsed frontmatter from MDX
  frontmatter: Record<string, unknown> | undefined;
}

// result of evaluating MDX in Safe Mode
export interface SafeEvaluationResult {
  // sanitized HTML content
  html: string;
  // parsed frontmatter from MDX
  frontmatter: Record<string, unknown> | undefined;
}

// parameters for Tailwind CSS processing
export interface TailwindProcessParams {
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
  tailwindConfig: TailwindConfig;
}

// webview handle type re-exported for convenience
export type { WebviewHandleType as WebviewHandle } from '../../rpc-extension';
