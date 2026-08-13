// tests/extension/language/MDXOutlineProvider.test.ts
// unit tests for MDX preview outline tree data provider

import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  MDXOutlineProvider,
  SymbolTreeItem,
} from '../../../packages/extension-host/src/features/language/MDXOutlineProvider';
import { clearMdxAnalysisCache } from '../../../packages/extension-host/src/shared/mdx-analysis/document-analysis';
import { createMockDocument } from '../../helpers/mock-document';

describe('MDXOutlineProvider', () => {
  beforeEach(() => {
    clearMdxAnalysisCache();
  });

  it('returns root symbols from MDX document', () => {
    const provider = new MDXOutlineProvider();
    const doc = createMockDocument('# Hello\n\n## World\n');
    provider.update(doc);

    const children = provider.getChildren();
    expect(children.length).toBeGreaterThan(0);
    expect(children[0]).toBeInstanceOf(SymbolTreeItem);
    expect(children[0].label).toBe('Hello');
  });

  it('returns nested children for heading hierarchy', () => {
    const provider = new MDXOutlineProvider();
    const doc = createMockDocument('# Top\n\n## Child\n\n### Grandchild\n');
    provider.update(doc);

    const root = provider.getChildren();
    expect(root.length).toBe(1);
    expect(root[0].label).toBe('Top');

    // h2 is a child of h1
    const h2Children = provider.getChildren(root[0]);
    expect(h2Children.length).toBe(1);
    expect(h2Children[0].label).toBe('Child');

    // h3 is a child of h2
    const h3Children = provider.getChildren(h2Children[0]);
    expect(h3Children.length).toBe(1);
    expect(h3Children[0].label).toBe('Grandchild');
  });

  it('publishes each current snapshot across parse failure, repair & clear', () => {
    const provider = new MDXOutlineProvider();
    const handler = vi.fn();
    provider.onDidChangeTreeData(handler);

    const validA = createMockDocument('# A\n\n## A Child\n', {
      fsPath: '/workspace/a.mdx',
    });
    provider.update(validA);
    expect(handler).toHaveBeenCalledTimes(1);
    const staleA = provider.getChildren()[0];
    expect(staleA.label).toBe('A');
    expect(provider.getChildren(staleA).map((item) => item.label)).toEqual([
      'A Child',
    ]);

    const malformedB = createMockDocument('<Broken', {
      fsPath: '/workspace/b.mdx',
    });
    provider.update(malformedB);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(provider.getChildren()).toEqual([]);
    expect(provider.getChildren(staleA)).toEqual([]);
    expect((provider as unknown as { documentUri?: unknown }).documentUri).toBe(
      malformedB.uri
    );

    const repairedB = createMockDocument('# B\n\n## B Child\n', {
      fsPath: '/workspace/b.mdx',
      version: 2,
    });
    provider.update(repairedB);
    expect(handler).toHaveBeenCalledTimes(3);
    const staleB = provider.getChildren()[0];
    expect(staleB.label).toBe('B');
    expect(staleB.documentUri).toBe(repairedB.uri);
    expect(provider.getChildren(staleB).map((item) => item.label)).toEqual([
      'B Child',
    ]);

    provider.update(
      createMockDocument('{', {
        fsPath: '/workspace/b.mdx',
        version: 3,
      })
    );
    expect(handler).toHaveBeenCalledTimes(4);
    expect(provider.getChildren()).toEqual([]);
    expect(provider.getChildren(staleB)).toEqual([]);

    provider.clear();
    expect(provider.getChildren()).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(5);
  });
});
