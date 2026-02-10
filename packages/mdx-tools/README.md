# mdx-tools

`mdx-tools` is a unified MDX runtime toolkit with three domain exports:

- `mdx-tools/compiler` for safe and trusted MDX compilation
- `mdx-tools/browser` for browser-side module loading/evaluation
- `mdx-tools/components` for framework shim components and CSS

## Install

```bash
npm install mdx-tools
```

Peer dependencies:

- `react >= 18` for `components`
- `unified` and `@mdx-js/mdx` for `compiler`

## Quick Start

```ts
import { compileSafe } from 'mdx-tools/compiler';

const result = await compileSafe('# Hello', {
  logger: { debug() {}, warn() {}, error() {} },
});

console.log(result.html);
```

## Subpath Exports

- `mdx-tools/compiler`
- `mdx-tools/compiler/plugins`
- `mdx-tools/compiler/transforms`
- `mdx-tools/browser`
- `mdx-tools/browser/registry`
- `mdx-tools/components`
- `mdx-tools/components/generic`
- `mdx-tools/components/docusaurus`
- `mdx-tools/components/starlight`
- `mdx-tools/components/nextra`
- `mdx-tools/components/nextjs`
- `mdx-tools/components/registry`
- `mdx-tools/components/styles/*.css`

## Security Model

- `mdx-tools/browser` evaluates code via `new Function()`.
- Consumers must allow `unsafe-eval` in CSP for `mdx-tools/browser`.
- Runtime style injection may require `style-src 'unsafe-inline'` or a nonce-aware strategy.
- The library does not validate trust boundaries for fetched code; host code must enforce trust.
- `compileSafe` is a compilation mode, not a full sanitization layer.

## Limitations

- Browser-domain runtime assumes a browser environment.
- Component domain requires matching CSS imports.
- Trusted mode compilation/execution is not suitable for untrusted code without additional controls.

## License

MIT. See `LICENSE`.
