// packages/webview-client/src/app/types.ts
// shared types for MDX Preview webview

// re-export shared types from @mdx-preview/contracts
export type { PreviewError, TrustState } from '@mdx-preview/contracts';

// preview content for Trusted Mode
export interface TrustedPreviewContent {
  mode: 'trusted';
  code: string;
  entryFilePath: string;
  dependencies: string[];
}

// preview content for Safe Mode
export interface SafePreviewContent {
  mode: 'safe';
  html: string;
}

// union type for preview content
export type PreviewContent = TrustedPreviewContent | SafePreviewContent;
