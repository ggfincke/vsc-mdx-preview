// tests/shared/constant-parity.test.ts
// verify cross-repo constant alignment & theme label completeness
// prevent runtime behavior drift (Finding F5) & settings governance drift (Finding F14)

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
