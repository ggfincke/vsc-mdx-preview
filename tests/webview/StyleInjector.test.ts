// tests/webview/StyleInjector.test.ts
// verify CSS injection no-ops & diagram result reuse across DOM replacements
// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock(
  '../../packages/webview-client/src/shared/utils/createTaggedLogger',
  () => ({
    createTaggedLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  })
);

import { createDiagramRenderer } from '../../packages/webview-client/src/features/diagrams/ui/DiagramRenderer/createDiagramRenderer';
import { resetDiagramResultCache } from '../../packages/webview-client/src/features/diagrams/utils/diagramResultCache';

// mock DOM elements
class MockHTMLStyleElement {
  id = '';
  parentNode: MockHTMLElement | null = null;
  typeWhenTextContentWasSet: string | null = null;
  textContentSetCount = 0;
  attributeSetCount = 0;
  private attributes: Record<string, string> = {};
  private text = '';

  set textContent(value: string) {
    this.textContentSetCount++;
    this.typeWhenTextContentWasSet = this.getAttribute('type');
    this.text = value;
  }

  get textContent(): string {
    return this.text;
  }

  setAttribute(name: string, value: string): void {
    this.attributeSetCount++;
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

async function getStyleInjector() {
  vi.resetModules();
  const module =
    await import('../../packages/webview-client/src/shared/utils/StyleInjector');
  return module.StyleInjector;
}

describe('StyleInjector', () => {
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

    it('does not mutate an existing identical style', async () => {
      const StyleInjector = await getStyleInjector();
      const options = {
        attributes: {
          type: 'text/tailwindcss',
        },
      };

      StyleInjector.inject(
        'tailwind-browser-style',
        '@import "tailwindcss";',
        options
      );
      StyleInjector.inject(
        'tailwind-browser-style',
        '@import "tailwindcss";',
        options
      );

      expect(mockHead.children).toHaveLength(1);
      expect(mockHead.children[0].textContentSetCount).toBe(1);
      expect(mockHead.children[0].attributeSetCount).toBe(1);
    });
  });
});

const rendererState = {
  theme: 'light',
  cacheValue: 'icons-a:server-a',
};
const renderDiagram = vi.fn(
  async ({ code }: { code: string; id: string }) =>
    `<svg data-source="${code}"><script>unsafe()</script></svg>`
);
const sanitizeDiagram = vi.fn((svg: string) =>
  svg.replace('<script>unsafe()</script>', '')
);

const TestDiagramRenderer = createDiagramRenderer({
  cacheFamily: 'test',
  classPrefix: 'test-diagram',
  errorLabel: 'Diagram error',
  loadingText: 'Rendering...',
  logTag: 'test',
  useThemeValue: () => rendererState.theme,
  useCacheKeyValue: () => rendererState.cacheValue,
  sanitize: sanitizeDiagram,
  render: renderDiagram,
});

interface MountedDiagram {
  host: HTMLDivElement;
  root: Root;
}

const mountedRoots = new Set<Root>();

function createMountedDiagram(): MountedDiagram {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mountedRoots.add(root);
  return { host, root };
}

async function renderMountedDiagram(
  mounted: MountedDiagram,
  code: string,
  id: string
): Promise<void> {
  await act(async () => {
    mounted.root.render(createElement(TestDiagramRenderer, { code, id }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('diagram result cache', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    rendererState.theme = 'light';
    rendererState.cacheValue = 'icons-a:server-a';
    renderDiagram.mockReset();
    renderDiagram.mockImplementation(
      async ({ code }: { code: string; id: string }) =>
        `<svg data-source="${code}"><script>unsafe()</script></svg>`
    );
    sanitizeDiagram.mockClear();
    resetDiagramResultCache();
  });

  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => root.unmount());
    }
    mountedRoots.clear();
    document.body.innerHTML = '';
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shares one sanitized render across replacement mounts', async () => {
    const first = createMountedDiagram();
    const second = createMountedDiagram();

    await act(async () => {
      first.root.render(
        createElement(TestDiagramRenderer, { code: 'same', id: 'first' })
      );
      second.root.render(
        createElement(TestDiagramRenderer, { code: 'same', id: 'second' })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(sanitizeDiagram).toHaveBeenCalledTimes(1);
    expect(first.host.innerHTML).not.toContain('unsafe');
    expect(second.host.innerHTML).toBe(first.host.innerHTML);
    const cachedMarkup = first.host.innerHTML;

    act(() => {
      first.root.unmount();
      second.root.unmount();
    });
    mountedRoots.delete(first.root);
    mountedRoots.delete(second.root);

    const replacement = createMountedDiagram();
    await renderMountedDiagram(replacement, 'same', 'replacement');

    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(sanitizeDiagram).toHaveBeenCalledTimes(1);
    expect(replacement.host.innerHTML).toBe(cachedMarkup);
  });

  it('rerenders key changes & recovers after a failed key', async () => {
    renderDiagram
      .mockRejectedValueOnce(new Error('invalid source'))
      .mockResolvedValueOnce('<svg data-source="valid"></svg>');
    const mounted = createMountedDiagram();

    await renderMountedDiagram(mounted, 'invalid', 'diagram');
    expect(mounted.host.textContent).toContain('Diagram error: invalid source');

    await renderMountedDiagram(mounted, 'valid', 'diagram');
    expect(mounted.host.textContent).not.toContain('invalid source');
    expect(mounted.host.innerHTML).toContain('data-source="valid"');

    rendererState.theme = 'dark';
    await renderMountedDiagram(mounted, 'valid', 'diagram');
    rendererState.cacheValue = 'icons-b:server-b';
    await renderMountedDiagram(mounted, 'valid', 'diagram');

    expect(renderDiagram).toHaveBeenCalledTimes(4);
    expect(sanitizeDiagram).toHaveBeenCalledTimes(3);
  });
});
