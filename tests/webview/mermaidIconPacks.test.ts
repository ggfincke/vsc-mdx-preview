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
  it('sanitizes icon bodies, stripping <image> & external refs', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack('aws', '<image href="https://evil.example/x"/><path d="M0 0"/>'),
    ]);
    const reg = registered.find((r) => r.name === 'aws');
    expect(reg).toBeDefined();
    const out = getRegisteredIcons(reg!);
    expect(out.icons.sample.body).not.toContain('<image');
    expect(out.icons.sample.body).not.toContain('evil.example');
    expect(out.icons.sample.body).toContain('path');
  });

  it('strips style attributes (CSS url() beacon vector)', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack(
        'aws',
        '<rect style="mask-image:url(https://evil.example/x)"/><path d="M0 0"/>'
      ),
    ]);
    const out = getRegisteredIcons(registered.find((r) => r.name === 'aws')!);
    expect(out.icons.sample.body).not.toContain('evil.example');
    expect(out.icons.sample.body).not.toContain('style');
    expect(out.icons.sample.body).toContain('path');
  });

  it('preserves safe vector markup through sanitization', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack('icons', '<circle cx="12" cy="12" r="10"/><path d="M2 2"/>'),
    ]);
    const out = getRegisteredIcons(registered.find((r) => r.name === 'icons')!);
    expect(out.icons.sample.body).toContain('circle');
    expect(out.icons.sample.body).toContain('path');
  });

  it('skips the reserved name "logos"', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [pack('logos', '<path/>')]);
    expect(registered.find((r) => r.name === 'logos')).toBeUndefined();
  });

  it('skips invalid pack names', () => {
    const { mermaid, registered } = makeMermaid();
    registerDynamicIconPacks(mermaid, [
      pack('has space', '<path/>'),
      pack('evil:prefix', '<path/>'),
    ]);
    expect(registered).toHaveLength(0);
  });

  it('skips unchanged pack content & registers changed content', () => {
    const { mermaid, registered } = makeMermaid();
    const original = pack('aws', '<path/>');
    registerDynamicIconPacks(mermaid, [original]);
    registerDynamicIconPacks(mermaid, [original]);
    registerDynamicIconPacks(mermaid, [pack('aws', '<circle/>')]);

    expect(registered.filter((r) => r.name === 'aws')).toHaveLength(2);
    expect(
      getRegisteredIcons(registered.filter((r) => r.name === 'aws')[1]).icons
        .sample.body
    ).toContain('circle');
  });
});
