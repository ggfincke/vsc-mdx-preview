// packages/webview-app/src/context/TocContext.tsx
// React context for floating TOC sidebar - stores headings extracted from rendered DOM

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

// heading entry extracted from rendered DOM
export interface TocHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

interface TocContextValue {
  headings: TocHeading[] | null;
  showToc: boolean;
  activeHeadingId: string | null;
  setHeadings: (headings: TocHeading[] | null) => void;
  setShowToc: (show: boolean) => void;
  setActiveHeadingId: (headingId: string | null) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the TOC context value
function useTocProviderValue(): TocContextValue {
  const [headings, setHeadingsState] = useState<TocHeading[] | null>(null);
  const [showToc, setShowTocState] = useState(false);
  const [activeHeadingId, setActiveHeadingIdState] = useState<string | null>(
    null
  );

  const setHeadings = useCallback((next: TocHeading[] | null) => {
    log.debug('setHeadings called', next ? next.length : null);
    setHeadingsState(next);
    setActiveHeadingIdState((prev) => {
      if (!next || next.length === 0) {
        return null;
      }

      if (prev && next.some((heading) => heading.id === prev)) {
        return prev;
      }

      return next[0]?.id ?? null;
    });
  }, []);

  const setShowToc = useCallback((show: boolean) => {
    log.debug('setShowToc called', show);
    setShowTocState(show);
    if (!show) {
      setActiveHeadingIdState(null);
    }
  }, []);

  const setActiveHeadingId = useCallback((headingId: string | null) => {
    setActiveHeadingIdState((prev) => (prev === headingId ? prev : headingId));
  }, []);

  return useMemo(
    () => ({
      headings,
      showToc,
      activeHeadingId,
      setHeadings,
      setShowToc,
      setActiveHeadingId,
    }),
    [
      headings,
      showToc,
      activeHeadingId,
      setHeadings,
      setShowToc,
      setActiveHeadingId,
    ]
  );
}

const { Provider, useContextValue } = createContextProvider<TocContextValue>(
  'Toc',
  useTocProviderValue
);

export const TocProvider = Provider;
export const useToc = useContextValue;
