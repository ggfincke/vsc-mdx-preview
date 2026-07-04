// tests/extension/diagnostics/ComponentDetector.test.ts
// unit tests for component detection

import { describe, it, expect, afterEach } from 'vitest';
import {
  detectComponents,
  getUnknownComponents,
  getUsedGenericComponents,
  clearComponentCache,
} from '../../../packages/extension-host/src/features/diagnostics/ComponentDetector';

const mdxSample = `
import { Foo } from './Foo';

# Title

<Callout>hello</Callout>
<Alert>note</Alert>
<Accordion>details</Accordion>
<CustomComponent />
<Foo />
`;

afterEach(() => {
  clearComponentCache();
});

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

  it('treats default plus named imports as known', async () => {
    const result = await detectComponents(
      "import Foo, { Bar } from './widgets';\n\n<Foo />\n<Bar />\n",
      { detectImports: true, includePositions: false },
      new Set()
    );

    const unknown = getUnknownComponents(result).map((c) => c.name);
    expect(unknown).toEqual([]);
  });

  it('includePositions returns the correct range for a known-line component', async () => {
    const result = await detectComponents(
      mdxSample,
      { detectImports: true, includePositions: true },
      new Set()
    );

    const custom = result.components.find((c) => c.name === 'CustomComponent');
    expect(custom).toBeDefined();
    expect(custom?.range.start.line).toBe(8);
    expect(custom?.range.start.character).toBe(0);
    expect(custom?.range.end.line).toBe(8);
    expect(custom?.range.end.character).toBe(19);
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

  it('reclassifies cached components for each framework', async () => {
    const source = '<CodeBlock>code</CodeBlock>\n';
    const uri = 'file:///workspace/doc.mdx';

    const docusaurus = await detectComponents(
      source,
      {
        detectImports: false,
        includePositions: false,
        framework: 'docusaurus',
      },
      new Set(),
      uri
    );
    const generic = await detectComponents(
      source,
      { detectImports: false, includePositions: false, framework: 'generic' },
      new Set(),
      uri
    );

    expect(getUnknownComponents(docusaurus).map((c) => c.name)).toEqual([]);
    expect(getUnknownComponents(generic).map((c) => c.name)).toEqual([
      'CodeBlock',
    ]);
  });
});
