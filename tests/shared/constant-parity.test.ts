// tests/shared/constant-parity.test.ts
// verify cross-repo constant alignment between mdx-forge & contracts
// prevent runtime behavior drift (Finding F5)

import { describe, it, expect } from 'vitest';
import {
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from '@mdx-preview/contracts';

describe('cross-repo constant parity', () => {
  it('contracts shim retry constants have expected canonical values', () => {
    // these are the canonical values both mdx-forge & vsc-mdx-preview must use
    // mdx-forge's own tests verify its constants match these values
    // see: mdx-forge/tests/browser/constants-contract.test.ts
    expect(SHIM_LOAD_MAX_RETRIES).toBe(3);
    expect(SHIM_LOAD_RETRY_DELAY_MS).toBe(200);
  });
});
