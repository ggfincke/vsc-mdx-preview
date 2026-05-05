// tests/webview/preload-generation.test.ts
// generated preload source regression coverage

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('preload generation', () => {
  it('keeps generic shim loaders on static imports', async () => {
    const source = await readFile(
      new URL(
        '../../packages/webview-client/src/generated/preload/preload.generated.ts',
        import.meta.url
      ),
      'utf8'
    );

    expect(source).not.toContain("import('mdx-forge/components/generic')");
  });
});
