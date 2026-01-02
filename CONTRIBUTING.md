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
   git clone https://github.com/xyc/vscode-mdx-preview.git
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
│   ├── extension/          # VS Code extension (Node.js)
│   │   ├── preview/        # Preview panel management
│   │   ├── security/       # Trust & CSP management
│   │   ├── transpiler/     # MDX/Babel/Sucrase compilation
│   │   ├── module-fetcher/ # Dependency resolution
│   │   └── test/           # Unit tests
│   └── webview-app/        # React app rendered in webview
│       └── src/
│           ├── components/ # React components
│           └── module-loader/ # Browser-side module loading
├── examples/               # Example MDX projects
└── assets/                 # Icons and images
```

## npm Scripts

| Script                      | Description                   |
| --------------------------- | ----------------------------- |
| `npm run build`             | Build extension and webview   |
| `npm run build:extension`   | Build extension only          |
| `npm run build:webview-app` | Build webview React app       |
| `npm run watch`             | Watch mode for extension      |
| `npm run start:webview-app` | Start webview dev server      |
| `npm test`                  | Run unit tests (Vitest)       |
| `npm run test:watch`        | Run tests in watch mode       |
| `npm run test:integration`  | Run VS Code integration tests |
| `npm run lint`              | Run ESLint                    |
| `npm run format`            | Format with Prettier          |

## Architecture Overview

### Extension Side (`packages/extension`)

The extension runs in VS Code's extension host (Node.js environment):

- **extension.ts**: Entry point, registers commands and event handlers
- **preview-manager.ts**: Manages preview panels and webview lifecycle
- **webview-manager.ts**: Creates webview HTML with proper CSP
- **TrustManager.ts**: Handles workspace trust state
- **CSP.ts**: Generates Content Security Policy headers
- **transpiler/**: Compiles MDX to JavaScript using @mdx-js/mdx
- **module-fetcher/**: Resolves and fetches dependencies from workspace

### Webview Side (`packages/webview-app`)

The webview is a React 18 app running in an isolated iframe:

- **App.tsx**: Main component, switches between Safe/Trusted mode
- **SafePreview.tsx**: Renders sanitized HTML (Safe Mode)
- **TrustedPreview.tsx**: Evaluates and renders MDX (Trusted Mode)
- **module-loader/**: In-browser CommonJS-style module system

### Communication

Extension and webview communicate via Comlink RPC:

- **rpc-extension.ts**: Extension-side RPC endpoint
- **rpc-webview.ts**: Webview-side RPC endpoint

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

Tests are in `packages/extension/test/`. The vscode module is mocked via `test/__mocks__/vscode.ts`.

### Integration Tests

```bash
npm run test:integration
```

Runs tests in a real VS Code instance using `@vscode/test-electron`.

## Code Style

- TypeScript with strict mode (being phased in)
- Prettier for formatting
- ESLint for linting

Run before committing:

```bash
npm run format
npm run lint
```

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Ensure build succeeds: `npm run build`
5. Update documentation if needed
6. Submit PR with clear description

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
