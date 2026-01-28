// tests/webview/clipboard.test.ts
// Unit tests for clipboard utility functions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock HTMLElement for DOM operations
class MockHTMLElement {
  innerHTML = '';
  private _classList: Set<string> = new Set();

  classList = {
    add: (className: string) => {
      this._classList.add(className);
    },
    remove: (className: string) => {
      this._classList.delete(className);
    },
    contains: (className: string) => {
      return this._classList.has(className);
    },
  };
}

// Mock navigator.clipboard
let mockClipboard: {
  writeText: ReturnType<typeof vi.fn>;
};

// Store original globals
let originalNavigator: typeof globalThis.navigator;

beforeEach(() => {
  vi.useFakeTimers();

  // Setup mock clipboard
  mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };

  // Store original and mock navigator
  originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: mockClipboard },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  // Restore original navigator
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    writable: true,
    configurable: true,
  });
});

// Dynamic import to ensure it uses the mocked navigator
async function getClipboardUtils() {
  vi.resetModules();
  const module = await import('../../packages/webview-app/src/utils/clipboard');
  return module;
}

describe('clipboard utilities', () => {
  describe('copyToClipboard()', () => {
    it('should return true on successful copy', async () => {
      const { copyToClipboard } = await getClipboardUtils();

      const result = await copyToClipboard('test text');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('should return false on clipboard error', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Permission denied'));
      const { copyToClipboard } = await getClipboardUtils();

      const result = await copyToClipboard('test text');

      expect(result).toBe(false);
    });

    it('should handle empty string', async () => {
      const { copyToClipboard } = await getClipboardUtils();

      const result = await copyToClipboard('');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
    });
  });

  describe('copyWithFeedback()', () => {
    it('should add copied class on successful copy', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;

      const result = await copyWithFeedback('test', mockElement);

      expect(result).toBe(true);
      expect(mockElement.classList.contains('copied')).toBe(true);
    });

    it('should use custom copied class name', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;

      await copyWithFeedback('test', mockElement, {
        copiedClassName: 'custom-copied',
      });

      expect(mockElement.classList.contains('custom-copied')).toBe(true);
      expect(mockElement.classList.contains('copied')).toBe(false);
    });

    it('should swap content when copiedContent is provided', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;
      mockElement.innerHTML = '<svg>copy</svg>';

      await copyWithFeedback('test', mockElement, {
        copiedContent: '<svg>check</svg>',
      });

      expect(mockElement.innerHTML).toBe('<svg>check</svg>');

      // After duration, content should revert
      vi.advanceTimersByTime(2000);
      expect(mockElement.innerHTML).toBe('<svg>copy</svg>');
      expect(mockElement.classList.contains('copied')).toBe(false);
    });

    it('should use originalContent for restoration if provided', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;
      mockElement.innerHTML = '<svg>copy</svg>';

      await copyWithFeedback('test', mockElement, {
        copiedContent: '<svg>check</svg>',
        originalContent: '<svg>custom-original</svg>',
      });

      expect(mockElement.innerHTML).toBe('<svg>check</svg>');

      vi.advanceTimersByTime(2000);
      expect(mockElement.innerHTML).toBe('<svg>custom-original</svg>');
    });

    it('should use custom duration', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;
      mockElement.innerHTML = '<svg>copy</svg>';

      await copyWithFeedback('test', mockElement, {
        copiedContent: '<svg>check</svg>',
        duration: 500,
      });

      expect(mockElement.innerHTML).toBe('<svg>check</svg>');

      // Should not revert before duration
      vi.advanceTimersByTime(400);
      expect(mockElement.innerHTML).toBe('<svg>check</svg>');

      // Should revert after duration
      vi.advanceTimersByTime(200);
      expect(mockElement.classList.contains('copied')).toBe(false);
    });

    it('should return false and not apply feedback on clipboard error', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Permission denied'));
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;

      const result = await copyWithFeedback('test', mockElement);

      expect(result).toBe(false);
      expect(mockElement.classList.contains('copied')).toBe(false);
    });

    it('should remove copied class after duration when no content swap', async () => {
      const { copyWithFeedback } = await getClipboardUtils();
      const mockElement = new MockHTMLElement() as unknown as HTMLElement;

      await copyWithFeedback('test', mockElement);

      expect(mockElement.classList.contains('copied')).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(mockElement.classList.contains('copied')).toBe(false);
    });
  });
});
