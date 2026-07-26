// tests/extension/diagnostics/ComponentDetector.test.ts
// unit tests for component detection

import type * as vscode from 'vscode';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const { parseSpy } = vi.hoisted(() => ({
  parseSpy: vi.fn(),
}));

vi.mock('unified', async (importOriginal) => {
  const actual = await importOriginal<typeof import('unified')>();
  return {
    ...actual,
    unified: () => {
      const processor = actual.unified();
      const parse = processor.parse.bind(processor);
      processor.parse = ((...args: Parameters<typeof parse>) => {
        parseSpy();
        return parse(...args);
      }) as typeof processor.parse;
      return processor;
    },
  };
});

import {
  detectComponents,
  getUnknownComponents,
  getUsedGenericComponents,
  clearComponentCache,
} from '../../../packages/extension-host/src/features/diagnostics/ComponentDetector';
import { extractMDXSymbols } from '../../../packages/extension-host/src/features/language/MDXSymbolProvider';
import { clearMdxAnalysisCache } from '../../../packages/extension-host/src/shared/mdx-analysis/document-analysis';
import { createMockDocument } from '../../helpers/mock-document';
import { Range } from 'vscode';

const mdxSample = `
import { Foo } from './Foo';

# Title

<Callout>hello</Callout>
<Alert>note</Alert>
<Accordion>details</Accordion>
<CustomComponent />
<Foo />
`;

beforeEach(() => {
  parseSpy.mockClear();
});

afterEach(() => {
  clearComponentCache();
  clearMdxAnalysisCache();
});

function createVersionedDocument(
  content: string,
  fsPath: string,
  version: number
): vscode.TextDocument {
  return createMockDocument(content, {
    fsPath,
    version,
  }) as vscode.TextDocument;
}

describe('detectComponents', () => {
  it('identifies unknown components', async () => {
    const result = await detectComponents(
      mdxSample,
      { detectImports: true, includePositions: false },
      new Set()
    );

    const unknown = getUnknownComponents(result).map((c) => c.name);
    expect(unknown).toEqual(['CustomComponent']);
  });

  it('resolves generic component aliases to canonical names', async () => {
    const result = await detectComponents(
      mdxSample,
      { detectImports: true, includePositions: false },
      new Set()
    );

    const used = getUsedGenericComponents(result);
    expect(used).toEqual(expect.arrayContaining(['Callout', 'Collapsible']));
  });

  it('treats config components as known', async () => {
    const result = await detectComponents(
      '<ConfigComponent />',
      { detectImports: false, includePositions: false },
      new Set(['ConfigComponent'])
    );

    const unknown = getUnknownComponents(result).map((c) => c.name);
    expect(unknown).toEqual([]);
  });

  it('treats imports & member-expression roots as known components', async () => {
    const result = await detectComponents(
      "import Foo, { Bar } from './widgets';\nimport * as Tabs from './tabs';\n\n<Foo />\n<Bar />\n<Tabs.Tab />\n<Table />\n",
      { detectImports: true, includePositions: false },
      new Set()
    );

    const unknown = getUnknownComponents(result).map((c) => c.name);
    expect(unknown).not.toEqual(
      expect.arrayContaining(['Foo', 'Bar', 'Tabs.Tab'])
    );
    expect(result.components.map((component) => component.name)).toEqual([
      'Foo',
      'Bar',
      'Tabs.Tab',
      'Table',
    ]);
    expect(
      result.components.find((component) => component.name === 'Tabs.Tab')
    ).toMatchObject({ source: 'import' });
  });

  it('returns only tag-name ranges for paired & self-closing elements', async () => {
    const result = await detectComponents(
      mdxSample,
      { detectImports: true, includePositions: true },
      new Set()
    );

    const custom = result.components.find((c) => c.name === 'CustomComponent');
    expect(custom).toBeDefined();
    expect(custom?.range.start.line).toBe(8);
    expect(custom?.range.start.character).toBe(1);
    expect(custom?.range.end.line).toBe(8);
    expect(custom?.range.end.character).toBe(16);
    expect(custom?.tagNameRanges).toEqual([new Range(8, 1, 8, 16)]);

    const paired = await detectComponents(
      '<Frobnicate>\nimportant children\n</Frobnicate>\n<Widget />\n',
      { detectImports: false, includePositions: true },
      new Set()
    );

    expect(paired.components[0].tagNameRanges).toEqual([
      new Range(0, 1, 0, 11),
      new Range(2, 2, 2, 12),
    ]);
    expect(paired.components[1].tagNameRanges).toEqual([new Range(3, 1, 3, 7)]);
  });
});

