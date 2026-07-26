// tests/webview/StyleInjector.test.ts
// verify CSS injection no-ops & diagram result reuse across DOM replacements
// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const { initializeMermaid, renderMermaid } = vi.hoisted(() => ({
  initializeMermaid: vi.fn(),
  renderMermaid: vi.fn(async (id: string) => ({
    svg: `<svg id="${id}"><marker id="${id}-arrow"></marker></svg>`,
  })),
}));

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

vi.mock('../../packages/webview-client/src/features/theme/runtime', () => ({
  useTheme: () => ({
    mermaidTheme: 'default',
    mermaidIconPacks: [],
  }),
}));

vi.mock(
  '../../packages/webview-client/src/features/diagrams/utils/mermaidLoader',
  () => ({
    loadMermaid: async () => ({
      default: {
        initialize: initializeMermaid,
        render: renderMermaid,
      },
    }),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/diagrams/utils/mermaidIconPacks',
  () => ({
    registerBuiltinIconPacks: vi.fn(),
    registerDynamicIconPacks: vi.fn(),
    setPendingDynamicPacks: vi.fn(),
    getPendingDynamicPacks: () => [],
    getMermaidIconPacksFingerprint: () => 'no-icons',
  })
);

import { createDiagramRenderer } from '../../packages/webview-client/src/features/diagrams/ui/DiagramRenderer/createDiagramRenderer';
import { MermaidRenderer } from '../../packages/webview-client/src/features/diagrams/ui/MermaidRenderer/MermaidRenderer';
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

    it('reuses existing styles & updates only changed CSS', async () => {
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

      const style = mockHead.children[0];
      StyleInjector.inject(
        'tailwind-browser-style',
        '@import "updated.css";',
        options
      );

      expect(mockHead.children).toHaveLength(1);
      expect(mockHead.children[0]).toBe(style);
      expect(style.textContent).toBe('@import "updated.css";');
      expect(style.textContentSetCount).toBe(2);
      expect(style.attributeSetCount).toBe(2);
    });
  });
});

const rendererState = {
  theme: 'light',
  cacheValue: 'icons-a:server-a',
};
const renderDiagram = vi.fn(
  async ({ code, id }: { code: string; id: string }) =>
    `<svg data-source="${code}" data-id="${id}"><script>unsafe()</script></svg>`
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
  includeIdInCacheKey: true,
  sanitize: sanitizeDiagram,
  render: renderDiagram,
});

const SharedTestDiagramRenderer = createDiagramRenderer({
  cacheFamily: 'shared-test',
  classPrefix: 'shared-test-diagram',
  errorLabel: 'Diagram error',
  loadingText: 'Rendering...',
  logTag: 'shared-test',
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
      async ({ code, id }: { code: string; id: string }) =>
        `<svg data-source="${code}" data-id="${id}"><script>unsafe()</script></svg>`
    );
    initializeMermaid.mockClear();
    renderMermaid.mockClear();
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

  it('isolates Mermaid ids while sharing id-independent adapters', async () => {
    const first = createMountedDiagram();
    const second = createMountedDiagram();

    await act(async () => {
      first.root.render(
        createElement(MermaidRenderer, {
          code: 'graph TD; A-->B',
          id: 'first',
        })
      );
      second.root.render(
        createElement(MermaidRenderer, {
          code: 'graph TD; A-->B',
          id: 'second',
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderMermaid).toHaveBeenCalledTimes(2);
    expect(first.host.innerHTML).toContain('mermaid-svg-first-arrow');
    expect(second.host.innerHTML).toContain('mermaid-svg-second-arrow');
    expect(first.host.innerHTML).not.toContain('mermaid-svg-second');

    act(() => first.root.unmount());
    mountedRoots.delete(first.root);
    const replacement = createMountedDiagram();
    await act(async () => {
      replacement.root.render(
        createElement(MermaidRenderer, {
          code: 'graph TD; A-->B',
          id: 'first',
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderMermaid).toHaveBeenCalledTimes(2);
    expect(replacement.host.innerHTML).toContain('mermaid-svg-first-arrow');

    resetDiagramResultCache();
    const sharedFirst = createMountedDiagram();
    const sharedSecond = createMountedDiagram();
    await act(async () => {
      sharedFirst.root.render(
        createElement(SharedTestDiagramRenderer, {
          code: 'same',
          id: 'first',
        })
      );
      sharedSecond.root.render(
        createElement(SharedTestDiagramRenderer, {
          code: 'same',
          id: 'second',
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(sanitizeDiagram).toHaveBeenCalledTimes(1);
    expect(sharedSecond.host.innerHTML).toBe(sharedFirst.host.innerHTML);
  });

  it('rerenders key changes & recovers from errors through the cache', async () => {
    renderDiagram.mockImplementation(async ({ code }) => {
      if (code === 'invalid') {
        throw new Error('invalid source');
      }
      return `<svg data-source="${code}"></svg>`;
    });
    const mounted = createMountedDiagram();

    await renderMountedDiagram(mounted, 'valid', 'diagram');
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
