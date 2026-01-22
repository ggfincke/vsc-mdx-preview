# Tests

This directory contains the test suite for MDX Preview.

## Philosophy

**Only major, important tests - not exhaustive coverage.**

We focus on testing critical paths that, if broken, would cause significant user impact:

- **Security & Trust**: TrustManager, CSP generation, path validation
- **Compilation Pipeline**: MDX to JS (trusted) and MDX to HTML (safe)
- **Module Resolution**: Import resolution strategies, framework aliases

We intentionally do not test:

- Every edge case or configuration combination
- UI components in isolation
- Utility functions with obvious behavior
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
├── helpers/          # Test utilities and fixtures
├── security/         # TrustManager, CSP, path validation
├── compilation/      # MDX compilation (trusted/safe modes)
├── transpilation/    # Babel transforms
└── resolution/       # Module resolution strategies
```

## Adding Tests

Before adding a new test, ask:

1. Does this test a critical path that would break the extension if it failed?
2. Is this behavior not already covered by existing tests?
3. Can this be tested without mocking the entire VS Code API?

If yes to all three, add the test. Otherwise, consider whether it's truly necessary.
