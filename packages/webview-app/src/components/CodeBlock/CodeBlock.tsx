// packages/webview-app/src/components/CodeBlock/CodeBlock.tsx
// * post-process code blocks to add copy button, language badge, & line highlighting

import { useCallback } from 'react';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../constants';
import { GITHUB_ICONS } from '../shims/base/icons';
import './CodeBlock.css';

// post-process all code blocks in a container to add enhancements
export function enhanceCodeBlocks(container: HTMLElement): void {
  // find all shiki containers
  const codeContainers = container.querySelectorAll('.mdx-preview-codeblock-shiki');

  codeContainers.forEach((shikiContainer) => {
    // skip if already enhanced
    if (shikiContainer.querySelector('.mdx-preview-codeblock-copy')) {
      return;
    }

    const code = shikiContainer.getAttribute('data-code') || '';
    const lang = shikiContainer.getAttribute('data-language') || '';
    const highlightLines = shikiContainer.getAttribute('data-highlight-lines');

    // add copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'mdx-preview-codeblock-copy';
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.setAttribute('title', 'Copy code');
    copyBtn.innerHTML = GITHUB_ICONS.copy;

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.innerHTML = GITHUB_ICONS.check;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = GITHUB_ICONS.copy;
          copyBtn.classList.remove('copied');
        }, CODE_COPY_FEEDBACK_DURATION_MS);
      } catch {
        // clipboard API failed
      }
    });

    shikiContainer.appendChild(copyBtn);

    // add language badge if language is specified
    if (lang && lang !== 'plaintext' && lang !== 'text') {
      const badge = document.createElement('span');
      badge.className = 'mdx-preview-codeblock-lang';
      badge.textContent = lang;
      shikiContainer.appendChild(badge);
    }

    // apply line highlighting
    if (highlightLines) {
      const lineNumbers = highlightLines.split(',').map((n) => parseInt(n, 10));
      applyLineHighlighting(shikiContainer as HTMLElement, lineNumbers);
    }
  });
}

// apply highlighting to specific lines in code block
function applyLineHighlighting(container: HTMLElement, lines: number[]): void {
  const lineSet = new Set(lines);

  // find all .line elements within the shiki output
  const pres = container.querySelectorAll('pre');
  pres.forEach((pre) => {
    const lineElements = pre.querySelectorAll('.line');
    lineElements.forEach((lineEl, idx) => {
      // lines are 1-indexed in the meta
      if (lineSet.has(idx + 1)) {
        lineEl.classList.add('highlighted');
      }
    });
  });
}

// hook for use in React components
export function useCodeBlockEnhancement() {
  return useCallback((container: HTMLElement | null) => {
    if (container) {
      enhanceCodeBlocks(container);
    }
  }, []);
}

export default enhanceCodeBlocks;
