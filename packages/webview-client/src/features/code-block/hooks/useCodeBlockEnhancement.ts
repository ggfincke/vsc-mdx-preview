// packages/webview-client/src/features/code-block/hooks/useCodeBlockEnhancement.ts
// enhance Shiki code blocks w/ copy buttons & language badges

import { useLayoutEffect, type RefObject } from 'react';
import {
  CODE_BLOCK_COPY_SELECTOR,
  copyEnhancedCodeBlock,
  enhanceCodeBlocks,
} from '../ui/CodeBlock';

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
      const container = containerRef.current;
      const feedbackControllers = new Map<HTMLButtonElement, AbortController>();

      const onClick = (event: MouseEvent): void => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const button = event.target.closest<HTMLButtonElement>(
          CODE_BLOCK_COPY_SELECTOR
        );
        if (!button || !container.contains(button)) {
          return;
        }

        feedbackControllers.get(button)?.abort();
        const controller = new AbortController();
        feedbackControllers.set(button, controller);
        void copyEnhancedCodeBlock(button, controller.signal);
      };

      enhanceCodeBlocks(container);
      container.addEventListener('click', onClick);

      return () => {
        container.removeEventListener('click', onClick);
        feedbackControllers.forEach((controller) => controller.abort());
        feedbackControllers.clear();
      };
    }
  }, [containerRef, trigger]);
}
