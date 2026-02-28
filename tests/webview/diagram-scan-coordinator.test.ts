// tests/webview/diagram-scan-coordinator.test.ts
// tests for single-observer diagram scan coordination behavior
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useDiagramScanCoordinator } from '../../packages/webview-client/src/features/diagrams/hooks/useDiagramScanCoordinator';
import type { DiagramScanAdapter } from '../../packages/webview-client/src/features/diagrams/hooks/diagramAdapters';
import type { BaseDiagramInfo } from '../../packages/webview-client/src/features/diagrams/utils/createDiagramContainerFinder';

interface HarnessHandle {
  container: HTMLDivElement | null;
  scan: () => void;
}

interface HarnessProps {
  adapters: readonly DiagramScanAdapter[];
  mode?: 'after-paint' | 'before-paint';
  filterStale?: boolean;
  children?: ReactNode;
  onReady?: (handle: HarnessHandle) => void;
}

function CoordinatorHarness({
  adapters,
  mode = 'before-paint',
  filterStale = false,
  children,
  onReady,
}: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { renderPortals, scan } = useDiagramScanCoordinator(containerRef, {
    mode,
    filterStale,
    adapters,
  });

  useEffect(() => {
    onReady?.({ container: containerRef.current, scan });
  }, [onReady, scan]);

  return createElement(
    'div',
    null,
    createElement('div', { ref: containerRef }, children),
    renderPortals()
  );
}

interface MountResult {
  container: HTMLElement;
  root: Root;
}

function mountHarness(props: HarnessProps): MountResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(CoordinatorHarness, props));
  });
  return { container, root };
}

function unmountHarness(root: Root): void {
  act(() => {
    root.unmount();
  });
}

function findBySelector(
  root: ParentNode,
  selector: string,
  codeAttr: string,
  idAttr: string
): BaseDiagramInfo[] {
  return Array.from(root.querySelectorAll(selector))
    .map((el) => {
      const code = el.getAttribute(codeAttr);
      const id = el.getAttribute(idAttr);
      if (!code || !id) {
        return null;
      }
      return {
        id,
        code,
        el: el as HTMLElement,
      };
    })
    .filter((value): value is BaseDiagramInfo => value !== null);
}

function flushRafQueue(callbacks: Map<number, FrameRequestCallback>): void {
  const queued = Array.from(callbacks.entries());
  callbacks.clear();
  for (const [, cb] of queued) {
    cb(0);
  }
}

