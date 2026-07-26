// tests/extension/language/MDXSymbolProvider.test.ts
// unit tests for MDX document symbol provider

import { beforeEach, describe, it, expect } from 'vitest';
import { MDXSymbolProvider } from '../../../packages/extension-host/src/features/language/MDXSymbolProvider';
import { clearMdxAnalysisCache } from '../../../packages/extension-host/src/shared/mdx-analysis/document-analysis';
import { SymbolKind, type CancellationToken } from 'vscode';
import { createMockDocument } from '../../helpers/mock-document';

const provider = new MDXSymbolProvider();
const token = {} as CancellationToken;

describe('MDXSymbolProvider', () => {
  beforeEach(() => {
    clearMdxAnalysisCache();
  });

  describe('headings', () => {
    it('builds nested heading hierarchy', () => {
      const doc = createMockDocument(
        '# Top\n\n## Child 1\n\nSome text\n\n## Child 2\n\n### Grandchild\n'
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      // h1 at root
      const top = symbols!.find((s) => s.name === 'Top');
      expect(top).toBeDefined();
      expect(top!.kind).toBe(SymbolKind.String);
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
      const doc = createMockDocument('---\ntitle: Hello\n---\n\n# Heading\n');
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
      const defaultImport = provider.provideDocumentSymbols(
        createMockDocument("import Foo from './Foo'\n\n# Content\n"),
        token
      );
      expect(defaultImport).toBeDefined();
      const defaultSymbol = defaultImport!.find(
        (s) => s.kind === SymbolKind.Module
      );
      expect(defaultSymbol).toBeDefined();
      expect(defaultSymbol!.name).toBe('Foo');
      expect(defaultSymbol!.detail).toBe('import');

      clearMdxAnalysisCache();
      const namedImport = provider.provideDocumentSymbols(
        createMockDocument(
          "import { Foo, Bar } from './components'\n\n# Content\n"
        ),
        token
      );
      expect(namedImport).toBeDefined();
      const namedSymbol = namedImport!.find(
        (s) => s.kind === SymbolKind.Module
      );
      expect(namedSymbol).toBeDefined();
      expect(namedSymbol!.name).toBe('Foo, Bar');
    });

    it('detects export statements as Variable symbols', () => {
      const doc = createMockDocument(
        "export const config = { title: 'test' }\n\n# Content\n"
      );
      const symbols = provider.provideDocumentSymbols(doc, token);

      expect(symbols).toBeDefined();

      const exportSymbol = symbols!.find((s) => s.kind === SymbolKind.Variable);
      expect(exportSymbol).toBeDefined();
      expect(exportSymbol!.name).toBe('config');
      expect(exportSymbol!.detail).toBe('export');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty document', () => {
      expect(
        provider.provideDocumentSymbols(createMockDocument(''), token)
      ).toEqual([]);
      expect(
        provider.provideDocumentSymbols(createMockDocument('   \n\n  '), token)
      ).toEqual([]);
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
