// packages/contracts/src/config/types.ts
// shared configuration contracts for extension & webview runtimes

import type {
  PreviewScrollSyncValue,
  SourceLineHighlightColorValue,
} from './enums';

export interface PreviewRuntimeConfig {
  sourceLineHighlight: boolean;
  sourceLineHighlightColor: SourceLineHighlightColorValue;
  scrollSync: PreviewScrollSyncValue;
  shimSideRail: boolean;
}
