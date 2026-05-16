// packages/contracts/src/preview/index.ts
// barrel export for preview types & scroll sync constants

export {
  type FetchResult,
  type TrustState,
  type PreviewError,
  isPreviewError,
  formatTrustStateForDebug,
  type NextraPageMeta,
} from './types';

export {
  SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO,
  SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS,
} from './scroll-sync';
