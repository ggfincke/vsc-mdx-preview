// tests/shared/constant-parity.test.ts
// verify cross-repo constant alignment & theme label completeness
// prevent runtime behavior drift (Finding F5) & settings governance drift (Finding F14)
// prevent preloaded module ID drift (Finding 15) & framework union drift (Finding 15)

import { describe, it, expect } from 'vitest';
import {
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
  PRELOADED_MODULE_IDS,
  FRAMEWORK_IDS,
} from '@mdx-preview/contracts';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../packages/webview-client/src/app/constants';

describe('cross-repo constant parity', () => {
  it('contracts shim retry constants have expected canonical values', () => {
    // these are the canonical values both mdx-forge & vsc-mdx-preview must use
    // mdx-forge's own tests verify its constants match these values
    // see: mdx-forge/tests/browser/constants-contract.test.ts
    expect(SHIM_LOAD_MAX_RETRIES).toBe(3);
    expect(SHIM_LOAD_RETRY_DELAY_MS).toBe(200);
  });

  it('code copy feedback duration matches mdx-forge canonical value', () => {
    // must match: mdx-forge/src/components/internal/constants.ts
    // see: mdx-forge/tests/components/constants-contract.test.ts
    expect(CODE_COPY_FEEDBACK_DURATION_MS).toBe(2000);
  });
});

describe('preloaded module ID parity (Finding 15)', () => {
  // ! cross-repo parity: mdx-forge/src/browser/types.ts declares its own PRELOADED_MODULE_IDS
  // these canonical values must stay in sync across both repos

  it('PRELOADED_MODULE_IDS keys match expected canonical set', () => {
    const expectedKeys = [
      'react',
      'reactDom',
      'reactDomClient',
      'jsxRuntime',
      'mdxReact',
      'vscodeLayout',
    ];
    expect(Object.keys(PRELOADED_MODULE_IDS).sort()).toEqual(
      expectedKeys.sort()
    );
  });

  it('PRELOADED_MODULE_IDS values match mdx-forge canonical values', () => {
    // these exact strings are declared in mdx-forge/src/browser/types.ts
    // if mdx-forge changes these, this test must be updated
    expect(PRELOADED_MODULE_IDS.react).toBe('npm://react@18');
    expect(PRELOADED_MODULE_IDS.reactDom).toBe('npm://react-dom@18');
    expect(PRELOADED_MODULE_IDS.reactDomClient).toBe(
      'npm://react-dom/client@18'
    );
    expect(PRELOADED_MODULE_IDS.jsxRuntime).toBe(
      'npm://react/jsx-runtime@18'
    );
    expect(PRELOADED_MODULE_IDS.mdxReact).toBe('npm://@mdx-js/react@3');
    expect(PRELOADED_MODULE_IDS.vscodeLayout).toBe(
      'npm://vscode-markdown-layout@0.1.0'
    );
  });
});

describe('framework union parity (Finding 15)', () => {
  // ! cross-repo parity: mdx-forge/src/browser/types.ts & mdx-forge/src/components/registry/types.ts
  // declare their own Framework/FrameworkId unions

  it('FRAMEWORK_IDS matches expected canonical set', () => {
    const expected = ['generic', 'docusaurus', 'nextjs', 'starlight', 'nextra'];
    expect([...FRAMEWORK_IDS].sort()).toEqual(expected.sort());
  });
});

describe('theme label completeness', () => {
  it('PREVIEW_THEME_LABELS keys match PREVIEW_THEMES', () => {
    expect(Object.keys(PREVIEW_THEME_LABELS).sort()).toEqual(
      [...PREVIEW_THEMES].sort()
    );
  });

  it('CODE_BLOCK_THEME_LABELS keys match CODE_BLOCK_THEMES', () => {
    expect(Object.keys(CODE_BLOCK_THEME_LABELS).sort()).toEqual(
      [...CODE_BLOCK_THEMES].sort()
    );
  });

});
