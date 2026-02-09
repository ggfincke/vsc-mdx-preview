# @mdx-tools/browser-modules

Browser-side module loading runtime with fetcher-driven resolution.

## Install

```bash
npm install @mdx-tools/browser-modules
```

## Quick Start

```ts
import { createModuleRuntime } from '@mdx-tools/browser-modules';
```

## Security Model

This package evaluates module code with `new Function()`. Consumers must enforce trust boundaries and CSP policy.

## Limitations

- Requires `unsafe-eval` for JS evaluation.
- Caller owns fetch trust validation and path normalization.
- CSP style policy depends on consumer style injection strategy.

## License

MIT