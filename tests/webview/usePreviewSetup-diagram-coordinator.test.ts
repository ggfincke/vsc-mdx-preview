// tests/webview/usePreviewSetup-diagram-coordinator.test.ts
// integration contract tests for usePreviewSetup -> diagram coordinator wiring
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, useEffect, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

const {
  coordinatorCalls,
  mockRenderPortals,
  mockScan,
  mockHandleImageClick,
  mockExtractHeadings,
  mockAdapters,
} = vi.hoisted(() => ({
  coordinatorCalls: [] as Array<{
    containerRef: RefObject<HTMLElement | null>;
    options: {
      mode?: 'after-paint' | 'before-paint';
      filterStale?: boolean;
      adapters: readonly { key: string }[];
    };
  }>,
  mockRenderPortals: vi.fn(() => [createElement('span', { key: 'portal' })]),
  mockScan: vi.fn(),
  mockHandleImageClick: vi.fn(),
  mockExtractHeadings: vi.fn(),
  mockAdapters: [
    { key: 'mermaid' },
    { key: 'plantuml' },
    { key: 'graphviz' },
  ] as const,
}));

vi.mock(
  '../../packages/webview-client/src/features/diagrams/hooks/useDiagramScanCoordinator',
  () => ({
    useDiagramScanCoordinator: (
      containerRef: RefObject<HTMLElement | null>,
      options: {
        mode?: 'after-paint' | 'before-paint';
        filterStale?: boolean;
        adapters: readonly { key: string }[];
      }
    ) => {
      coordinatorCalls.push({ containerRef, options });
      return {
        renderPortals: mockRenderPortals,
        scan: mockScan,
      };
    },
  })
);

vi.mock(
  '../../packages/webview-client/src/features/lightbox/hooks/useImageLightbox',
  () => ({
    useImageLightbox: () => ({
      handleImageClick: mockHandleImageClick,
    }),
  })
);

vi.mock(
  '../../packages/webview-client/src/features/preview/shared/hooks/useTocExtraction',
  () => ({
    useTocExtraction: () => mockExtractHeadings,
  })
);

vi.mock(
  '../../packages/webview-client/src/features/diagrams/hooks/diagramAdapters',
  () => ({
    DIAGRAM_SCAN_ADAPTERS: mockAdapters,
  })
);

import { usePreviewSetup } from '../../packages/webview-client/src/features/preview/shared/hooks/usePreviewSetup';

interface HarnessProps {
  diagramMode: 'after-paint' | 'before-paint';
  filterStale?: boolean;
  onReady: (result: ReturnType<typeof usePreviewSetup>) => void;
}

function Harness({ diagramMode, filterStale, onReady }: HarnessProps) {
  const result = usePreviewSetup({ diagramMode, filterStale });

  useEffect(() => {
    onReady(result);
  }, [onReady, result]);

  return createElement('div', { ref: result.containerRef });
}

function mountHarness(props: HarnessProps): {
  container: HTMLElement;
  root: Root;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(Harness, props));
  });
  return { container, root };
}

function unmountHarness(root: Root): void {
  act(() => {
    root.unmount();
  });
}

describe('usePreviewSetup diagram coordinator integration', () => {
  const originalActEnv = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    coordinatorCalls.length = 0;
  });

  afterEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = originalActEnv;
    document.body.innerHTML = '';
  });

  it('scan() from usePreviewSetup delegates to coordinator', () => {
    let latest: ReturnType<typeof usePreviewSetup> | null = null;

    const { root } = mountHarness({
      diagramMode: 'after-paint',
      onReady: (result) => {
        latest = result;
      },
    });

    expect(latest).toBeTruthy();
    act(() => {
      latest?.scan();
    });

    expect(mockScan).toHaveBeenCalledTimes(1);

    unmountHarness(root);
  });

  it('renderPortals() delegates to coordinator and adapter order stays Mermaid -> PlantUML -> Graphviz', () => {
    const portalNodes = [
      createElement('span', { key: 'm', 'data-kind': 'mermaid' }),
      createElement('span', { key: 'p', 'data-kind': 'plantuml' }),
      createElement('span', { key: 'g', 'data-kind': 'graphviz' }),
    ];
    mockRenderPortals.mockReturnValueOnce(portalNodes);

    let latest: ReturnType<typeof usePreviewSetup> | null = null;
    const { root } = mountHarness({
      diagramMode: 'after-paint',
      filterStale: true,
      onReady: (result) => {
        latest = result;
      },
    });

    expect(coordinatorCalls).toHaveLength(1);
    expect(coordinatorCalls[0].options.adapters.map((a) => a.key)).toEqual([
      'mermaid',
      'plantuml',
      'graphviz',
    ]);

    const result = latest?.renderPortals();
    expect(mockRenderPortals).toHaveBeenCalledTimes(1);
    expect(result).toBe(portalNodes);

    unmountHarness(root);
  });

  it('passes diagramMode through to coordinator for before-paint and after-paint paths', () => {
    let latest: ReturnType<typeof usePreviewSetup> | null = null;

    const firstMount = mountHarness({
      diagramMode: 'before-paint',
      onReady: (result) => {
        latest = result;
      },
    });

    expect(latest).toBeTruthy();
    expect(coordinatorCalls[0].options.mode).toBe('before-paint');
    unmountHarness(firstMount.root);

    coordinatorCalls.length = 0;

    const secondMount = mountHarness({
      diagramMode: 'after-paint',
      onReady: (result) => {
        latest = result;
      },
    });

    expect(latest).toBeTruthy();
    expect(coordinatorCalls[0].options.mode).toBe('after-paint');
    unmountHarness(secondMount.root);
  });
});
