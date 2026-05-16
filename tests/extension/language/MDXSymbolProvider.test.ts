// tests/extension/language/MDXSymbolProvider.test.ts
// unit tests for MDX document symbol provider

import { describe, it, expect } from 'vitest';
import { MDXSymbolProvider } from '../../../packages/extension-host/src/features/language/MDXSymbolProvider';
import { Position, SymbolKind, type CancellationToken } from 'vscode';
import { createMockDocument } from '../../helpers/mock-document';

const provider = new MDXSymbolProvider();
const token = {} as CancellationToken;

describe('MDXSymbolProvider', () => {
  describe('headings', () => {
    it('returns heading symbols for h1-h6', () => {
      const doc = createMockDocument(
        '# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4\n##### Heading 5\n###### Heading 6'
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();
      expect(symbols!.length).toBeGreaterThanOrEqual(1);

      // h1 should be at root
      const h1 = symbols!.find((s) => s.name === 'Heading 1');
      expect(h1).toBeDefined();
      expect(h1!.kind).toBe(SymbolKind.String);
    });

    it('builds nested heading hierarchy', () => {
      const doc = createMockDocument(
        '# Top\n\n## Child 1\n\nSome text\n\n## Child 2\n\n### Grandchild\n'
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      // h1 at root
      const top = symbols!.find((s) => s.name === 'Top');
      expect(top).toBeDefined();
      expect(top!.children.length).toBe(2);
      expect(top!.children[0].name).toBe('Child 1');
      expect(top!.children[1].name).toBe('Child 2');
      expect(top!.range.end.line).toBe(9);
      expect(top!.children[0].range.end.line).toBe(5);
      expect(top!.children[1].range.end.line).toBe(9);

      // h3 nested under h2
      expect(top!.children[1].children.length).toBe(1);
      expect(top!.children[1].children[0].name).toBe('Grandchild');
      expect(top!.children[1].children[0].range.end.line).toBe(9);
    });

    it('extracts heading text w/ inline code', () => {
      const doc = createMockDocument('# Hello `world`\n');
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();
      const heading = symbols!.find((s) => s.kind === SymbolKind.String);
      expect(heading).toBeDefined();
      expect(heading!.name).toBe('Hello world');
    });

    it('handles untitled headings', () => {
      const doc = createMockDocument('#\n');
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();
      const heading = symbols!.find((s) => s.kind === SymbolKind.String);
      expect(heading).toBeDefined();
      expect(heading!.name).toBe('(untitled)');
    });
  });

  describe('frontmatter', () => {
    it('handles frontmatter as Struct symbol w/ Property children', () => {
      const doc = createMockDocument(
        '---\ntitle: Hello\ndescription: World\n---\n\n# Content\n'
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const fm = symbols!.find((s) => s.name === 'Frontmatter');
      expect(fm).toBeDefined();
      expect(fm!.kind).toBe(SymbolKind.Struct);
      expect(fm!.children.length).toBe(2);
      expect(fm!.children[0].name).toBe('title');
      expect(fm!.children[0].kind).toBe(SymbolKind.Property);
      expect(fm!.children[1].name).toBe('description');
    });

    it('offsets positions correctly w/ frontmatter', () => {
      const doc = createMockDocument(
        '---\ntitle: Hello\n---\n\n# Heading\n'
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const heading = symbols!.find((s) => s.name === 'Heading');
      expect(heading).toBeDefined();
      // heading is on line 4 (0-indexed) in the full document
      expect(heading!.selectionRange.start.line).toBe(4);
    });
  });

  describe('imports & exports', () => {
    it('detects import statements as Module symbols', () => {
      const doc = createMockDocument(
        "import Foo from './Foo'\n\n# Content\n"
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const importSymbol = symbols!.find(
        (s) => s.kind === SymbolKind.Module
      );
      expect(importSymbol).toBeDefined();
      expect(importSymbol!.name).toBe('Foo');
      expect(importSymbol!.detail).toBe('import');
    });

    it('detects export statements as Variable symbols', () => {
      const doc = createMockDocument(
        "export const config = { title: 'test' }\n\n# Content\n"
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const exportSymbol = symbols!.find(
        (s) => s.kind === SymbolKind.Variable
      );
      expect(exportSymbol).toBeDefined();
      expect(exportSymbol!.name).toBe('config');
      expect(exportSymbol!.detail).toBe('export');
    });

    it('detects named imports', () => {
      const doc = createMockDocument(
        "import { Foo, Bar } from './components'\n\n# Content\n"
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const importSymbol = symbols!.find(
        (s) => s.kind === SymbolKind.Module
      );
      expect(importSymbol).toBeDefined();
      expect(importSymbol!.name).toBe('Foo, Bar');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty document', () => {
      const doc = createMockDocument('');
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toEqual([]);
    });

    it('returns empty array for whitespace-only document', () => {
      const doc = createMockDocument('   \n\n  ');
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toEqual([]);
    });

    it('handles document w/ only frontmatter', () => {
      const doc = createMockDocument('---\ntitle: Hello\n---\n');
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();
      expect(symbols!.length).toBe(1);
      expect(symbols![0].name).toBe('Frontmatter');
    });
  });
});
