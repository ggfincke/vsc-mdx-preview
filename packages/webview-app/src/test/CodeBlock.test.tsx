// packages/webview-app/src/test/CodeBlock.test.tsx
// tests for CodeBlock enhancement utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { enhanceCodeBlocks } from '../components/CodeBlock/CodeBlock';

describe('CodeBlock', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('enhanceCodeBlocks', () => {
    it('adds copy button to shiki-container', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="const x = 1;">
          <pre><code>const x = 1;</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const copyBtn = container.querySelector('.code-copy-button');
      expect(copyBtn).not.toBeNull();
    });

    it('sets aria-label on copy button', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="const x = 1;">
          <pre><code>const x = 1;</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const copyBtn = container.querySelector('.code-copy-button');
      expect(copyBtn?.getAttribute('aria-label')).toBe('Copy code');
    });

    it('adds language badge when data-language is present', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="const x = 1;" data-language="javascript">
          <pre><code>const x = 1;</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const badge = container.querySelector('.code-language-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('javascript');
    });

    it('does not add badge for plaintext language', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="some text" data-language="plaintext">
          <pre><code>some text</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      expect(container.querySelector('.code-language-badge')).toBeNull();
    });

    it('does not add badge for text language', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="some text" data-language="text">
          <pre><code>some text</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      expect(container.querySelector('.code-language-badge')).toBeNull();
    });

    it('skips already enhanced blocks', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="const x = 1;">
          <pre><code>const x = 1;</code></pre>
        </div>
      `;

      // enhance twice
      enhanceCodeBlocks(container);
      enhanceCodeBlocks(container);

      // should only have one copy button
      const copyBtns = container.querySelectorAll('.code-copy-button');
      expect(copyBtns.length).toBe(1);
    });

    it('enhances multiple code blocks', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="code1">
          <pre><code>code1</code></pre>
        </div>
        <div class="shiki-container" data-code="code2">
          <pre><code>code2</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const copyBtns = container.querySelectorAll('.code-copy-button');
      expect(copyBtns.length).toBe(2);
    });
  });

  describe('line highlighting', () => {
    it('applies highlighted class to specified lines', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="line1\nline2\nline3" data-highlight-lines="1,3">
          <pre>
            <code>
              <span class="line">line1</span>
              <span class="line">line2</span>
              <span class="line">line3</span>
            </code>
          </pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const lines = container.querySelectorAll('.line');
      expect(lines[0]).toHaveClass('highlighted');
      expect(lines[1]).not.toHaveClass('highlighted');
      expect(lines[2]).toHaveClass('highlighted');
    });

    it('handles single line highlight', () => {
      container.innerHTML = `
        <div class="shiki-container" data-code="line1\nline2" data-highlight-lines="2">
          <pre>
            <code>
              <span class="line">line1</span>
              <span class="line">line2</span>
            </code>
          </pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const lines = container.querySelectorAll('.line');
      expect(lines[0]).not.toHaveClass('highlighted');
      expect(lines[1]).toHaveClass('highlighted');
    });
  });

  describe('copy functionality', () => {
    it('copies code to clipboard on click', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      container.innerHTML = `
        <div class="shiki-container" data-code="const x = 1;">
          <pre><code>const x = 1;</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const copyBtn = container.querySelector(
        '.code-copy-button'
      ) as HTMLButtonElement;
      copyBtn.click();

      // wait for async click handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockWriteText).toHaveBeenCalledWith('const x = 1;');

      vi.unstubAllGlobals();
    });

    it('adds copied class after successful copy', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      container.innerHTML = `
        <div class="shiki-container" data-code="test">
          <pre><code>test</code></pre>
        </div>
      `;

      enhanceCodeBlocks(container);

      const copyBtn = container.querySelector(
        '.code-copy-button'
      ) as HTMLButtonElement;
      copyBtn.click();

      // wait for async clipboard operation to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(copyBtn).toHaveClass('copied');

      vi.unstubAllGlobals();
    });
  });
});
