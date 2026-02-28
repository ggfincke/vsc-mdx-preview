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
// support two detection modes
// - Safe Mode: string-based detection via html prop (run before DOM exists)
// - Trusted Mode: DOM-based detection via containerRef + trigger (run after render)
// use useLayoutEffect for synchronous loading to avoid FOUC
export function useKatexDetection(options: UseKatexDetectionOptions): void {
  const { html, containerRef, trigger } = options;

  // Safe Mode: string-based detection (faster, before DOM exists)
  useLayoutEffect(() => {
    if (
      html &&
      (html.includes('class="katex"') || html.includes('class="math'))
    ) {
      loadKatexCss();
    }
  }, [html]);

  // Trusted Mode: DOM-based detection (after component renders)
  useLayoutEffect(() => {
    if (trigger && containerRef?.current) {
      const hasKatex = containerRef.current.querySelector('.katex, .math');
      if (hasKatex) {
        loadKatexCss();
      }
    }
  }, [containerRef, trigger]);
}
