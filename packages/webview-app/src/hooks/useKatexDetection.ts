// packages/webview-app/src/hooks/useKatexDetection.ts
// lazy-load KaTeX CSS when math content is detected

import { useLayoutEffect, type RefObject } from 'react';
import { loadKatexCss } from '../utils/katexLoader';

interface UseKatexDetectionOptions {
  // for Safe Mode: HTML string to check for KaTeX classes
  // detection is done via string search (faster, before DOM exists)
  html?: string;

  // for Trusted Mode: container ref to check for KaTeX elements
  // detection is done via DOM query (after component renders)
  containerRef?: RefObject<HTMLElement | null>;

  // trigger dependency for Trusted Mode (e.g., evaluatedComponent)
  // DOM query only runs when this value is truthy
  trigger?: unknown;
}

// detect KaTeX/math content & lazy-load KaTeX CSS
// supports two detection modes
// - Safe Mode: string-based detection via html prop (runs before DOM exists)
// - Trusted Mode: DOM-based detection via containerRef + trigger (runs after render)
// uses useLayoutEffect for synchronous loading to avoid FOUC
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
