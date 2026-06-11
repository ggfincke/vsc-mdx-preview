// packages/webview-client/src/features/code-block/hooks/useCodeBlockEnhancement.ts
// enhance Shiki code blocks w/ copy buttons & language badges

import { useLayoutEffect, type RefObject } from 'react';
import { enhanceCodeBlocks } from '../ui/CodeBlock';

interface UseCodeBlockEnhancementOptions {
  // container element ref
  containerRef: RefObject<HTMLElement | null>;

  // trigger value for enhancement (Trusted Mode: evaluatedComponent)
  trigger?: unknown;
}

// enhance Shiki code blocks w/ copy buttons & language badges
// use useLayoutEffect to run synchronously after DOM mutations
// ensure code blocks are enhanced before browser paints
export function useCodeBlockEnhancement(
  options: UseCodeBlockEnhancementOptions
): void {
  const { containerRef, trigger } = options;

  useLayoutEffect(() => {
    // only enhance when container is available & trigger is truthy (or not provided)
    if (containerRef.current && (trigger === undefined || trigger)) {
      enhanceCodeBlocks(containerRef.current);
    }
  }, [containerRef, trigger]);
}
