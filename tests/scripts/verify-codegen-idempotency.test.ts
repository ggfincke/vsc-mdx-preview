// tests/scripts/verify-codegen-idempotency.test.ts
// verify codegen idempotency test coverage
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve(
  process.cwd(),
  'scripts/verify-codegen-idempotency.mjs'
);

describe('verify-codegen-idempotency', () => {
  it('passes when generated files are up to date', () => {
    // generators already ran in pretest, so committed files should match
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('idempotency check passed');
    expect(result.stdout).toContain('9');
  });
});
