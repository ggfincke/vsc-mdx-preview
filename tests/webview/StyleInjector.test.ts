// tests/webview/StyleInjector.test.ts
// Unit tests for StyleInjector CSS injection

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock DOM elements
class MockHTMLStyleElement {
  id = '';
  parentNode: MockHTMLElement | null = null;
  typeWhenTextContentWasSet: string | null = null;
  private attributes: Record<string, string> = {};
  private text = '';

  set textContent(value: string) {
    this.typeWhenTextContentWasSet = this.getAttribute('type');
    this.text = value;
  }

  get textContent(): string {
    return this.text;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  remove(): void {
    if (this.parentNode) {
      const index = this.parentNode.children.indexOf(this);
      if (index > -1) {
        this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
    }
  }
}

class MockHTMLElement {
  children: MockHTMLStyleElement[] = [];

  appendChild(child: MockHTMLStyleElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(
    child: MockHTMLStyleElement,
    ref: MockHTMLStyleElement | null
  ): void {
    child.parentNode = this;
    if (ref) {
      const index = this.children.indexOf(ref);
      if (index > -1) {
        this.children.splice(index, 0, child);
        return;
      }
    }
    this.children.push(child);
  }
}

let mockHead: MockHTMLElement;
let mockDocument: {
  getElementById: ReturnType<typeof vi.fn>;
  querySelector: ReturnType<typeof vi.fn>;
  querySelectorAll: ReturnType<typeof vi.fn>;
  createElement: ReturnType<typeof vi.fn>;
  head: MockHTMLElement;
  documentElement: MockHTMLElement;
};

beforeEach(() => {
  mockHead = new MockHTMLElement();

  mockDocument = {
    getElementById: vi.fn((id: string) => {
      return mockHead.children.find((el) => el.id === id) ?? null;
    }),
    querySelector: vi.fn((selector: string) => {
      const match = selector.match(/style\[data-module-id="([^"]+)"\]/);
      if (match) {
        const moduleId = match[1];
        return (
          mockHead.children.find(
            (el) => el.getAttribute('data-module-id') === moduleId
          ) ?? null
        );
      }
      return null;
    }),
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === 'style[data-module-id]') {
        return mockHead.children.filter((el) =>
          el.getAttribute('data-module-id')
        );
      }
      return [];
    }),
    createElement: vi.fn(() => new MockHTMLStyleElement()),
    head: mockHead,
    documentElement: new MockHTMLElement(),
  };

  vi.stubGlobal('document', mockDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getStyleInjector() {
  vi.resetModules();
  const module =
    await import('../../packages/webview-client/src/shared/utils/StyleInjector');
  return module.StyleInjector;
}

describe('StyleInjector', () => {
  describe('inject', () => {
    it('applies custom attributes to style elements', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.inject('tailwind-browser-style', '@import "tailwindcss";', {
        attributes: {
          type: 'text/tailwindcss',
        },
      });

      expect(mockHead.children.length).toBe(1);
      expect(mockHead.children[0].id).toBe('tailwind-browser-style');
      expect(mockHead.children[0].getAttribute('type')).toBe(
        'text/tailwindcss'
      );
      expect(mockHead.children[0].typeWhenTextContentWasSet).toBe(
        'text/tailwindcss'
      );
    });
  });
});