describe('framework-aware classification', () => {
  // CodeBlock is a docusaurus-only component & not a generic builtin
  it('treats a framework-only component as known under its framework', async () => {
    const result = await detectComponents(
      '<CodeBlock>code</CodeBlock>\n',
      {
        detectImports: false,
        includePositions: false,
        framework: 'docusaurus',
      },
      new Set()
    );
    expect(getUnknownComponents(result).map((c) => c.name)).toEqual([]);
  });

  it('flags the same component as unknown under a generic document', async () => {
    const result = await detectComponents(
      '<CodeBlock>code</CodeBlock>\n',
      { detectImports: false, includePositions: false },
      new Set()
    );
    expect(getUnknownComponents(result).map((c) => c.name)).toEqual([
      'CodeBlock',
    ]);
  });
});

describe('frontmatter safety & positions', () => {
  it('does not evaluate ---js frontmatter on the detection path (D6 / CWE-94)', async () => {
    const probe = globalThis as Record<string, unknown>;
    const KEY = '__mdxPreviewDetectorPwned';
    probe[KEY] = undefined;
    await detectComponents(
      `---js\n((globalThis['${KEY}'] = true), {})\n---\n<Frobnicate />\n`,
      { detectImports: false, includePositions: true },
      new Set()
    );
    expect(probe[KEY]).toBeUndefined();
  });

  it('lands the squiggle on the correct line past empty frontmatter', async () => {
    const result = await detectComponents(
      '---\n---\n<Frobnicate />\n',
      { detectImports: false, includePositions: true },
      new Set()
    );
    const found = result.components.find((c) => c.name === 'Frobnicate');
    // <Frobnicate /> is on 0-based line 2 (original line 3)
    expect(found?.range.start.line).toBe(2);
  });

  it('does not offset a BOM-only document as frontmatter', async () => {
    const result = await detectComponents(
      '\uFEFFintro\n\n---\n\n<Frobnicate />\n',
      { detectImports: false, includePositions: true },
      new Set()
    );
    const found = result.components.find((c) => c.name === 'Frobnicate');
    expect(found?.range.start.line).toBe(4);
  });

  it('reuses exact versions while reclassifying & invalidating safely', async () => {
    const source = '# Heading\n\n<CodeBlock />\n<Configured />\n';
    const uri = 'file:///workspace/doc.mdx';
    const identity = { uri, version: 1 };
    const document = createVersionedDocument(source, '/workspace/doc.mdx', 1);

    const docusaurus = await detectComponents(
      source,
      {
        detectImports: false,
        includePositions: false,
        framework: 'docusaurus',
      },
      new Set(),
      identity
    );
    const genericConfigured = await detectComponents(
      source,
      { detectImports: false, includePositions: false, framework: 'generic' },
      new Set(['Configured']),
      identity
    );
    extractMDXSymbols(document);

    expect(getUnknownComponents(docusaurus).map((c) => c.name)).toEqual([
      'Configured',
    ]);
    expect(getUnknownComponents(genericConfigured).map((c) => c.name)).toEqual([
      'CodeBlock',
    ]);
    expect(parseSpy).toHaveBeenCalledTimes(1);

    const changed = await detectComponents('<Changed />', {}, new Set(), {
      uri,
      version: 2,
    });
    const otherIdentity = {
      uri: 'file:///workspace/other.mdx',
      version: 2,
    };
    const other = await detectComponents(
      '<Other />',
      {},
      new Set(),
      otherIdentity
    );

    expect(changed.components.map(({ name }) => name)).toEqual(['Changed']);
    expect(other.components.map(({ name }) => name)).toEqual(['Other']);
    expect(parseSpy).toHaveBeenCalledTimes(3);

    clearComponentCache();
    clearMdxAnalysisCache();
    await detectComponents('<Other />', {}, new Set(), otherIdentity);
    expect(parseSpy).toHaveBeenCalledTimes(4);
  });
});
