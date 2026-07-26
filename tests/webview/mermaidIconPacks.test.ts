// tests/webview/mermaidIconPacks.test.ts
// verify dynamic icon packs are name-checked & DOMPurify-sanitized before register
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

// decouple from the bundled pack so the test runs without the iconify dep
vi.mock('@iconify-json/logos/icons.json', () => ({
  default: { prefix: 'logos', icons: {} },
}));

import {
  registerBuiltinIconPacks,
  registerDynamicIconPacks,
  resetMermaidIconPacks,
} from '../../packages/webview-client/src/features/diagrams/utils/mermaidIconPacks';
import type { MermaidModule } from '../../packages/webview-client/src/features/diagrams/utils/mermaidLoader';
import type { ResolvedMermaidIconPack } from '../../packages/contracts/src/index';

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
  it('registers the builtin logos pack exactly once', () => {
    const { mermaid, registered } = makeMermaid();
    registerBuiltinIconPacks(mermaid);
    registerBuiltinIconPacks(mermaid);
    expect(registered.filter((r) => r.name === 'logos')).toHaveLength(1);
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
