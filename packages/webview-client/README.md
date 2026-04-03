# MDX Preview Webview Client

This package is the React 19 application that renders preview content inside the VS Code webview.

## Commands

The package-level scripts are intentionally small:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
```

Package tests are driven from the workspace root via `npm run test:webview` and `npm run test:all`.

## Architecture

### Rendering Modes

- Safe Mode renders HTML pushed from the extension host and sanitizes it in the webview
- Trusted Mode evaluates transpiled modules fetched over RPC and renders the resulting React tree

### Important Directories

```text
src/
├── entry/               # Webview bootstrap
├── app/                 # App shell, providers, state, root styles
├── features/
│   ├── preview/         # Safe and Trusted preview rendering
│   ├── module-runtime/  # Browser-side module loading and cache bridge
│   ├── diagrams/        # Mermaid, PlantUML, Graphviz
│   ├── code-block/      # Code block enhancement and KaTeX helpers
│   ├── lightbox/        # Fullscreen image viewer
│   └── theme/           # Theme data and runtime logic
├── generated/           # Generated preload and shim barrel files
├── platform/rpc/        # Webview RPC client and handler factory
└── shared/              # Shared hooks, UI, utilities
```

### RPC Surface

The extension pushes preview state into the webview over RPC:

- preview content and trust state
- theme and runtime-UI settings
- Tailwind CSS and used-component metadata
- module fetch requests and error reporting

### Preview UI State

The webview owns several UI-only concerns that do not live in VS Code settings:

- preview zoom persistence
- lightbox gallery state
- loading and stale indicators
- Safe/Trusted mode presentation

## Related Docs

- [`../../docs/architecture.mdx`](../../docs/architecture.mdx)
- [`src/features/theme/data/README.md`](./src/features/theme/data/README.md)
