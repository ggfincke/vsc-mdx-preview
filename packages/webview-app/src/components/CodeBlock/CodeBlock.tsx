// packages/webview-app/src/components/CodeBlock/CodeBlock.tsx
// * post-process code blocks to add copy button, language badge, & line highlighting

import { useCallback } from 'react';
import './CodeBlock.css';

// post-process all code blocks in a container to add enhancements
export function enhanceCodeBlocks(container: HTMLElement): void {
  // find all shiki containers
  const codeContainers = container.querySelectorAll('.shiki-container');

  codeContainers.forEach((shikiContainer) => {
    // skip if already enhanced
    if (shikiContainer.querySelector('.code-copy-button')) {
      return;
    }

    const code = shikiContainer.getAttribute('data-code') || '';
    const lang = shikiContainer.getAttribute('data-language') || '';
    const highlightLines = shikiContainer.getAttribute('data-highlight-lines');

    // add copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-button';
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.setAttribute('title', 'Copy code');
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
    </svg>`;

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>`;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
          </svg>`;
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch {
        // clipboard API failed
      }
    });

    shikiContainer.appendChild(copyBtn);

    // add language badge if language is specified
    if (lang && lang !== 'plaintext' && lang !== 'text') {
      const badge = document.createElement('span');
      badge.className = 'code-language-badge';
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
