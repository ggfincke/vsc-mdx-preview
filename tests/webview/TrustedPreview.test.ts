// tests/webview/TrustedPreview.test.ts
// verify trusted evaluation & diagram container lifecycle
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  createElement,
  StrictMode,
  useCallback,
  useState,
  type ComponentType,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { evaluateModuleToComponent } from '../../packages/webview-client/src/features/module-runtime';
import { TrustedPreviewRenderer } from '../../packages/webview-client/src/features/preview/trusted/TrustedPreview';
import type {
  PreviewError,
  TrustedPreviewContent,
} from '../../packages/webview-client/src/app/types';

vi.mock('../../packages/webview-client/src/features/module-runtime', () => ({
  evaluateModuleToComponent: vi.fn(),
}));

vi.mock(
  '../../packages/webview-client/src/features/lightbox/hooks/useImageLightbox',
  () => ({
    useImageLightbox: () => ({ handleImageClick: vi.fn() }),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewInteractions',
  () => ({ usePreviewInteractions: vi.fn() })
);

// keep actual discovery, observers & portals; replace expensive diagram engines
vi.mock(
  '../../packages/webview-client/src/features/diagrams/ui/LazyDiagramRenderers/LazyDiagramRenderers',
  () => {
    const render = ({ id, code }: { id: string; code: string }) =>
      createElement('svg', {
        'data-rendered-diagram': id,
        'data-code': code,
      });
    return {
      LazyMermaidRenderer: render,
      LazyPlantUMLRenderer: render,
      LazyGraphvizRenderer: render,
    };
  }
);

const content: TrustedPreviewContent = {
  mode: 'trusted',
  code: 'export default function Test() { return null; }',
  entryFilePath: '/workspace/doc.mdx',
  dependencies: [],
};

interface HarnessProps {
  content: TrustedPreviewContent;
  onError: (error: PreviewError) => void;
}

function PreviewHarness({ content, onError }: HarnessProps) {
  const [component, setComponent] = useState<ComponentType | null>(null);
  const onComponentReady = useCallback((next: ComponentType | null) => {
    setComponent(() => next);
  }, []);
  return createElement(TrustedPreviewRenderer, {
    content,
    evaluatedComponent: component,
    onComponentReady,
    onError,
  });
}

function DemoDocument() {
  return createElement('article', null, 'Rendered Demo');
}

function DiagramDocument() {
  return createElement('div', {
    className: 'mermaid-container',
    'data-mermaid-id': 'initial',
    'data-mermaid-chart': 'graph TD; A-->B',
  });
}

function deferredComponent() {
  let resolve!: (component: typeof DemoDocument) => void;
  const promise = new Promise<typeof DemoDocument>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const mountedRoots = new Set<Root>();
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;

async function renderHarness(root: Root, props: HarnessProps): Promise<void> {
  await act(async () => {
    root.render(
      createElement(StrictMode, null, createElement(PreviewHarness, props))
    );
  });
}

async function mountRenderer(onError = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mountedRoots.add(root);
  await renderHarness(root, { content, onError });
  return { host, root, onError };
}

async function flushScanFrame(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    const pending = Array.from(frames.values());
    frames.clear();
    for (const callback of pending) {
      callback(performance.now());
    }
    await Promise.resolve();
  });
}

function appendDiagram(container: Element, id: string): HTMLElement {
  const diagram = document.createElement('div');
  diagram.className = 'mermaid-container';
  diagram.dataset.mermaidId = id;
  diagram.dataset.mermaidChart = `graph TD; ${id}-->next`;
  container.appendChild(diagram);
  return diagram;
}

describe('TrustedPreviewRenderer', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.mocked(evaluateModuleToComponent).mockReset();
    frames.clear();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => root.unmount());
    }
    mountedRoots.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('renders the validated component returned by async evaluation', async () => {
    vi.mocked(evaluateModuleToComponent).mockResolvedValue(DemoDocument);
    const { host, onError } = await mountRenderer();

    expect(host.querySelector('[data-mode="trusted"]')).toBeTruthy();
    expect(host.textContent).toContain('Rendered Demo');
    expect(onError).not.toHaveBeenCalled();
  });

  it('shows evaluating state and reports async evaluation failures', async () => {
    const pending = deferredComponent();
    vi.mocked(evaluateModuleToComponent).mockReturnValue(pending.promise);
    const { host, root, onError } = await mountRenderer();
    expect(host.textContent).toContain('Evaluating');

    vi.mocked(evaluateModuleToComponent).mockRejectedValue(
      new Error('module evaluation failed')
    );
    await renderHarness(root, {
      content: { ...content, code: 'throw new Error("failed");' },
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'module evaluation failed',
        stack: expect.any(String),
      })
    );
    expect(host.querySelector('[data-mode="trusted"]')).toBeNull();
  });

  it('observes late diagrams and releases replaced or unmounted containers', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const pending = deferredComponent();
    vi.mocked(evaluateModuleToComponent).mockReturnValue(pending.promise);
    const { host, root, onError } = await mountRenderer();

    expect(host.querySelector('[data-mode="trusted"]')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
    await act(async () => pending.resolve(DiagramDocument));
    expect(
      host.querySelector('[data-rendered-diagram="initial"]')
    ).toBeTruthy();
    const firstContainer = host.querySelector('[data-mode="trusted"]')!;
    const firstObserver = observe.mock.contexts.at(-1);

    const late = appendDiagram(firstContainer, 'late');
    await flushScanFrame();
    expect(late.querySelector('[data-rendered-diagram="late"]')).toBeTruthy();
    await flushScanFrame();

    const replacement = deferredComponent();
    vi.mocked(evaluateModuleToComponent).mockReturnValue(replacement.promise);
    await act(async () => {
      appendDiagram(firstContainer, 'queued-before-replacement');
      await Promise.resolve();
    });
    expect(frames.size).toBeGreaterThan(0);
    await renderHarness(root, {
      content: { ...content, code: 'export default function Replacement() {}' },
      onError,
    });
    expect(disconnect.mock.contexts).toContain(firstObserver);
    expect(frames.size).toBe(0);
    expect(firstContainer.querySelector('svg')).toBeNull();

    await act(async () => replacement.resolve(DemoDocument));
    const secondContainer = host.querySelector('[data-mode="trusted"]')!;
    expect(secondContainer).not.toBe(firstContainer);
    const secondObserver = observe.mock.contexts.at(-1);
    expect(secondObserver).not.toBe(firstObserver);
    const replacementDiagram = appendDiagram(secondContainer, 'replacement');
    await flushScanFrame();
    expect(replacementDiagram.querySelector('svg')).toBeTruthy();
    await flushScanFrame();

    const detached = appendDiagram(firstContainer, 'detached');
    await flushScanFrame();
    expect(detached.querySelector('svg')).toBeNull();
    expect(frames.size).toBe(0);
    await act(async () => {
      appendDiagram(secondContainer, 'queued-before-unmount');
      await Promise.resolve();
    });
    expect(frames.size).toBeGreaterThan(0);
    act(() => root.unmount());
    mountedRoots.delete(root);
    expect(disconnect.mock.contexts).toContain(secondObserver);
    expect(frames.size).toBe(0);
    expect(secondContainer.querySelector('svg')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});
