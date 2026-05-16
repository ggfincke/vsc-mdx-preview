// packages/webview-client/src/features/preview/shared/hooks/usePreviewInteractions.ts
// wire common preview interactions for Safe & Trusted renderers
// discriminated mode lets KaTeX detection dispatch on the actual shape (html vs DOM)

import { useLayoutEffect, type RefObject } from 'react';
import { useUIFlags } from '../../../../app/state';
import { useCodeBlockEnhancement } from '../../../code-block/hooks/useCodeBlockEnhancement';
import { useKatexDetection } from '../../../code-block/hooks/useKatexDetection';
import { openSourceLine } from '../utils/openSourceLine';
import { flushPendingScrollToSourceLine } from '../utils/scrollToSourceLine';
import { usePreviewScrollSync } from './usePreviewScrollSync';
import { useSourceLineHighlight } from './useSourceLineHighlight';

interface SharedInteractionFields {
  containerRef: RefObject<HTMLElement | null>;
}

export type UsePreviewInteractionsOptions =
  | (SharedInteractionFields & { mode: 'safe'; html: string })
  | (SharedInteractionFields & { mode: 'trusted'; component: unknown });

export function usePreviewInteractions(
  options: UsePreviewInteractionsOptions
): void {
  const { containerRef } = options;
  const trigger: unknown =
    options.mode === 'safe' ? options.html : options.component;
  const { sourceLineHighlightEnabled, scrollSyncMode } = useUIFlags();

  // trusted mode defers the flush until the component is evaluated
  useLayoutEffect(() => {
    if (options.mode === 'trusted' && !trigger) {
      return;
    }
    flushPendingScrollToSourceLine();
  }, [options.mode, trigger]);

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

  useKatexDetection(
    options.mode === 'safe'
      ? { html: options.html }
      : { containerRef, trigger: options.component }
  );
}
