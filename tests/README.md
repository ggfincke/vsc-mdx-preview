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
- UI components in isolation
- Utility functions with obvious behavior
- Performance characteristics of utilities
- Integration points that require full VS Code runtime

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
├── helpers/          # Test utilities & fixtures
├── security/         # TrustManager, CSP, path validation
├── compilation/      # MDX compilation (trusted/safe modes)
├── transpilation/    # Babel transforms
├── resolution/       # Module resolution strategies
├── extension/        # Extension-specific critical paths
│   ├── diagnostics/  # Component detection & code actions
│   ├── framework/    # Framework detection
│   ├── handlers/     # File type handlers (CSS, Sass, JSON, images)
│   ├── nextra/       # Nextra meta resolution
│   ├── preview/      # Preview lifecycle
│   ├── security/     # Path security (checkFsPath)
│   └── tailwind/     # Tailwind detection & processing
├── webview/          # Webview critical paths
│   ├── ModuleRegistry # Module caching & dependencies
│   ├── StyleInjector  # CSS injection
│   └── shimLoader     # Framework shim loading
└── services/         # Service registry lifecycle
```

## Adding Tests

Before adding a new test, ask:

1. Does this test a critical path that would break the extension if it failed?
2. Is this behavior not already covered by existing tests?
3. Can this be tested without mocking the entire VS Code API?
4. Is this a major architectural concern, not a utility edge case?

If yes to all four, add the test. Otherwise, consider whether it's truly necessary.
