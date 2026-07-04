// tests/shared/diagnostics-parity.test.ts
// verify diagnostics contract & classification align across vsc-mdx-preview & mdx-forge
// ! cross-repo parity: mirror mdx-forge/tests/cross-repo/diagnostics-parity.test.ts

import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC_CODES } from '../../packages/extension-host/src/features/diagnostics/ComponentDiagnostics';
import {
  classifyComponentSource,
  type ClassifyContext,
} from 'mdx-forge/diagnostics/analyze';

const EMPTY: Pick<ClassifyContext, 'imports' | 'configComponents'> = {
  imports: new Set<string>(),
  configComponents: new Set<string>(),
};

describe('cross-repo diagnostics parity', () => {
  it('pins the extension code re-export to MDXF001', () => {
    expect(DIAGNOSTIC_CODES.UNKNOWN_COMPONENT).toBe('MDXF001');
  });

  it('classifies the same inputs to the same component source', () => {
    expect(
      classifyComponentSource('Foo', {
        ...EMPTY,
        imports: new Set(['Foo']),
        framework: 'generic',
      })
    ).toBe('import');
    expect(
      classifyComponentSource('Widget', {
        ...EMPTY,
        configComponents: new Set(['Widget']),
        framework: 'generic',
      })
    ).toBe('config');
    expect(
      classifyComponentSource('Callout', { ...EMPTY, framework: 'generic' })
    ).toBe('builtin');
    expect(
      classifyComponentSource('Alert', { ...EMPTY, framework: 'generic' })
    ).toBe('builtin');
    expect(
      classifyComponentSource('CodeBlock', {
        ...EMPTY,
        framework: 'docusaurus',
      })
    ).toBe('framework');
    expect(
      classifyComponentSource('CodeBlock', { ...EMPTY, framework: 'generic' })
    ).toBe('unknown');
    expect(
      classifyComponentSource('Frobnicate', { ...EMPTY, framework: 'generic' })
    ).toBe('unknown');
  });
});
