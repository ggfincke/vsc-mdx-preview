// tests/extension/language/MDXOutlineProvider.test.ts
// unit tests for MDX preview outline tree data provider

import { describe, it, expect, vi } from 'vitest';
import {
  MDXOutlineProvider,
  SymbolTreeItem,
} from '../../../packages/extension-host/src/features/language/MDXOutlineProvider';
import {
  Uri,
  Range,
  SymbolKind,
  TreeItemCollapsibleState,
  ThemeIcon,
} from 'vscode';

function createMockDocument(content: string): any {
  const lines = content.split('\n');
  return {
    uri: Uri.file('/test.mdx'),
    languageId: 'mdx',
    getText: () => content,
    lineCount: lines.length,
    lineAt: (line: number) => ({
      text: lines[Math.min(line, lines.length - 1)] ?? '',
      range: new Range(
        line,
        0,
        line,
        (lines[Math.min(line, lines.length - 1)] ?? '').length
      ),
    }),
  };
}

describe('MDXOutlineProvider', () => {
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

  it('fires onDidChangeTreeData on update', () => {
    const provider = new MDXOutlineProvider();
    const handler = vi.fn();
    provider.onDidChangeTreeData(handler);

    const doc = createMockDocument('# Test\n');
    provider.update(doc);

    expect(handler).toHaveBeenCalled();
  });

  it('clears symbols & fires change event', () => {
    const provider = new MDXOutlineProvider();
    const doc = createMockDocument('# Test\n');
    provider.update(doc);
    expect(provider.getChildren().length).toBeGreaterThan(0);

    const handler = vi.fn();
    provider.onDidChangeTreeData(handler);
    provider.clear();

    expect(provider.getChildren()).toEqual([]);
    expect(handler).toHaveBeenCalled();
  });

  it('tree items have correct icon & navigation command', () => {
    const provider = new MDXOutlineProvider();
    const doc = createMockDocument('# Heading\n');
    provider.update(doc);

    const items = provider.getChildren();
    const item = items[0];

    expect(item.iconPath).toBeInstanceOf(ThemeIcon);
    expect((item.iconPath as ThemeIcon).id).toBe('symbol-string');
    expect(item.command).toBeDefined();
    expect(item.command!.command).toBe('vscode.open');
  });
});
