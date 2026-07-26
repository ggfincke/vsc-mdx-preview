// packages/contracts/src/preview/index.ts
// barrel export for preview types & scroll sync constants

export {
  type FetchResult,
  type ModuleDependency,
  type ModuleDependencyKind,
  type TrustState,
  type PreviewError,
  isPreviewError,
  formatTrustStateForDebug,
  type NextraPageMeta,
} from './types';

export {
  SOURCE_LINE_SCROLL_SYNC_ANCHOR_RATIO,
  SOURCE_LINE_SCROLL_SYNC_ANIMATION_MS,
  SOURCE_LINE_SCROLL_SYNC_SETTLE_MS,
} from './scroll-sync';
