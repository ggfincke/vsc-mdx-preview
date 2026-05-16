// tests/extension/language/MDXCompletionProvider.test.ts
// unit tests for MDX completion provider

import { describe, it, expect, vi } from 'vitest';
import { MDXCompletionProvider } from '../../../packages/extension-host/src/features/language/MDXCompletionProvider';
import {
  Position,
  CompletionItemKind,
  SnippetString,
  type CancellationToken,
} from 'vscode';
import { createMockDocument } from '../../helpers/mock-document';

// mock service locator to avoid ServiceRegistry dependency
vi.mock(
  '../../../packages/extension-host/src/app/services',
  () => ({
    getFrameworkDetector: () => ({
      getFramework: () => ({ framework: 'generic', detected: true }),
    }),
  })
);

const provider = new MDXCompletionProvider();
const token = {} as CancellationToken;
const completionContext = {} as any;

describe('MDXCompletionProvider', () => {
  describe('jsx-tag context', () => {
    it('returns component completions after < character', () => {
      const doc = createMockDocument('# Hello\n\n<');
      const position = new Position(2, 1);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      expect(items!.length).toBeGreaterThan(0);
    });

    it('includes all 5 generic components', () => {
      const doc = createMockDocument('<');
      const position = new Position(0, 1);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('Callout');
      expect(labels).toContain('Tabs');
      expect(labels).toContain('TabItem');
      expect(labels).toContain('Collapsible');
      expect(labels).toContain('CodeGroup');
    });

    it('component completions include SnippetString insertText', () => {
      const doc = createMockDocument('<');
      const position = new Position(0, 1);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      const callout = items!.find((i) => i.label === 'Callout');
      expect(callout).toBeDefined();
      expect(callout!.insertText).toBeInstanceOf(SnippetString);
      expect(callout!.kind).toBe(CompletionItemKind.Class);
    });

    it('returns completions w/ partial component name', () => {
      const doc = createMockDocument('<Cal');
      const position = new Position(0, 4);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      expect(items!.length).toBeGreaterThan(0);
    });
  });

  describe('directive context', () => {
    it('returns directive completions after :::', () => {
      const doc = createMockDocument(':::');
      const position = new Position(0, 3);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      expect(items!.length).toBeGreaterThanOrEqual(7);
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('note');
      expect(labels).toContain('warning');
      expect(labels).toContain('tip');
    });

    it('directive completions include closing :::', () => {
      const doc = createMockDocument(':::');
      const position = new Position(0, 3);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      const note = items!.find((i) => i.label === 'note');
      expect(note).toBeDefined();
      expect(note!.insertText).toBeInstanceOf(SnippetString);
      expect((note!.insertText as SnippetString).value).toContain(':::');
      expect(note!.kind).toBe(CompletionItemKind.Snippet);
    });
  });

  describe('github-alert context', () => {
    it('returns GitHub alert completions after > [!', () => {
      const doc = createMockDocument('> [!');
      const position = new Position(0, 4);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      expect(items!.length).toBe(5);
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('NOTE');
      expect(labels).toContain('TIP');
      expect(labels).toContain('WARNING');
      expect(labels).toContain('CAUTION');
      expect(labels).toContain('IMPORTANT');
    });
  });

  describe('frontmatter context', () => {
    it('returns frontmatter completions inside --- block', () => {
      const doc = createMockDocument('---\n\n---\n');
      const position = new Position(1, 0);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      expect(items!.length).toBeGreaterThan(0);
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('title');
      expect(labels).toContain('description');

      const incompleteDoc = createMockDocument('---\ntitle: ');
      const incompleteItems = provider.provideCompletionItems(
        incompleteDoc,
        new Position(1, 0),
        token,
        completionContext
      );
      expect(incompleteItems).toBeDefined();
      expect(incompleteItems!.map((i) => i.label)).toContain('title');

      expect(
        provider.provideCompletionItems(
          doc,
          new Position(0, 0),
          token,
          completionContext
        )
      ).toBeUndefined();
      expect(
        provider.provideCompletionItems(
          doc,
          new Position(2, 0),
          token,
          completionContext
        )
      ).toBeUndefined();
    });

    it('frontmatter completions use Property kind', () => {
      const doc = createMockDocument('---\n\n---\n');
      const position = new Position(1, 0);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeDefined();
      const title = items!.find((i) => i.label === 'title');
      expect(title).toBeDefined();
      expect(title!.kind).toBe(CompletionItemKind.Property);
    });
  });

  describe('no context', () => {
    it('returns undefined for plain text context', () => {
      const doc = createMockDocument('Hello world');
      const position = new Position(0, 5);
      const items = provider.provideCompletionItems(
        doc,
        position,
        token,
        completionContext
      );

      expect(items).toBeUndefined();
    });
  });
});
