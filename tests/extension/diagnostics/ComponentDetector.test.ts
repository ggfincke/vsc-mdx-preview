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
