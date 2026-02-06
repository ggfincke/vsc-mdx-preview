# Tests

This directory contains the test suite for MDX Preview.

## Philosophy

**Only major, important tests - not exhaustive coverage.**

We focus on testing critical paths that, if broken, would cause significant user impact:

- **Security & Trust**: TrustManager, CSP generation, path validation
- **Compilation Pipeline**: MDX to JS (trusted) and MDX to HTML (safe)
- **Module Resolution**: Import resolution strategies, framework aliases
- **Extension Core**: Framework detection, file handlers, diagnostics
- **Webview Core**: Module registry, style injection, shim loading

We intentionally do not test:

- Every edge case or configuration combination
- UI components in isolation (unless they enforce a security boundary)
- Utility functions with obvious behavior
- Performance characteristics of utilities
- Integration points that require full VS Code runtime

## Enforcement Checklist

Before adding or expanding a suite, verify:

1. The test targets a production-critical boundary (security, compile, resolve, fetch/eval, or webview runtime)
2. The behavior is externally visible or contract-level (not an internal helper detail)
3. The case is representative, not a combinatorial variant of an already-covered behavior
4. The assertion does not depend on timing/performance thresholds
5. The same failure mode is not already covered at a higher level

If any check fails, do not add the test.

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Structure

```
tests/
├── helpers/            # Test utilities & fixtures
├── security/           # TrustManager, CSP, path validation
├── compilation/        # MDX compilation (trusted/safe modes)
├── transpilation/      # Babel transforms
├── resolution/         # Module resolution strategies
├── integration/        # End-to-end compilation & preview flow
├── shared/             # Shared utility tests (LRU cache, registry queries)
├── extension/          # Extension-specific critical paths
│   ├── commands/       # Security & config-info commands
│   ├── compiler/       # Plugin loading
│   ├── config/         # Effective/compiler config projection
│   ├── deps/           # Import extraction
│   ├── diagnostics/    # Component detection & code actions
│   ├── errors/         # Error reporter lifecycle
│   ├── framework/      # Framework detection
│   ├── handlers/       # File type handlers (CSS, Sass, JSON, images)
│   ├── module-system/  # Module fetch flow
│   ├── nextra/         # Nextra meta resolution
│   ├── prewarm/        # Babel prewarm coordination
│   ├── preview/        # Preview lifecycle & watchers
│   ├── security/       # Path security (checkFsPath)
│   └── tailwind/       # Tailwind detection & processing
├── webview/            # Webview critical paths
│   ├── ModuleRegistry  # Module caching & dependencies
│   ├── StyleInjector   # CSS injection
│   └── shimLoader      # Framework shim loading
└── services/           # Service registry lifecycle & circular detection
```

## Adding Tests

Before adding a new test, ask:

1. Does this test a critical path that would break the extension if it failed?
2. Is this behavior not already covered by existing tests?
3. Can this be tested without mocking the entire VS Code API?
4. Is this a major architectural concern, not a utility edge case?

If yes to all four, add the test. Otherwise, consider whether it's truly necessary.
