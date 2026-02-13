# Contributing to MDX Preview

Thank you for your interest in contributing to MDX Preview!

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- VS Code 1.90.0+

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/ggfincke/vsc-mdx-preview.git
   cd vsc-mdx-preview
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Open in VS Code and press `F5` to launch the Extension Development Host.

## Project Structure

```
vsc-mdx-preview/
├── packages/
│   ├── extension-host/          # VS Code extension (Node.js)
│   │   └── src/
│   │       ├── entry/           # Activation entry point
│   │       ├── features/        # Feature-sliced modules
│   │       │   ├── commands/    # VS Code command handlers
│   │       │   ├── diagnostics/ # Component detection, code actions
│   │       │   ├── framework/   # Framework detection, Nextra support
│   │       │   ├── module-runtime/ # Resolution, handlers, transpilation
│   │       │   ├── preview/     # Preview management, webview bridge
│   │       │   ├── prewarm/     # Background module prewarming
│   │       │   ├── security/    # Trust management, CSP
│   │       │   ├── tailwind/    # Tailwind detection, scanning, compilation
│   │       │   └── themes/      # Theme management, auto-switching
│   │       ├── app/             # Service registry, lifecycle, types
│   │       ├── shared/          # Config, errors, logging, utilities
│   │       └── platform/        # RPC communication layer
│   ├── webview-client/          # React app rendered in webview
│   │   └── src/
│   │       ├── app/             # App root, context providers, state
│   │       ├── features/        # Feature-sliced modules
│   │       │   ├── preview/     # Safe & Trusted preview renderers
│   │       │   ├── module-runtime/ # Module caching, loading, preload
│   │       │   ├── shims/       # Framework component shim re-exports
│   │       │   ├── diagrams/    # Mermaid, PlantUML, Graphviz
│   │       │   ├── code-block/  # Code block enhancement, KaTeX
│   │       │   ├── lightbox/    # Image lightbox
│   │       │   └── theme/       # Theme loading & detection
│   │       ├── platform/        # RPC handler factory & client
│   │       ├── shared/          # Hooks, UI components, utilities
│   │       └── generated/       # Code-generated files (8 files)
│   ├── contracts/               # Types, enums, constants, RPC contracts
│   ├── registry/                # Callout types, icon definitions
│   ├── runtime-utils/           # LRU cache, validation, Semaphore
│   └── codegen/                 # Code generation scripts & libraries
├── tests/                       # All tests (extension, webview, security, etc.)
├── examples/                    # Example MDX projects
└── assets/                      # Icons and images
```

## npm Scripts

| Script                         | Description                           |
| ------------------------------ | ------------------------------------- |
| `npm run build`                | Build extension and webview           |
| `npm run build:extension`      | Build extension only                  |
| `npm run build:webview-client` | Build webview React app               |
| `npm run watch`                | Watch mode for extension              |
| `npm run start:webview-client` | Start webview dev server              |
| `npm test`                     | Run extension unit tests (Vitest)     |
| `npm run test:watch`           | Run tests in watch mode               |
| `npm run test:webview`         | Run webview tests only                |
| `npm run test:all`             | Run all tests (extension and webview) |
| `npm run test:integration`     | Run VS Code integration tests         |
| `npm run lint`                 | Run ESLint                            |
| `npm run lint:fix`             | Auto-fix linting issues               |
| `npm run format`               | Format with Prettier                  |

## Architecture Overview

### Extension Side (`packages/extension-host`)

The extension runs in VS Code's extension host (Node.js environment):