describe('useDiagramScanCoordinator', () => {
  const OriginalMutationObserver = globalThis.MutationObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const originalActEnv = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;

  const observerInstances: Array<{
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: () => void;
  }> = [];

  let rafCallbacks = new Map<number, FrameRequestCallback>();
  let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
  let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    observerInstances.length = 0;
    rafCallbacks = new Map<number, FrameRequestCallback>();

    class MockMutationObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      private callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerInstances.push({
          observe: this.observe,
          disconnect: this.disconnect,
          trigger: () => {
            this.callback([], this as unknown as MutationObserver);
          },
        });
      }
    }

    let nextRafId = 0;
    requestAnimationFrameMock = vi.fn((cb: FrameRequestCallback) => {
      const id = ++nextRafId;
      rafCallbacks.set(id, cb);
      return id;
    });
    cancelAnimationFrameMock = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });

    (
      globalThis as { MutationObserver: typeof MutationObserver }
    ).MutationObserver =
      MockMutationObserver as unknown as typeof MutationObserver;
    (
      globalThis as { requestAnimationFrame: typeof requestAnimationFrame }
    ).requestAnimationFrame =
      requestAnimationFrameMock as typeof requestAnimationFrame;
    (
      globalThis as { cancelAnimationFrame: typeof cancelAnimationFrame }
    ).cancelAnimationFrame =
      cancelAnimationFrameMock as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = originalActEnv;
    (
      globalThis as { MutationObserver: typeof MutationObserver }
    ).MutationObserver = OriginalMutationObserver;
    (
      globalThis as { requestAnimationFrame: typeof requestAnimationFrame }
    ).requestAnimationFrame = originalRequestAnimationFrame;
    (
      globalThis as { cancelAnimationFrame: typeof cancelAnimationFrame }
    ).cancelAnimationFrame = originalCancelAnimationFrame;
    document.body.innerHTML = '';
  });

  it('uses one MutationObserver and discovers mixed diagram types on initial scan', () => {
    const mermaidFinder = vi.fn((root: ParentNode) =>
      findBySelector(
        root,
        '.mermaid-container[data-mermaid-chart]',
        'data-mermaid-chart',
        'data-mermaid-id'
      )
    );
    const plantUmlFinder = vi.fn((root: ParentNode) =>
      findBySelector(
        root,
        '.plantuml-container[data-plantuml-code]',
        'data-plantuml-code',
        'data-plantuml-id'
      )
    );
    const graphvizFinder = vi.fn((root: ParentNode) =>
      findBySelector(
        root,
        '.graphviz-container[data-graphviz-code]',
        'data-graphviz-code',
        'data-graphviz-id'
      )
    );

    const adapters: readonly DiagramScanAdapter[] = [
      {
        key: 'mermaid',
        findContainers: mermaidFinder,
        renderElement: (diagram) =>
          createElement('span', {
            'data-portal-kind': 'mermaid',
            'data-portal-id': diagram.id,
          }),
      },
      {
        key: 'plantuml',
        findContainers: plantUmlFinder,
        renderElement: (diagram) =>
          createElement('span', {
            'data-portal-kind': 'plantuml',
            'data-portal-id': diagram.id,
          }),
      },
      {
        key: 'graphviz',
        findContainers: graphvizFinder,
        renderElement: (diagram) =>
          createElement('span', {
            'data-portal-kind': 'graphviz',
            'data-portal-id': diagram.id,
          }),
      },
    ];

    const { container, root } = mountHarness({
      adapters,
      children: [
        createElement('div', {
          key: 'm',
          className: 'mermaid-container',
          'data-mermaid-id': 'm1',
          'data-mermaid-chart': 'graph TD;A-->B',
        }),
        createElement('div', {
          key: 'p',
          className: 'plantuml-container',
          'data-plantuml-id': 'p1',
          'data-plantuml-code': '@startuml',
        }),
        createElement('div', {
          key: 'g',
          className: 'graphviz-container',
          'data-graphviz-id': 'g1',
          'data-graphviz-code': 'digraph G {A->B}',
        }),
      ],
    });

    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observe).toHaveBeenCalledTimes(1);
    expect(mermaidFinder).toHaveBeenCalledTimes(1);
    expect(plantUmlFinder).toHaveBeenCalledTimes(1);
    expect(graphvizFinder).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('[data-portal-kind]')).toHaveLength(3);

    unmountHarness(root);
  });

  it('coalesces burst mutation callbacks into one RAF scan batch', () => {
    const finder = vi.fn((root: ParentNode) =>
      findBySelector(root, '.diagram', 'data-code', 'data-id')
    );
    const adapters: readonly DiagramScanAdapter[] = [
      {
        key: 'test',
        findContainers: finder,
        renderElement: () => createElement('span', { 'data-portal-kind': 'x' }),
      },
    ];

    const { root } = mountHarness({
      adapters,
      children: createElement('div', {
        className: 'diagram',
        'data-id': 'd1',
        'data-code': 'x',
      }),
    });

    expect(finder).toHaveBeenCalledTimes(1);

    act(() => {
      observerInstances[0].trigger();
      observerInstances[0].trigger();
      observerInstances[0].trigger();
    });

    expect(finder).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(3);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);

    act(() => {
      flushRafQueue(rafCallbacks);
    });

    expect(finder).toHaveBeenCalledTimes(2);

    unmountHarness(root);
  });

  it('filters stale detached elements when filterStale is true', () => {
    const detached = document.createElement('div');
    const finder = vi.fn((root: ParentNode): BaseDiagramInfo[] => {
      const attached = root.querySelector(
        '.attached[data-id][data-code]'
      ) as HTMLElement;
      return [
        {
          id: 'attached',
          code: attached.getAttribute('data-code') || '',
          el: attached,
        },
        {
          id: 'detached',
          code: 'detached-code',
          el: detached,
        },
      ];
    });

    const adapters: readonly DiagramScanAdapter[] = [
      {
        key: 'test',
        findContainers: finder,
        renderElement: (diagram) =>
          createElement('span', {
            'data-portal-id': diagram.id,
          }),
      },
    ];

    const { container, root } = mountHarness({
      adapters,
      filterStale: true,
      children: createElement('div', {
        className: 'attached',
        'data-id': 'a1',
        'data-code': 'attached-code',
      }),
    });

    const attached = container.querySelector('.attached');
    expect(attached?.querySelector('[data-portal-id="attached"]')).toBeTruthy();
    expect(detached.querySelector('[data-portal-id="detached"]')).toBeNull();

    unmountHarness(root);
  });

  it('scan() triggers immediate rescan and updates portals', () => {
    const finder = vi.fn((root: ParentNode) =>
      findBySelector(root, '.diagram', 'data-code', 'data-id')
    );
    const adapters: readonly DiagramScanAdapter[] = [
      {
        key: 'test',
        findContainers: finder,
        renderElement: (diagram) =>
          createElement('span', {
            'data-portal-id': diagram.id,
          }),
      },
    ];

    let handle: HarnessHandle | null = null;
    const { container, root } = mountHarness({
      adapters,
      onReady: (nextHandle) => {
        handle = nextHandle;
      },
      children: createElement('div', {
        className: 'diagram',
        'data-id': 'd1',
        'data-code': 'one',
      }),
    });

    expect(container.querySelectorAll('[data-portal-id]')).toHaveLength(1);

    const secondDiagram = document.createElement('div');
    secondDiagram.className = 'diagram';
    secondDiagram.setAttribute('data-id', 'd2');
    secondDiagram.setAttribute('data-code', 'two');
    handle?.container?.appendChild(secondDiagram);

    act(() => {
      handle?.scan();
    });

    expect(container.querySelectorAll('[data-portal-id]')).toHaveLength(2);

    unmountHarness(root);
  });

  it('disconnects observer and cancels pending RAF on cleanup', () => {
    const adapters: readonly DiagramScanAdapter[] = [
      {
        key: 'test',
        findContainers: (root) =>
          findBySelector(root, '.diagram', 'data-code', 'data-id'),
        renderElement: () => createElement('span'),
      },
    ];

    const { root } = mountHarness({
      adapters,
      children: createElement('div', {
        className: 'diagram',
        'data-id': 'd1',
        'data-code': 'x',
      }),
    });

    act(() => {
      observerInstances[0].trigger();
    });

    expect(rafCallbacks.size).toBe(1);
    unmountHarness(root);

    expect(observerInstances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameMock).toHaveBeenCalled();
  });
});
