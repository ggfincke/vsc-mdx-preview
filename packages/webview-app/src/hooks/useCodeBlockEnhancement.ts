// packages/webview-app/src/hooks/useCodeBlockEnhancement.ts
// enhance Shiki code blocks w/ copy buttons & language badges

import { useLayoutEffect, type RefObject } from 'react';
import { enhanceCodeBlocks } from '../components/CodeBlock/CodeBlock';

interface UseCodeBlockEnhancementOptions {
  // reference to container element containing code blocks
  containerRef: RefObject<HTMLElement | null>;

  // trigger dependency for running enhancement
  // for Safe Mode: can be omitted (runs when containerRef.current is available)
  // for Trusted Mode: should be evaluatedComponent (runs after component mounts)
  trigger?: unknown;
}

// enhance Shiki code blocks w/ copy buttons & language badges
// uses useLayoutEffect to run synchronously after DOM mutations
// ensures code blocks are enhanced before browser paints
export function useCodeBlockEnhancement(
  options: UseCodeBlockEnhancementOptions
): void {
  const { containerRef, trigger } = options;

  useLayoutEffect(() => {
    // only enhance when container is available & trigger is truthy (or not provided)
    if (containerRef.current && (trigger !== undefined ? trigger : true)) {
      enhanceCodeBlocks(containerRef.current);
    }
  }, [containerRef, trigger]);
}
