# Tests

This directory is reserved for the production-critical test suite that runs under `npm test`.

## Philosophy

**Only major, important tests - not exhaustive coverage**

`tests/` covers critical boundaries that would break the extension in user-visible ways:

- Security & trust boundaries
- MDX compilation entry points
- Module resolution selection
- Extension-host fetch/eval lifecycle boundaries
- Webview runtime security & module loading boundaries
- Cross-repo contract parity for shared exported metadata/constants

Non-critical tests are removed instead of moved into a second suite. There is no opt-in overflow suite for utility, UI, watcher, or dev-script coverage.

The following do **not** belong in `tests/`:

- Internal helper or cache implementation details
- UI components tested in isolation when they do not enforce a security boundary
- Utility functions w/ obvious local behavior
- Watcher-specific lifecycle minutiae
- Dev-script tests for commands already executed directly in guardrails
- Combinatorial matrix variants of a covered production contract

## Enforced Scope

`scripts/check-test-philosophy.mjs` is the source of truth for the allowed `tests/**/*.test.ts` files.

The allowlist lives in that script's `EXACT_ALLOWED` set plus its prefix rules (`tests/security/*.test.ts`, `tests/extension/handlers/*.test.ts`); `npm run check:test-philosophy` enforces it. This doc intentionally does not duplicate the list — read the script to avoid drift.

Everything else under `tests/` is out of policy and should be deleted.

## Case-Count Caps

Retained suites must stay representative. `scripts/check-test-philosophy.mjs` enforces active `it(...)` caps: a default maximum of `4`, `6` for `tests/security/*.test.ts`, and per-file overrides in its `CASE_COUNT_OVERRIDES` map. See the script for current values.

If a suite needs more than its cap, the test is too granular for `tests/`.

Do not keep out-of-policy coverage as `it.skip(...)` or `describe.skip(...)`. Remove it.

## Running Tests

```bash
# Run the production-critical suite
npm test

# Run the test philosophy guardrail directly
npm run check:test-philosophy

# Watch mode
npm run test:watch
```

## Adding Or Expanding Tests

Before adding or expanding a suite, verify:

1. The test targets a production-critical boundary
2. The behavior is externally visible or contract-level
3. The case is representative, not a combinatorial variant
4. The same failure mode is not already covered at a higher level
5. The suite will remain within the enforced `it(...)` cap

If any check fails, do not add the test.
