// Tests for ThemeProvider and useTheme

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from './context';

// Mock the loader module
vi.mock('./loader', () => ({
  injectPreviewTheme: vi.fn(),
  injectCodeBlockTheme: vi.fn(),
}));

// Mock the detection module
vi.mock('./detection', () => ({
  getCurrentVSCodeTheme: vi.fn(() => 'dark'),
  onVSCodeThemeChange: vi.fn((callback) => {
    // store callback for testing
    (globalThis as Record<string, unknown>).__themeChangeCallback = callback;
    // cleanup function
    return vi.fn();
  }),
}));

// Test component that uses the theme context
function ThemeConsumer() {
  const theme = useTheme();
  return (
    <div>
      <span data-testid="vscode-theme">{theme.vsCodeTheme}</span>
      <span data-testid="is-dark">{String(theme.isDark)}</span>
      <span data-testid="preview-theme">{theme.previewTheme}</span>
      <span data-testid="code-block-theme">{theme.codeBlockTheme}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementation to default 'dark' return value
    const { getCurrentVSCodeTheme } = await import('./detection');
    vi.mocked(getCurrentVSCodeTheme).mockReturnValue('dark');
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__themeChangeCallback;
  });

  it('provides default theme state', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('preview-theme')).toHaveTextContent('none');
    expect(screen.getByTestId('code-block-theme')).toHaveTextContent('auto');
  });

  it('provides VS Code theme from detection', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('vscode-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
  });

  it('updates theme state via setPreviewThemeState', () => {
    // Component that exposes setPreviewThemeState
    function ThemeUpdater() {
      const { setPreviewThemeState, previewTheme, codeBlockTheme } = useTheme();
      return (
        <div>
          <button
            onClick={() =>
              setPreviewThemeState({
                previewTheme: 'github-light',
                codeBlockTheme: 'dracula',
                isLight: true,
              })
            }
          >
            Update Theme
          </button>
          <span data-testid="preview">{previewTheme}</span>
          <span data-testid="code">{codeBlockTheme}</span>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <ThemeUpdater />
      </ThemeProvider>
    );

    // Initial state
    expect(screen.getByTestId('preview')).toHaveTextContent('none');
    expect(screen.getByTestId('code')).toHaveTextContent('auto');

    // Update theme
    act(() => {
      screen.getByText('Update Theme').click();
    });

    // Updated state
    expect(screen.getByTestId('preview')).toHaveTextContent('github-light');
    expect(screen.getByTestId('code')).toHaveTextContent('dracula');
  });

  it('responds to VS Code theme changes', async () => {
    const { getCurrentVSCodeTheme } = await import('./detection');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Initial state
    expect(screen.getByTestId('vscode-theme')).toHaveTextContent('dark');

    // Simulate VS Code theme change
    vi.mocked(getCurrentVSCodeTheme).mockReturnValue('light');
    const callback = (globalThis as Record<string, unknown>).__themeChangeCallback as (theme: string) => void;

    act(() => {
      callback?.('light');
    });

    expect(screen.getByTestId('vscode-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
  });

  it('provides backward compatible theme alias', () => {
    function AliasConsumer() {
      const { theme, vsCodeTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme">{theme}</span>
          <span data-testid="vs-theme">{vsCodeTheme}</span>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <AliasConsumer />
      </ThemeProvider>
    );

    // theme should be an alias for vsCodeTheme
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('vs-theme')).toHaveTextContent('dark');
  });

  it('computes isHighContrast correctly', async () => {
    const { getCurrentVSCodeTheme } = await import('./detection');
    vi.mocked(getCurrentVSCodeTheme).mockReturnValue('high-contrast');

    function ContrastConsumer() {
      const { isHighContrast, isDark } = useTheme();
      return (
        <div>
          <span data-testid="high-contrast">{String(isHighContrast)}</span>
          <span data-testid="is-dark">{String(isDark)}</span>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <ContrastConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
  });
});

describe('useTheme', () => {
  it('returns current theme state', () => {
    function Consumer() {
      const theme = useTheme();
      return <span data-testid="has-context">{theme ? 'yes' : 'no'}</span>;
    }

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('has-context')).toHaveTextContent('yes');
  });

  it('throws when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function OrphanConsumer() {
      useTheme();
      return <div>Should not render</div>;
    }

    expect(() => {
      render(<OrphanConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});
