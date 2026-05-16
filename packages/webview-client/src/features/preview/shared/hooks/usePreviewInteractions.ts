// packages/webview-client/src/features/preview/shared/hooks/usePreviewInteractions.ts
// wire common preview interactions for Safe & Trusted renderers

import { useLayoutEffect, type RefObject } from 'react';
import { useUIFlags } from '../../../../app/state';
import { useCodeBlockEnhancement } from '../../../code-block/hooks/useCodeBlockEnhancement';
import { useKatexDetection } from '../../../code-block/hooks/useKatexDetection';
import { openSourceLine } from '../utils/openSourceLine';
import { flushPendingScrollToSourceLine } from '../utils/scrollToSourceLine';
import { usePreviewScrollSync } from './usePreviewScrollSync';
import { useSourceLineHighlight } from './useSourceLineHighlight';

type PreviewInteractionMode = 'safe' | 'trusted';

interface UsePreviewInteractionsOptions {
  containerRef: RefObject<HTMLElement | null>;
  trigger: unknown;
  mode: PreviewInteractionMode;
}

export function usePreviewInteractions({
  containerRef,
  trigger,
  mode,
}: UsePreviewInteractionsOptions): void {
  const { sourceLineHighlightEnabled, scrollSyncMode } = useUIFlags();

  useLayoutEffect(() => {
    if (mode === 'trusted' && !trigger) {
      return;
    }

    flushPendingScrollToSourceLine();
  }, [mode, trigger]);

  useCodeBlockEnhancement({ containerRef, trigger });

  useSourceLineHighlight({
    containerRef,
    trigger,
    enabled: sourceLineHighlightEnabled,
    onOpenSourceLine: openSourceLine,
  });

  usePreviewScrollSync({
    containerRef,
    trigger,
    mode: scrollSyncMode,
  });

  useKatexDetection({
    html: mode === 'safe' && typeof trigger === 'string' ? trigger : undefined,
    containerRef: mode === 'trusted' ? containerRef : undefined,
    trigger: mode === 'trusted' ? trigger : undefined,
  });
}
