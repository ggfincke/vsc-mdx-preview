// tests/extension/diagnostics/ComponentDetector.test.ts
// unit tests for component detection

import { describe, it, expect, afterEach } from 'vitest';
import {
  detectComponents,
  getUnknownComponents,
  getUsedGenericComponents,
  clearComponentCache,
} from '../../../packages/extension/diagnostics/ComponentDetector';

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
});