- **entry/activate.ts**: Entry point, service registration, event handlers
- **app/services/**: Service registry with lazy initialization and ordered disposal
- **features/preview/**: Preview management, webview bridge, evaluation engine, watchers
- **features/module-runtime/**: 4-strategy resolver, file type handlers, transpilation (Babel/Sucrase)
- **features/security/**: TrustManager, CSP generation
- **features/commands/**: All VS Code command handlers organized by category
- **features/diagnostics/**: ComponentDiagnostics, ComponentDetector, code actions
- **features/framework/**: FrameworkDetector (Docusaurus, Starlight, Nextra, Next.js), MetaResolver
- **features/tailwind/**: TailwindProcessor with detection, scanning, and compilation
- **features/themes/**: ThemeManager with auto light/dark switching
- **features/prewarm/**: Background Babel prewarming for faster first render
- **shared/config/**: ConfigManager (VS Code settings), ConfigCache (.mdx-previewrc.json)
- **shared/errors/**: ErrorReporter with severity inference and deduplication
- **shared/logging/**: Tagged logger for extension host
- **platform/rpc/**: Extension-side RPC endpoint and handler
- **eslint-rules/**: Custom rules (prefer-tagged-logger, no-direct-vscode-config)

### Shared Packages

Shared concerns are split across 4 packages used by both extension & webview:

- **`@mdx-preview/contracts`** (`packages/contracts/`): Types, enums, constants, error classes, logger factory
- **`@mdx-preview/registry`** (`packages/registry/`): Callout types, icon definitions, pure queries
- **`@mdx-preview/runtime-utils`** (`packages/runtime-utils/`): LRU cache, Semaphore, validation, error handling, module ID
- **`@mdx-preview/codegen`** (`packages/codegen/`): Code generation scripts & libraries

### Webview Side (`packages/webview-client`)

The webview is a React 19 app running in an isolated iframe:

- **app/App.tsx**: Main component, switches between Safe/Trusted mode
- **features/preview/safe/**: Renders sanitized HTML (Safe Mode)
- **features/preview/trusted/**: Evaluates and renders MDX (Trusted Mode)
- **features/module-runtime/**: Module registry, loader, preload, style/dependency caching
- **features/shims/**: Framework component shim re-exports (from mdx-forge)
- **features/diagrams/**: Mermaid, PlantUML, Graphviz rendering
- **features/code-block/**: Code block enhancement & KaTeX
- **app/state/**: Granular React contexts (Trust, Preview, Loading, Nextra, Theme)
- **platform/rpc/**: Webview-side RPC with message queuing and three-phase flush
- **generated/**: Code-generated files (preload, shim-barrels, CSS loader)

### Communication

Extension and webview communicate via Comlink RPC:

- **platform/rpc/extension-endpoint.ts**: Extension-side RPC endpoint
- **platform/rpc/webview-rpc-client.ts**: Webview-side RPC with message queuing and three-phase flush

## Security Model

MDX Preview has a strict security model:

### Safe Mode

- Default for untrusted workspaces
- Renders MDX as static HTML (no JavaScript)
- Strict CSP without `unsafe-eval`

### Trusted Mode

Requires:

1. `vscode.workspace.isTrusted === true`
2. `mdx-preview.preview.enableScripts === true`
3. Local workspace (not remote)
4. `file:` or `untitled:` scheme documents

When enabled:

- Full MDX compilation with React
- CSP includes `unsafe-eval` for module execution
- Import statements are resolved from workspace

## Testing

### Unit Tests (Vitest)

```bash
npm test
```

Tests are in `tests/` at the repo root, organized by category: `tests/extension/`, `tests/webview/`, `tests/compilation/`, `tests/resolution/`, `tests/security/`, `tests/services/`, and `tests/integration/`. The vscode module is mocked via `packages/extension-host/test/__mocks__/vscode.ts`.

### Integration Tests

```bash
npm run test:integration
```

Runs tests in a real VS Code instance using `vitest-environment-vscode`.

## Code Style

- TypeScript with strict mode fully enabled
- Prettier for formatting (single quotes, semicolons, trailing commas ES5, 80 char width)
- ESLint for linting with custom rules:
  - `prefer-tagged-logger` - Enforce createTaggedLogger pattern
  - `no-direct-vscode-config` - Enforce ConfigManager usage
  - `no-raw-log-tag` - Prevent raw log tag string usage
- **Comment style** - Strictly enforced (see `dev-docs/comment-style.md`):
  - Single-line `//` only, no JSDoc blocks
  - Use `&` instead of "and", `w/` instead of "with"
  - Imperative tone, no end punctuation

Run before committing:

```bash
npm run format
npm run lint:fix
```

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Ensure build succeeds: `npm run build`
5. Update documentation if needed
6. Submit PR with clear description

## Logging

The extension uses a tagged logger pattern for consistent, filterable output:

```typescript
import { createTaggedLogger } from './logging';
import { LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.MY_SUBSYSTEM);
log.debug('Processing module', { moduleId });
log.info('Preview updated');
log.error('Failed to compile', error);
```

All subsystems use `LogTags` from the shared package. The `prefer-tagged-logger` ESLint rule prevents raw logging imports.

## Debugging

### Extension

1. Set breakpoints in `packages/extension-host/`
2. Press `F5` to launch Extension Development Host
3. Use Debug Console for output

### Webview

1. In Extension Development Host, open a preview
2. Command Palette > "Developer: Open Webview Developer Tools"
3. Use browser DevTools to debug

### Logging

The extension logs to an output channel:

- View > Output > Select "MDX Preview" from dropdown
