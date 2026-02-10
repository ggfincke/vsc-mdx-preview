import { describe, expect, it } from 'vitest';
import { compileSafe, type CompilerConfig } from 'mdx-tools/compiler';

const BASE_CONFIG: CompilerConfig = {
  documentPath: '/workspace/docs/example.mdx',
  componentsUnknownBehavior: 'placeholder',
  componentsBuiltins: true,
};

describe('compileSafe determinism', () => {
  it('produces stable output when componentNameResolver is omitted', async () => {
    const mdx = '<CustomWidget />';

    const first = await compileSafe(mdx, BASE_CONFIG);
    const second = await compileSafe(mdx, BASE_CONFIG);

    expect(first.html).toBe(second.html);
    expect(first.html).toContain('CustomWidget');
  });

  it('changes placeholder labels only when componentNameResolver is provided', async () => {
    const mdx = '<CustomWidget />';

    const withoutResolver = await compileSafe(mdx, BASE_CONFIG);
    const withResolver = await compileSafe(mdx, {
      ...BASE_CONFIG,
      componentNameResolver: (name) =>
        name === 'CustomWidget' ? 'ResolvedWidget' : undefined,
    });

    expect(withResolver.html).toContain('ResolvedWidget');
    expect(withoutResolver.html).toContain('CustomWidget');
    expect(withResolver.html).not.toBe(withoutResolver.html);
  });
});
