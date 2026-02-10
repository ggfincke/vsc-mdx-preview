// packages/webview-app/src/types.ts
// shared types for MDX Preview webview

// re-export shared types from @mdx-preview/shared
export type {
  ExtensionRPC,
  FetchResult,
  PreviewError,
  TrustState,
  WebviewRPC,
} from '@mdx-preview/contracts';

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

// complete preview state managed by App component
import type { PreviewError, TrustState } from '@mdx-preview/contracts';
export interface PreviewState {
  trustState: TrustState;
  content: PreviewContent | null;
  error: PreviewError | null;
  isLoading: boolean;
}
