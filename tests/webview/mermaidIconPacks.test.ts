// tests/webview/mermaidIconPacks.test.ts
// verify diagram modules stay lazy & icon packs register sanitized content
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';

const { rendererRenders } = vi.hoisted(() => ({
  rendererRenders: {
    mermaid: vi.fn(),
    plantuml: vi.fn(),
    graphviz: vi.fn(),
  },
}));

vi.mock(
  '../../packages/webview-client/src/features/diagrams/ui/MermaidRenderer/MermaidRenderer',
  () => {
    return {
      MermaidRenderer: () => {
        rendererRenders.mermaid();
        return null;
      },
    };
  }
);

vi.mock(
  '../../packages/webview-client/src/features/diagrams/ui/PlantUMLRenderer/PlantUMLRenderer',
  () => {
    return {
      PlantUMLRenderer: () => {
        rendererRenders.plantuml();
        return null;
      },
    };
  }
);

vi.mock(
  '../../packages/webview-client/src/features/diagrams/ui/GraphvizRenderer/GraphvizRenderer',
  () => {
    return {
      GraphvizRenderer: () => {
        rendererRenders.graphviz();
        return null;
      },
    };
  }
);

import {
  registerBuiltinIconPacks,
  registerDynamicIconPacks,
  resetMermaidIconPacks,
} from '../../packages/webview-client/src/features/diagrams/utils/mermaidIconPacks';
import type { MermaidModule } from '../../packages/webview-client/src/features/diagrams/utils/mermaidLoader';
import type { ResolvedMermaidIconPack } from '../../packages/contracts/src/index';
import { DIAGRAM_SCAN_ADAPTERS } from '../../packages/webview-client/src/features/diagrams/hooks/diagramAdapters';

function makeMermaid() {
  const registered: Array<{
    name: string;
    loader?: () => unknown;
    icons?: unknown;
  }> = [];
  const mermaid = {
    default: {
      registerIconPacks: (
        packs: Array<{
          name: string;
          loader?: () => unknown;
          icons?: unknown;
        }>
      ) => {
        registered.push(...packs);
      },
    },
  } as unknown as MermaidModule;
  return { mermaid, registered };
}

function pack(name: string, body: string): ResolvedMermaidIconPack {
  return { name, icons: { icons: { sample: { body } } } };
}

function getRegisteredIcons(registration: {
  loader?: () => unknown;
  icons?: unknown;
}): {
  icons: Record<string, { body: string }>;
} {
  return (registration.icons ?? registration.loader?.()) as {
    icons: Record<string, { body: string }>;
  };
}

beforeEach(() => {
  resetMermaidIconPacks();
});

describe('registerBuiltinIconPacks', () => {
  it('renders only demanded adapters & shares builtin icon loading', async () => {
    const mermaidAdapter = DIAGRAM_SCAN_ADAPTERS.find(
      (adapter) => adapter.key === 'mermaid'
    )!;
    const host = document.createElement('div');
    for (const adapter of DIAGRAM_SCAN_ADAPTERS) {
      expect(adapter.findContainers(host)).toEqual([]);
    }
    expect(rendererRenders.mermaid).not.toHaveBeenCalled();
    expect(rendererRenders.plantuml).not.toHaveBeenCalled();
    expect(rendererRenders.graphviz).not.toHaveBeenCalled();

    const root = createRoot(host);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    try {
      act(() => {
        root.render(
          createElement(
            Fragment,
            null,
            mermaidAdapter.renderElement({
              id: 'first',
              code: 'graph TD; A-->B',
              el: document.createElement('div'),
            }),
            mermaidAdapter.renderElement({
              id: 'second',
              code: 'graph TD; B-->C',
              el: document.createElement('div'),
            })
          )
        );
      });

      await act(async () => {
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(rendererRenders.mermaid).toHaveBeenCalledTimes(2);
      });

      expect(rendererRenders.plantuml).not.toHaveBeenCalled();
      expect(rendererRenders.graphviz).not.toHaveBeenCalled();

      const { mermaid, registered } = makeMermaid();
      registerBuiltinIconPacks(mermaid);
      registerBuiltinIconPacks(mermaid);
      const builtinRegistrations = registered.filter(
        (registration) => registration.name === 'logos'
      );
      expect(builtinRegistrations).toHaveLength(1);

      const firstLoad = builtinRegistrations[0].loader!();
      const concurrentLoad = builtinRegistrations[0].loader!();
      expect(concurrentLoad).toBe(firstLoad);
      const icons = await firstLoad;
      expect(icons).toMatchObject({ prefix: 'logos' });
      expect(
        (icons as { icons: Record<string, unknown> }).icons
      ).toHaveProperty('aws-lambda');
    } finally {
      act(() => root.unmount());
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = false;
    }
  });
});

describe('registerDynamicIconPacks', () => {
  it('sanitizes icon bodies across XSS vectors & preserves safe markup', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack('aws', '<image href="https://evil.example/x"/><path d="M0 0"/>'),
    ]);
    const imageOut = getRegisteredIcons(
      registered.find((r) => r.name === 'aws')!
    );
    expect(imageOut.icons.sample.body).not.toContain('<image');
    expect(imageOut.icons.sample.body).not.toContain('evil.example');
    expect(imageOut.icons.sample.body).toContain('path');

    registered.length = 0;
    registerDynamicIconPacks(mermaid, [
      pack(
        'aws',
        '<rect style="mask-image:url(https://evil.example/x)"/><path d="M0 0"/>'
      ),
    ]);
    const styleOut = getRegisteredIcons(
      registered.find((r) => r.name === 'aws')!
    );
    expect(styleOut.icons.sample.body).not.toContain('evil.example');
    expect(styleOut.icons.sample.body).not.toContain('style');
    expect(styleOut.icons.sample.body).toContain('path');

    registered.length = 0;
    registerDynamicIconPacks(mermaid, [
      pack('icons', '<circle cx="12" cy="12" r="10"/><path d="M2 2"/>'),
    ]);
    const safeOut = getRegisteredIcons(
      registered.find((r) => r.name === 'icons')!
    );
    expect(safeOut.icons.sample.body).toContain('circle');
    expect(safeOut.icons.sample.body).toContain('path');
  });

  it('skips reserved and invalid pack names', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack('logos', '<path/>'),
      pack('has space', '<path/>'),
      pack('evil:prefix', '<path/>'),
    ]);
    expect(registered.find((r) => r.name === 'logos')).toBeUndefined();
    expect(registered).toHaveLength(0);
  });

  it('tracks changed and removed pack content by fingerprint', () => {
    const { mermaid, registered } = makeMermaid();
    const original = pack('aws', '<path/>');
    registerDynamicIconPacks(mermaid, [original]);
    registerDynamicIconPacks(mermaid, [original]);
    const changed = pack('aws', '<circle/>');
    registerDynamicIconPacks(mermaid, [changed]);
    registerDynamicIconPacks(mermaid, []);
    registerDynamicIconPacks(mermaid, [changed]);

    const registrations = registered.filter((r) => r.name === 'aws');
    expect(registrations).toHaveLength(4);
    expect(getRegisteredIcons(registrations[2]).icons).toEqual({});
    expect(getRegisteredIcons(registrations[3]).icons.sample.body).toContain(
      'circle'
    );
  });
});
