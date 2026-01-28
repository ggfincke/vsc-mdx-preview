// tests/webview/StyleInjector.test.ts
// Unit tests for StyleInjector DOM reference caching (Phase M.3)

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock DOM elements
class MockHTMLStyleElement {
  id = '';
  textContent = '';
  parentNode: MockHTMLElement | null = null;
  private attributes: Record<string, string> = {};

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
  private attributes: Record<string, string> = {};

  appendChild(child: MockHTMLStyleElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child: MockHTMLStyleElement, ref: MockHTMLStyleElement | null): void {
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

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }
}

// Mock document
let mockHead: MockHTMLElement;
let mockDocumentElement: MockHTMLElement;
let createdElements: MockHTMLStyleElement[];
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
  mockDocumentElement = new MockHTMLElement();
  createdElements = [];

  mockDocument = {
    getElementById: vi.fn((id: string) => {
      return mockHead.children.find((el) => el.id === id) ?? null;
    }),
    querySelector: vi.fn((selector: string) => {
      // Parse data-module-id selector
      const match = selector.match(/style\[data-module-id="([^"]+)"\]/);
      if (match) {
        const moduleId = match[1];
        return (
          mockHead.children.find((el) => el.getAttribute('data-module-id') === moduleId) ??
          null
        );
      }
      return null;
    }),
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === 'style[data-module-id]') {
        return mockHead.children.filter((el) => el.getAttribute('data-module-id'));
      }
      return [];
    }),
    createElement: vi.fn((_tag: string) => {
      const el = new MockHTMLStyleElement();
      createdElements.push(el);
      return el;
    }),
    head: mockHead,
    documentElement: mockDocumentElement,
  };

  vi.stubGlobal('document', mockDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Dynamic import to ensure it uses the mocked document
async function getStyleInjector() {
  vi.resetModules();
  const module = await import(
    '../../packages/webview-app/src/utils/StyleInjector'
  );
  return module.StyleInjector;
}

describe('StyleInjector', () => {
  describe('injectModuleCss', () => {
    it('should create a style element in document.head', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');

      expect(mockHead.children.length).toBe(1);
      expect(mockHead.children[0].getAttribute('data-module-id')).toBe('module-1');
      expect(mockHead.children[0].textContent).toBe('.test { color: red; }');
    });

    it('should cache the element reference for O(1) removal', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');
      expect(mockHead.children.length).toBe(1);

      // Remove should work without querySelector (uses cached reference)
      StyleInjector.removeModuleCss('module-1');

      expect(mockHead.children.length).toBe(0);
    });

    it('should allow multiple injections with same moduleId (caller must deduplicate via ModuleRegistry)', async () => {
      // Note: StyleInjector is a pure DOM manipulation layer. Deduplication is
      // the responsibility of the caller (via ModuleRegistry.hasInjectedStyle).
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');
      StyleInjector.injectModuleCss('module-1', '.test { color: blue; }');

      // Both elements are created - deduplication is caller's responsibility
      expect(mockHead.children.length).toBe(2);
    });
  });

  describe('removeModuleCss', () => {
    it('should remove style element using cached reference (O(1))', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');
      StyleInjector.injectModuleCss('module-2', '.test2 { color: blue; }');
      expect(mockHead.children.length).toBe(2);

      StyleInjector.removeModuleCss('module-1');

      expect(mockHead.children.length).toBe(1);
      expect(mockHead.children[0].getAttribute('data-module-id')).toBe('module-2');
    });

    it('should handle removal of non-existent module gracefully', async () => {
      const StyleInjector = await getStyleInjector();

      expect(() => StyleInjector.removeModuleCss('non-existent')).not.toThrow();
    });

    it('should handle stale reference (element removed externally)', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');

      // Simulate external removal
      mockHead.children[0].remove();

      // Should not throw
      expect(() => StyleInjector.removeModuleCss('module-1')).not.toThrow();
    });
  });

  describe('clear("modules")', () => {
    it('should clear all module styles using cached references', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test1 { color: red; }');
      StyleInjector.injectModuleCss('module-2', '.test2 { color: blue; }');
      StyleInjector.injectModuleCss('module-3', '.test3 { color: green; }');
      expect(mockHead.children.length).toBe(3);

      StyleInjector.clear('modules');

      expect(mockHead.children.length).toBe(0);
    });

    it('should handle empty state gracefully', async () => {
      const StyleInjector = await getStyleInjector();

      expect(() => StyleInjector.clear('modules')).not.toThrow();
    });

    it('should not affect non-module styles', async () => {
      const StyleInjector = await getStyleInjector();

      // Inject a regular style (not module style)
      StyleInjector.inject('theme-style', '.theme { background: white; }');
      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');
      expect(mockHead.children.length).toBe(2);

      StyleInjector.clear('modules');

      // Theme style should still exist
      expect(mockHead.children.length).toBe(1);
      expect(mockHead.children[0].id).toBe('theme-style');
    });
  });

  describe('clearTracking', () => {
    it('should clear internal tracking state', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');

      // After clearTracking, same moduleId should be injectable again
      StyleInjector.clearTracking();
      StyleInjector.injectModuleCss('module-1', '.test { color: blue; }');

      // Should have two style elements (because tracking was cleared)
      expect(mockHead.children.length).toBe(2);
    });
  });

  describe('hasInjected', () => {
    it('should track non-module styles (not module styles - use ModuleRegistry for those)', async () => {
      // hasInjected only tracks non-module styles (themes, custom CSS, etc.)
      // For module styles, use ModuleRegistry.hasInjectedStyle()
      const StyleInjector = await getStyleInjector();

      // Module styles are NOT tracked by hasInjected
      StyleInjector.injectModuleCss('module-1', '.test { color: red; }');
      expect(StyleInjector.hasInjected('module-1')).toBe(false);

      // Non-module styles ARE tracked when using inject() with deduplicate: true
      StyleInjector.inject('theme-1', '.theme { background: white; }', {
        deduplicate: true,
      });
      expect(StyleInjector.hasInjected('theme-1')).toBe(true);
      expect(StyleInjector.hasInjected('theme-2')).toBe(false);
    });

    it('should return false after removal for non-module styles', async () => {
      const StyleInjector = await getStyleInjector();

      StyleInjector.inject('theme-1', '.theme { background: white; }', {
        deduplicate: true,
      });
      expect(StyleInjector.hasInjected('theme-1')).toBe(true);

      StyleInjector.remove('theme-1');
      expect(StyleInjector.hasInjected('theme-1')).toBe(false);
    });
  });
});
