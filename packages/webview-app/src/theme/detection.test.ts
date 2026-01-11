// Tests for VS Code theme detection utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCurrentVSCodeTheme,
  onVSCodeThemeChange,
  isVSCodeDark,
} from './detection';

describe('getCurrentVSCodeTheme', () => {
  let originalClassList: DOMTokenList;

  beforeEach(() => {
    // Store original classList
    originalClassList = document.body.classList;
  });

  afterEach(() => {
    // Reset body classes
    document.body.className = '';
  });

  it('returns light for vscode-light class', () => {
    document.body.classList.add('vscode-light');

    expect(getCurrentVSCodeTheme()).toBe('light');
  });

  it('returns dark for vscode-dark class', () => {
    document.body.classList.add('vscode-dark');

    expect(getCurrentVSCodeTheme()).toBe('dark');
  });

  it('returns high-contrast for vscode-high-contrast class', () => {
    document.body.classList.add('vscode-high-contrast');

    expect(getCurrentVSCodeTheme()).toBe('high-contrast');
  });

  it('returns light when no VS Code class is present', () => {
    // Body has no vscode-* classes
    document.body.className = 'some-other-class';

    expect(getCurrentVSCodeTheme()).toBe('light');
  });

  it('prioritizes high-contrast over dark', () => {
    // Both classes present - high-contrast should win
    document.body.classList.add('vscode-dark');
    document.body.classList.add('vscode-high-contrast');

    expect(getCurrentVSCodeTheme()).toBe('high-contrast');
  });

  it('prioritizes dark over light', () => {
    // Both classes present - dark should win
    document.body.classList.add('vscode-light');
    document.body.classList.add('vscode-dark');

    expect(getCurrentVSCodeTheme()).toBe('dark');
  });
});

describe('onVSCodeThemeChange', () => {
  let disconnectSpy: ReturnType<typeof vi.fn>;
  let observeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.className = 'vscode-dark';

    // Spy on MutationObserver
    disconnectSpy = vi.fn();
    observeSpy = vi.fn();

    vi.stubGlobal(
      'MutationObserver',
      // store callback for testing
      vi.fn().mockImplementation((callback) => ({
        observe: observeSpy,
        disconnect: disconnectSpy,
        takeRecords: vi.fn(),
        _callback: callback,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.className = '';
  });

  it('returns a disconnect function', () => {
    const callback = vi.fn();
    const disconnect = onVSCodeThemeChange(callback);

    expect(typeof disconnect).toBe('function');

    // Call disconnect
    disconnect();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('observes body class attribute changes', () => {
    const callback = vi.fn();
    onVSCodeThemeChange(callback);

    expect(observeSpy).toHaveBeenCalledWith(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });

  it('calls callback when theme changes', () => {
    const callback = vi.fn();
    onVSCodeThemeChange(callback);

    // Get the MutationObserver callback
    const observerCallback = (
      MutationObserver as unknown as {
        mock: { calls: Array<Array<(mutations: unknown) => void>> };
      }
    ).mock.calls[0][0];

    // Simulate theme change
    document.body.className = 'vscode-light';
    observerCallback([]);

    expect(callback).toHaveBeenCalledWith('light');
  });

  it('does not call callback when theme stays the same', () => {
    const callback = vi.fn();
    document.body.className = 'vscode-dark';
    onVSCodeThemeChange(callback);

    // Get the MutationObserver callback
    const observerCallback = (
      MutationObserver as unknown as {
        mock: { calls: Array<Array<(mutations: unknown) => void>> };
      }
    ).mock.calls[0][0];

    // Simulate mutation without actual theme change
    observerCallback([]);

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('isVSCodeDark', () => {
  it('returns true for dark theme', () => {
    expect(isVSCodeDark('dark')).toBe(true);
  });

  it('returns true for high-contrast theme', () => {
    expect(isVSCodeDark('high-contrast')).toBe(true);
  });

  it('returns false for light theme', () => {
    expect(isVSCodeDark('light')).toBe(false);
  });
});
