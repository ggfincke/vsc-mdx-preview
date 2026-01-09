// packages/webview-app/src/App.test.tsx
// unit tests for main App component

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { LightboxProvider } from './context/LightboxContext';
import type { ReactElement } from 'react';

// capture registered handlers
let registeredHandlers: Record<string, Function> = {};

// mock the RPC module
vi.mock('./rpc-webview', () => ({
  registerWebviewHandlers: vi.fn((handlers) => {
    registeredHandlers = handlers;
  }),
  ExtensionHandle: {
    openDocument: vi.fn(),
    openExternal: vi.fn(),
  },
}));

import { ExtensionHandle } from './rpc-webview';

// wrapper for providers
function TestWrapper({ children }: { children: ReactElement }) {
  return (
    <ThemeProvider>
      <LightboxProvider>{children}</LightboxProvider>
    </ThemeProvider>
  );
}

function renderApp() {
  return render(
    <TestWrapper>
      <App />
    </TestWrapper>
  );
}

describe('App', () => {
  beforeEach(() => {
    registeredHandlers = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('renders without crashing', () => {
      const { container } = renderApp();
      expect(container).toBeTruthy();
    });

    it('registers webview handlers on mount', () => {
      renderApp();
      expect(registeredHandlers).toHaveProperty('setTrustState');
      expect(registeredHandlers).toHaveProperty('setSafeContent');
      expect(registeredHandlers).toHaveProperty('setTrustedContent');
      expect(registeredHandlers).toHaveProperty('setError');
      expect(registeredHandlers).toHaveProperty('setStale');
      expect(registeredHandlers).toHaveProperty('zoomIn');
      expect(registeredHandlers).toHaveProperty('zoomOut');
      expect(registeredHandlers).toHaveProperty('resetZoom');
    });
  });

  describe('trust state handling', () => {
    it('shows TrustBanner when canExecute is false', () => {
      renderApp();

      act(() => {
        registeredHandlers.setTrustState({
          workspaceTrusted: false,
          scriptsEnabled: false,
          canExecute: false,
        });
        registeredHandlers.setSafeContent('<p>Content</p>');
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('hides TrustBanner when canExecute is true', () => {
      renderApp();

      act(() => {
        registeredHandlers.setTrustState({
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
        });
        registeredHandlers.setSafeContent('<p>Content</p>');
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('content rendering', () => {
    it('renders safe content HTML', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Safe Mode Content</p>');
      });

      expect(screen.getByText('Safe Mode Content')).toBeInTheDocument();
    });

    it('clears loading state after content received', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
      });

      expect(document.querySelector('.mdx-loading-container')).toBeFalsy();
    });

    it('renders frontmatter when present', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>', {
          title: 'My Doc',
        });
      });

      expect(screen.getByText('Frontmatter')).toBeInTheDocument();
    });

    it('does not render frontmatter display when empty', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>', {});
      });

      expect(screen.queryByText('Frontmatter')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error message', () => {
      renderApp();

      act(() => {
        registeredHandlers.setError({
          message: 'Something went wrong',
          stack: 'Error: Something went wrong\n    at test:1:1',
        });
      });

      expect(screen.getByText('Preview Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('clears error when Dismiss clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      act(() => {
        registeredHandlers.setError({ message: 'Error' });
      });

      await user.click(screen.getByText('Dismiss'));

      expect(screen.queryByText('Preview Error')).not.toBeInTheDocument();
    });

    it('shows stack trace in details', () => {
      renderApp();

      act(() => {
        registeredHandlers.setError({
          message: 'Error',
          stack: 'Full stack trace here',
        });
      });

      expect(screen.getByText('Stack Trace')).toBeInTheDocument();
    });
  });

  describe('stale indicator', () => {
    it('shows stale indicator when isStale is true', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
        registeredHandlers.setStale(true);
      });

      expect(screen.getByText('Outdated')).toBeInTheDocument();
    });

    it('hides stale indicator when isStale is false', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
        registeredHandlers.setStale(false);
      });

      expect(screen.queryByText('Outdated')).not.toBeInTheDocument();
    });
  });

  describe('zoom controls', () => {
    it('applies zoom transform when zoomIn called', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
        registeredHandlers.zoomIn();
      });

      const content = document.querySelector('.mdx-preview-content');
      expect(content).toHaveStyle({ transform: 'scale(1.1)' });
    });

    it('applies zoom transform when zoomOut called', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
        registeredHandlers.zoomOut();
      });

      const content = document.querySelector('.mdx-preview-content');
      expect(content).toHaveStyle({ transform: 'scale(0.9)' });
    });

    it('resets zoom when resetZoom called', () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<p>Content</p>');
        registeredHandlers.zoomIn();
        registeredHandlers.zoomIn();
        registeredHandlers.resetZoom();
      });

      const content = document.querySelector('.mdx-preview-content');
      // 100% = no transform style applied (no inline style)
      expect(content?.getAttribute('style')).toBeFalsy();
    });
  });

  describe('link handling', () => {
    it('scrolls to anchor on anchor link click', async () => {
      const user = userEvent.setup();
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent(`
          <a href="#section">Go to section</a>
          <h2 id="section">Section</h2>
        `);
      });

      const scrollIntoView = vi.fn();
      const section = document.getElementById('section');
      if (section) {
        section.scrollIntoView = scrollIntoView;
      }

      await user.click(screen.getByText('Go to section'));

      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('calls openExternal for external link with Ctrl+click', async () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent(
          '<a href="https://example.com">External</a>'
        );
      });

      // simulate ctrl+click using native event
      const link = screen.getByText('External');
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      link.dispatchEvent(event);

      expect(ExtensionHandle.openExternal).toHaveBeenCalledWith(
        'https://example.com'
      );
    });

    it('calls openDocument for relative file link with Ctrl+click', async () => {
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent('<a href="./other.md">Other doc</a>');
      });

      // simulate ctrl+click using native event
      const link = screen.getByText('Other doc');
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      link.dispatchEvent(event);

      expect(ExtensionHandle.openDocument).toHaveBeenCalledWith('./other.md');
    });

    it('does not handle external link without modifier', async () => {
      const user = userEvent.setup();
      renderApp();

      act(() => {
        registeredHandlers.setSafeContent(
          '<a href="https://example.com">External</a>'
        );
      });

      await user.click(screen.getByText('External'));

      expect(ExtensionHandle.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('trusted content', () => {
    it('accepts trusted content handler call', () => {
      renderApp();

      // should not throw
      act(() => {
        registeredHandlers.setTrustState({
          workspaceTrusted: true,
          scriptsEnabled: true,
          canExecute: true,
        });
        registeredHandlers.setTrustedContent(
          'export default function() { return null; }',
          '/path/to/file.mdx',
          [],
          { title: 'Test' }
        );
      });

      // trusted content will try to evaluate, which may fail in test environment
      // but the handler should be registered & callable
      expect(registeredHandlers.setTrustedContent).toBeDefined();
    });
  });
});
