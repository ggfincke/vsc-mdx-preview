# @mdx-tools/compiler

Dual-mode MDX compiler with safe HTML output and trusted JS output.

## Install

```bash
npm install @mdx-tools/compiler @mdx-js/mdx unified
```

## Quick Start

```ts
import { compileSafe } from '@mdx-tools/compiler';

const result = await compileSafe('# Hello', {
  documentPath: '/docs/example.mdx',
  documentDir: '/docs',
  unknownBehavior: 'placeholder'
});
```

## Security Model

`compileSafe` strips script tags and inline event handlers but is not a full HTML sanitizer.

## Limitations

- Consumer is responsible for trust policy and plugin loading.
- `@mdx-js/mdx` and `unified` are peer dependencies.
- Safe mode output should still be sanitized for untrusted user input.

## License

MIT