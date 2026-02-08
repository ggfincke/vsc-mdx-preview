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
   cd vscode-mdx-preview
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
vscode-mdx-preview/
├── packages/
│   ├── extension/            # VS Code extension (Node.js)
│   │   ├── commands/         # VS Code command handlers
│   │   ├── compiler/         # MDX compilation (safe/trusted), plugins
│   │   ├── config/           # Configuration management, caching
│   │   ├── diagnostics/      # Component detection, code actions
│   │   ├── errors/           # ErrorReporter, error codes, messages
│   │   ├── eslint-rules/     # Custom ESLint rules (prefer-tagged-logger, etc.)
│   │   ├── framework/        # Framework auto-detection
│   │   ├── module-system/    # Resolution, handlers, transpilation
│   │   ├── nextra/           # Nextra _meta.json support
│   │   ├── preview/          # Preview management, webview bridge, evaluation
│   │   ├── prewarm/          # Background module prewarming
│   │   ├── security/         # Trust management, CSP, path validation
│   │   ├── services/         # Service registry, singleton services
│   │   ├── tailwind/         # Tailwind detection, scanning, compilation
│   │   ├── themes/           # Theme management, auto-switching
│   │   └── utils/            # Shared utilities (cache, file helpers)
│   ├── shared/               # Shared types, registry, logging, config
│   │   ├── config/           # Settings defaults, enums, schema
│   │   ├── errors/           # ModuleError class, factories
│   │   ├── logging/          # LogTags, TaggedLogger, factory
│   │   ├── registry/         # Component registry data & queries
│   │   └── utils/            # LRUCache, Semaphore, validation
│   └── webview-app/          # React app rendered in webview
│       └── src/
│           ├── components/   # React components & framework shims
│           ├── context/      # React context providers
│           ├── hooks/        # Shared React hooks
│           ├── module-system/ # Browser-side module loading
│           ├── rpc/          # RPC handler factory & configs
│           ├── security/     # DOMPurify allowlist, processors
│           └── theme/        # Theme loading & detection
├── tests/                    # All tests (extension, webview, security, etc.)
├── examples/                 # Example MDX projects
└── assets/                   # Icons and images
```

## npm Scripts

| Script                      | Description                   |
| --------------------------- | ----------------------------- |
| `npm run build`             | Build extension and webview   |
| `npm run build:extension`   | Build extension only          |
| `npm run build:webview-app` | Build webview React app       |
| `npm run watch`             | Watch mode for extension      |
| `npm run start:webview-app` | Start webview dev server      |
| `npm test`                  | Run extension unit tests (Vitest) |
| `npm run test:watch`        | Run tests in watch mode       |
| `npm run test:webview`      | Run webview tests only        |
| `npm run test:all`          | Run all tests (extension and webview) |
| `npm run test:integration`  | Run VS Code integration tests |
| `npm run lint`              | Run ESLint                    |
| `npm run lint:fix`          | Auto-fix linting issues       |
| `npm run format`            | Format with Prettier          |

## Architecture Overview

### Extension Side (`packages/extension`)

The extension runs in VS Code's extension host (Node.js environment):

- **extension.ts**: Entry point, service registration, event handlers
- **services/**: Service registry with lazy initialization and ordered disposal
- **preview/**: Preview management, webview bridge, evaluation engine, watchers
- **compiler/**: MDX compilation (safe/trusted modes), plugin loading, remark/rehype plugins
- **module-system/**: 4-strategy resolver, file type handlers, transpilation (Babel/Sucrase)
- **security/**: TrustManager, CSP generation, path validation
- **config/**: ConfigManager (VS Code settings), ConfigCache (.mdx-previewrc.json)
- **themes/**: ThemeManager with auto light/dark switching
- **tailwind/**: TailwindProcessor with detection, scanning, and compilation
- **framework/**: FrameworkDetector (Docusaurus, Starlight, Nextra, Next.js)
- **diagnostics/**: ComponentDiagnostics, ComponentDetector, code actions
- **nextra/**: MetaResolver for _meta.json support
- **commands/**: All VS Code command handlers organized by category
- **errors/**: ErrorReporter with severity inference and deduplication
- **prewarm/**: Background Babel prewarming for faster first render
- **eslint-rules/**: Custom rules (prefer-tagged-logger, no-direct-vscode-config)

### Shared Package (`packages/shared`)

Shared types, registries, utilities, and constants used by both extension and webview:

- **registry/**: Component registry (COMPONENT_REGISTRY, query functions)
- **logging/**: LogTags enum, TaggedLogger types, createTaggedLoggerFactory
- **config/**: Settings defaults, enums, JSON schema generation
- **errors/**: ModuleError class, error factories, suggestion mapping
- **utils/**: LRUCache, Semaphore, validation helpers

### Webview Side (`packages/webview-app`)

The webview is a React 18 app running in an isolated iframe:

- **App.tsx**: Main component, switches between Safe/Trusted mode
- **SafePreview.tsx**: Renders sanitized HTML (Safe Mode)
- **TrustedPreview.tsx**: Evaluates and renders MDX (Trusted Mode)
- **module-system/**: Module registry, loader, evaluator, style/dependency caching
- **context/**: Granular React contexts (Trust, Preview, Loading, Nextra, Theme)
- **components/shims/**: Framework-specific component shims

### Communication

Extension and webview communicate via Comlink RPC:

- **rpc-extension.ts**: Extension-side RPC endpoint
- **rpc-webview.ts**: Webview-side RPC with message queuing and three-phase flush

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
4. `file:` scheme documents

When enabled:

- Full MDX compilation with React
- CSP includes `unsafe-eval` for module execution
- Import statements are resolved from workspace

## Testing

### Unit Tests (Vitest)

```bash
npm test
```

Tests are in `tests/` at the repo root, organized by category: `tests/extension/`, `tests/webview/`, `tests/compilation/`, `tests/resolution/`, `tests/security/`, `tests/services/`, and `tests/integration/`. The vscode module is mocked via `packages/extension/test/__mocks__/vscode.ts`.

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
import { LogTags } from '@mdx-preview/shared';

const log = createTaggedLogger(LogTags.MY_SUBSYSTEM);
log.debug('Processing module', { moduleId });
log.info('Preview updated');
log.error('Failed to compile', error);
```

All subsystems use `LogTags` from the shared package. The `prefer-tagged-logger` ESLint rule prevents raw logging imports.

## Debugging

### Extension

1. Set breakpoints in `packages/extension/`
2. Press `F5` to launch Extension Development Host
3. Use Debug Console for output

### Webview

1. In Extension Development Host, open a preview
2. Command Palette > "Developer: Open Webview Developer Tools"
3. Use browser DevTools to debug

### Logging

The extension logs to an output channel:

- View > Output > Select "MDX Preview" from dropdown
