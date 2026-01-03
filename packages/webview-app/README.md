# MDX Preview Webview App

This is the React application that renders MDX content inside VS Code's webview panel.

## Development

```bash
# Start development server (for standalone testing)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Testing**: Vitest with React Testing Library

### Preview Modes

The webview operates in two modes based on workspace trust and configuration:

1. **Safe Mode** (default)
   - Renders MDX as static HTML
   - No JavaScript execution
   - JSX components shown as placeholders
   - Works in untrusted workspaces

2. **Trusted Mode**
   - Full MDX component evaluation
   - Dynamic module loading from the workspace
   - Requires trusted workspace + scripts enabled

### Project Structure

```
src/
  components/          # React components
    ErrorBoundary.tsx  # Error boundary for graceful failures
    LoadingBar/        # Loading indicator
    TrustBanner/       # Trust mode indicator
    ModeBadge.tsx      # Safe/Trusted mode badge
  module-loader/       # Dynamic module system for Trusted Mode
    ModuleRegistry.ts  # Module cache and resolution
    evaluateModule.ts  # Safe eval for transpiled code
    injectStyles.ts    # CSS injection handling
  App.tsx              # Main application component
  SafePreview.tsx      # Safe mode renderer (static HTML)
  TrustedPreview.tsx   # Trusted mode renderer (full MDX)
  rpc-webview.ts       # RPC communication with extension
```

### Communication

The webview communicates with the extension via VS Code's webview messaging API:

- **Extension -> Webview**: Content updates, trust state changes
- **Webview -> Extension**: Module fetch requests, error reports

## Testing

Tests use Vitest with jsdom environment and React Testing Library:

```bash
# Run all tests
npm test

# Run with coverage
npm run test -- --coverage
```

Key test files:

- `App.test.tsx` - Main component rendering
- `test/SafePreview.test.tsx` - XSS prevention tests
