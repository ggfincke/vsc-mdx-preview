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

Allowed files:

- `tests/security/*.test.ts`
- `tests/compilation/safe-compile.test.ts`
- `tests/compilation/trusted-compile.test.ts`
- `tests/transpilation/babel.test.ts`
- `tests/resolution/alias-resolver.test.ts`
- `tests/resolution/unified-resolver.test.ts`
- `tests/services/ServiceRegistry.circular.test.ts`
- `tests/services/ServiceRegistry.subsystem.test.ts`
- `tests/shared/constant-parity.test.ts`
- `tests/shared/metadata-parity.test.ts`
- `tests/extension/activate.unhandled-rejection.test.ts`
- `tests/extension/commands/security.test.ts`
- `tests/extension/compiler/plugin-loader.test.ts`
- `tests/extension/config/CompilerConfig.test.ts`
- `tests/extension/config/ConfigResolver.test.ts`
- `tests/extension/config/TypeScriptConfigResolver.test.ts`
- `tests/extension/deps/import-extractor.test.ts`
- `tests/extension/diagnostics/ComponentCodeActions.test.ts`
- `tests/extension/diagnostics/ComponentDetector.test.ts`
- `tests/extension/errors/ErrorReporter.test.ts`
- `tests/extension/framework/FrameworkDetector.test.ts`
- `tests/extension/handlers/*.test.ts`
- `tests/extension/module-system/fetchLocal.timeout.test.ts`
- `tests/extension/nextra/MetaResolver.test.ts`
- `tests/extension/preview/EvaluationEngine.timeout.test.ts`
- `tests/extension/preview/PreviewInitializer.test.ts`
- `tests/extension/preview/PreviewManager.test.ts`
- `tests/extension/preview/PreviewWebviewBridge.test.ts`
- `tests/extension/preview/evaluate-in-webview.test.ts`
- `tests/extension/preview/preview-update-flow.test.ts`
- `tests/extension/rpc-input-validation.test.ts`
- `tests/extension/security/checkFsPath.test.ts`
- `tests/extension/tailwind/TailwindProcessor.test.ts`
- `tests/extension/workspace-events.test.ts`
- `tests/webview/App.test.ts`
- `tests/webview/ModuleRegistry.test.ts`
- `tests/webview/SafePreview.test.ts`
- `tests/webview/StyleInjector.test.ts`
- `tests/webview/TrustedPreview.test.ts`
- `tests/webview/module-system-loader.test.ts`
- `tests/webview/preload-atomic-registration.test.ts`
- `tests/webview/safe-mode-processing.test.ts`
- `tests/webview/shimLoader.test.ts`
- `tests/webview/webview-rpc-client.test.ts`

Everything else under `tests/` is out of policy and should be deleted.

## Case-Count Caps

Retained suites must stay representative. `scripts/check-test-philosophy.mjs` enforces active `it(...)` caps:

- Default maximum: `4`
- `tests/security/*.test.ts`: `6`
- `tests/resolution/unified-resolver.test.ts`: `6`
- `tests/extension/errors/ErrorReporter.test.ts`: `6`
- `tests/extension/rpc-input-validation.test.ts`: `6`
- `tests/webview/SafePreview.test.ts`: `6`

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
