// packages/webview-app/src/test/ErrorBoundary.test.tsx
// tests for ErrorBoundary & error display components

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MDXErrorBoundary } from '../components/ErrorBoundary';

// mock RPC module
vi.mock('../rpc-webview', () => ({
  ExtensionHandle: {
    openDocument: vi.fn(),
  },
}));

import { ExtensionHandle } from '../rpc-webview';

// component that throws an error
function ThrowError({ error }: { error: Error }): never {
  throw error;
}

describe('MDXErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('error catching', () => {
    it('catches render errors and displays fallback', () => {
      const error = new Error('Test render error');

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Render Error')).toBeInTheDocument();
      expect(screen.getByText('Test render error')).toBeInTheDocument();
    });

    it('renders children when no error', () => {
      render(
        <MDXErrorBoundary>
          <div>Safe content</div>
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Safe content')).toBeInTheDocument();
    });

    it('calls onError callback when error caught', () => {
      const onError = vi.fn();
      const error = new Error('Callback test error');

      render(
        <MDXErrorBoundary onError={onError}>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('error display', () => {
    it('displays error message', () => {
      const error = new Error('Detailed error message');

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Detailed error message')).toBeInTheDocument();
    });

    it('displays stack trace in details element', () => {
      const error = new Error('Error with stack');
      error.stack = `Error: Error with stack
    at myFunction (/path/to/file.js:10:5)
    at anotherFunction (/path/to/other.js:20:10)`;

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(
        screen.getByText('Stack Trace (click to navigate)')
      ).toBeInTheDocument();
    });
  });

  describe('retry functionality', () => {
    it('shows Retry button', () => {
      const error = new Error('Retryable error');

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('shows Copy Error button', () => {
      const error = new Error('Copyable error');

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Copy Error')).toBeInTheDocument();
    });

    it('copies error to clipboard on click', async () => {
      const user = userEvent.setup();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText },
      });

      const error = new Error('Error to copy');
      error.stack = 'Error: Error to copy\n    at test:1:1';

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      await user.click(screen.getByText('Copy Error'));

      expect(mockWriteText).toHaveBeenCalled();
      const copiedText = mockWriteText.mock.calls[0][0];
      expect(copiedText).toContain('Error to copy');

      vi.unstubAllGlobals();
    });
  });

  describe('Open in Editor', () => {
    it('shows Open in Editor when stack has navigable frame', () => {
      const error = new Error('Navigable error');
      error.stack = `Error: Navigable error
    at myFunction (/path/to/file.js:10:5)`;

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.getByText('Open in Editor')).toBeInTheDocument();
    });

    it('calls openDocument when Open in Editor clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Navigable error');
      error.stack = `Error: Navigable error
    at myFunction (/path/to/file.js:10:5)`;

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      await user.click(screen.getByText('Open in Editor'));

      expect(ExtensionHandle.openDocument).toHaveBeenCalledWith(
        '/path/to/file.js',
        10,
        5
      );
    });

    it('hides Open in Editor when no navigable frame', () => {
      const error = new Error('No stack error');
      error.stack = undefined;

      render(
        <MDXErrorBoundary>
          <ThrowError error={error} />
        </MDXErrorBoundary>
      );

      expect(screen.queryByText('Open in Editor')).not.toBeInTheDocument();
    });
  });

  describe('global error handling', () => {
    it('catches window error events', () => {
      const onError = vi.fn();

      render(
        <MDXErrorBoundary onError={onError}>
          <div>Content</div>
        </MDXErrorBoundary>
      );

      const errorEvent = new ErrorEvent('error', {
        error: new Error('Global error'),
        message: 'Global error',
      });
      window.dispatchEvent(errorEvent);

      expect(onError).toHaveBeenCalled();
    });

    it('catches unhandled promise rejections', () => {
      const onError = vi.fn();

      render(
        <MDXErrorBoundary onError={onError}>
          <div>Content</div>
        </MDXErrorBoundary>
      );

      // create a rejection event manually since PromiseRejectionEvent may not be available in jsdom
      const promise = Promise.reject(new Error('Promise rejection'));
      // handle it so test doesn't fail
      promise.catch(() => {});

      const rejectionEvent = new Event(
        'unhandledrejection'
      ) as unknown as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, 'reason', {
        value: new Error('Promise rejection'),
      });
      Object.defineProperty(rejectionEvent, 'promise', {
        value: promise,
      });
      Object.defineProperty(rejectionEvent, 'preventDefault', {
        value: vi.fn(),
      });

      window.dispatchEvent(rejectionEvent);

      expect(onError).toHaveBeenCalled();
    });
  });
});
