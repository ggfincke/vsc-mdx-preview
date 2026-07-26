// packages/webview-client/src/features/code-block/hooks/useKatexDetection.ts
// lazy-load KaTeX CSS when math content is detected

import { useLayoutEffect, type RefObject } from 'react';
import { loadKatexCss } from '../utils/katexLoader';

interface UseKatexDetectionOptions {
  // html string for KaTeX class detection (Safe Mode)
  html?: string;

  // container ref for KaTeX element detection (Trusted Mode)
  containerRef?: RefObject<HTMLElement | null>;

  // trigger value for DOM query (Trusted Mode)
  trigger?: unknown;
}

// detect KaTeX/math content & lazy-load KaTeX CSS
// support Safe Mode html scanning & Trusted Mode DOM scanning
// use useLayoutEffect for synchronous loading to avoid FOUC
export function useKatexDetection(options: UseKatexDetectionOptions): void {
  const { html, containerRef, trigger } = options;

  // Safe Mode: string-based detection (faster, before DOM exists)
  useLayoutEffect(() => {
    if (
      html &&
      (html.includes('class="katex"') || html.includes('class="math'))
    ) {
      void loadKatexCss();
    }
  }, [html]);

  // Trusted Mode: DOM-based detection (after component renders)
  useLayoutEffect(() => {
    if (trigger && containerRef?.current) {
      const hasKatex = containerRef.current.querySelector('.katex, .math');
      if (hasKatex) {
        void loadKatexCss();
      }
    }
  }, [containerRef, trigger]);
}
