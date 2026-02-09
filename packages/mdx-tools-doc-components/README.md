# @mdx-tools/doc-components

Standalone React component shims for MDX documentation frameworks.

## Install

```bash
npm install @mdx-tools/doc-components react
```

## Quick Start

```tsx
import { Tabs, TabItem } from '@mdx-tools/doc-components/docusaurus';
import '@mdx-tools/doc-components/styles/docusaurus.css';
```

## Registry Metadata

Use `@mdx-tools/doc-components/registry` for side-effect-free metadata.

## Security Model

This package renders React components only. It does not execute untrusted code or enforce sandboxing.

## Limitations

- React 18+ required.
- Browser-first components; SSR requires consumer-side guards.
- CSS files must be imported for expected visual output.

## License

MIT