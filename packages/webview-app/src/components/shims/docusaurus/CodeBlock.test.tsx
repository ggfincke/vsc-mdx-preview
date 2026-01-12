// Tests for Docusaurus CodeBlock component shim

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  describe('rendering', () => {
    it('renders code content', () => {
      render(<CodeBlock>const x = 1;</CodeBlock>);

      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('renders title bar when title provided', () => {
      render(<CodeBlock title="example.js">const x = 1;</CodeBlock>);

      expect(screen.getByText('example.js')).toBeInTheDocument();
      const titleElement = screen.getByText('example.js');
      expect(titleElement).toHaveClass('codeblock-title-text');
    });

    it('does not render title bar when no title', () => {
      const { container } = render(<CodeBlock>code</CodeBlock>);

      expect(
        container.querySelector('.codeblock-title')
      ).not.toBeInTheDocument();
    });

    it('renders language badge when language specified', () => {
      render(<CodeBlock language="javascript">code</CodeBlock>);

      expect(screen.getByText('javascript')).toBeInTheDocument();
      const badge = screen.getByText('javascript');
      expect(badge).toHaveClass('codeblock-language');
    });

    it('applies language class to pre and code', () => {
      const { container } = render(
        <CodeBlock language="typescript">const x: number = 1;</CodeBlock>
      );

      const pre = container.querySelector('pre');
      const code = container.querySelector('code');
      expect(pre).toHaveClass('language-typescript');
      expect(code).toHaveClass('language-typescript');
    });

    it('applies showLineNumbers data attribute', () => {
      const { container } = render(
        <CodeBlock showLineNumbers={true}>line 1</CodeBlock>
      );

      const pre = container.querySelector('pre');
      expect(pre).toHaveAttribute('data-show-line-numbers', 'true');
    });

    it('applies custom className', () => {
      const { container } = render(
        <CodeBlock className="custom-code">code</CodeBlock>
      );

      const pre = container.querySelector('pre');
      expect(pre).toHaveClass('custom-code');
    });
  });

  describe('copy functionality', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('shows copy button', () => {
      const { container } = render(<CodeBlock>code</CodeBlock>);

      const copyButton = container.querySelector('.codeblock-copy-button');
      expect(copyButton).toBeInTheDocument();
    });

    it('copies text to clipboard on click', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<CodeBlock>const x = 42;</CodeBlock>);

      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockWriteText).toHaveBeenCalledWith('const x = 42;');
    });

    it('shows copied state after successful copy', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<CodeBlock>code</CodeBlock>);

      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(copyButton).toHaveClass('copied');
      expect(copyButton).toHaveAttribute('aria-label', 'Copied!');
    });

    it('resets copied state after 2 seconds', async () => {
      vi.useFakeTimers();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<CodeBlock>code</CodeBlock>);

      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;

      await act(async () => {
        copyButton.click();
        await Promise.resolve();
      });

      expect(copyButton).toHaveClass('copied');

      await act(async () => {
        vi.advanceTimersByTime(2100);
      });

      expect(copyButton).not.toHaveClass('copied');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy code');
    });

    it('handles clipboard error gracefully', async () => {
      const mockWriteText = vi
        .fn()
        .mockRejectedValue(new Error('Clipboard error'));
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { container } = render(<CodeBlock>code</CodeBlock>);
      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;

      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalled();
      expect(copyButton).not.toHaveClass('copied');

      consoleSpy.mockRestore();
    });
  });

  describe('text extraction', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('extracts text from string children', () => {
      const { container } = render(<CodeBlock>simple text</CodeBlock>);

      const code = container.querySelector('code');
      expect(code?.textContent).toBe('simple text');
    });

    it('extracts text from nested React elements', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(
        <CodeBlock>
          <span>
            nested <strong>text</strong>
          </span>
        </CodeBlock>
      );

      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockWriteText).toHaveBeenCalledWith('nested text');
    });

    it('trims extracted text', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<CodeBlock>{`  padded text  `}</CodeBlock>);

      const copyButton = container.querySelector(
        '.codeblock-copy-button'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockWriteText).toHaveBeenCalledWith('padded text');
    });
  });
});
