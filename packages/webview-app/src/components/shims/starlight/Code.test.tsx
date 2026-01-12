// Tests for Starlight Code component shim

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Code } from './Code';

describe('Code', () => {
  describe('rendering', () => {
    it('renders code prop as content', () => {
      render(<Code code="const x = 1;" />);

      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('applies language class when lang specified', () => {
      const { container } = render(
        <Code code="console.log('hi')" lang="javascript" />
      );

      const pre = container.querySelector('pre');
      const code = container.querySelector('code');
      expect(pre).toHaveClass('language-javascript');
      expect(code).toHaveClass('language-javascript');
    });

    it('renders title bar when title provided', () => {
      render(<Code code="code" title="example.ts" />);

      expect(screen.getByText('example.ts')).toBeInTheDocument();
      const titleElement = screen.getByText('example.ts');
      expect(titleElement).toHaveClass('starlight-code-title');
    });

    it('does not render title bar when no title', () => {
      const { container } = render(<Code code="code" />);

      expect(
        container.querySelector('.starlight-code-header')
      ).not.toBeInTheDocument();
    });

    it('applies starlight-code class', () => {
      const { container } = render(<Code code="code" />);

      expect(container.querySelector('.starlight-code')).toBeInTheDocument();
    });
  });

  describe('frame detection', () => {
    it('auto-detects terminal frame for bash', () => {
      const { container } = render(<Code code="npm install" lang="bash" />);

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('auto-detects terminal frame for sh', () => {
      const { container } = render(<Code code="echo hello" lang="sh" />);

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('auto-detects terminal frame for zsh', () => {
      const { container } = render(<Code code="source ~/.zshrc" lang="zsh" />);

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('auto-detects terminal frame for shell', () => {
      const { container } = render(<Code code="ls -la" lang="shell" />);

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('auto-detects terminal frame for powershell', () => {
      const { container } = render(
        <Code code="Get-Process" lang="powershell" />
      );

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('uses code frame for non-terminal languages', () => {
      const { container } = render(
        <Code code="const x = 1;" lang="typescript" />
      );

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-code');
      expect(codeDiv).not.toHaveClass('starlight-code-terminal');
    });

    it('respects explicit frame="terminal" override', () => {
      const { container } = render(
        <Code code="const x = 1;" lang="javascript" frame="terminal" />
      );

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-terminal');
    });

    it('respects explicit frame="code" override', () => {
      const { container } = render(
        <Code code="npm install" lang="bash" frame="code" />
      );

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).toHaveClass('starlight-code-code');
    });

    it('respects frame="none" (no frame class)', () => {
      const { container } = render(<Code code="code" frame="none" />);

      const codeDiv = container.querySelector('.starlight-code');
      expect(codeDiv).not.toHaveClass('starlight-code-terminal');
      expect(codeDiv).not.toHaveClass('starlight-code-code');
    });

    it('shows terminal dots in terminal frame with title', () => {
      const { container } = render(
        <Code code="npm install" lang="bash" title="Terminal" />
      );

      expect(container.querySelector('.terminal-dots')).toBeInTheDocument();
      expect(container.querySelector('.dot.red')).toBeInTheDocument();
      expect(container.querySelector('.dot.yellow')).toBeInTheDocument();
      expect(container.querySelector('.dot.green')).toBeInTheDocument();
    });

    it('does not show terminal dots without title', () => {
      const { container } = render(<Code code="npm install" lang="bash" />);

      expect(container.querySelector('.terminal-dots')).not.toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('shows copy button', () => {
      const { container } = render(<Code code="code" />);

      const copyButton = container.querySelector('.starlight-code-copy');
      expect(copyButton).toBeInTheDocument();
    });

    it('copies code to clipboard on click', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<Code code="const x = 42;" />);

      const copyButton = container.querySelector(
        '.starlight-code-copy'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockWriteText).toHaveBeenCalledWith('const x = 42;');
    });

    it('shows check icon after successful copy', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<Code code="code" />);

      const copyButton = container.querySelector(
        '.starlight-code-copy'
      ) as HTMLButtonElement;
      copyButton.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(copyButton).toHaveClass('copied');
      expect(copyButton).toHaveAttribute('aria-label', 'Copied!');
    });

    it('resets to copy icon after 2 seconds', async () => {
      vi.useFakeTimers();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const { container } = render(<Code code="code" />);

      const copyButton = container.querySelector(
        '.starlight-code-copy'
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
  });

  describe('language badge', () => {
    it('shows language badge for code frame without title', () => {
      render(<Code code="const x = 1;" lang="typescript" />);

      expect(screen.getByText('typescript')).toBeInTheDocument();
      const badge = screen.getByText('typescript');
      expect(badge).toHaveClass('starlight-code-lang');
    });

    it('hides language badge when title is present', () => {
      const { container } = render(
        <Code code="const x = 1;" lang="typescript" title="example.ts" />
      );

      expect(
        container.querySelector('.starlight-code-lang')
      ).not.toBeInTheDocument();
    });

    it('hides language badge for terminal frame', () => {
      const { container } = render(<Code code="npm install" lang="bash" />);

      expect(
        container.querySelector('.starlight-code-lang')
      ).not.toBeInTheDocument();
    });

    it('does not show badge when no lang specified', () => {
      const { container } = render(<Code code="plain text" />);

      expect(
        container.querySelector('.starlight-code-lang')
      ).not.toBeInTheDocument();
    });
  });
});
