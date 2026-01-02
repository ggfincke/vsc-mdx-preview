# MDX Preview for Visual Studio Code

Preview [MDX](https://mdxjs.com) files with live refresh and React component support directly in VS Code.

![MDX Preview Demo](./assets/example.gif)

## Features

- **Live Preview**: See your MDX rendered instantly as you type
- **React Components**: Full support for importing and rendering React components
- **MDX 3 Support**: Built on the latest MDX compiler with modern React 18
- **TypeScript Support**: Preview `.tsx` and `.ts` files that render to `#root`
- **Security Model**: Safe Mode for untrusted content, Trusted Mode for full rendering

## Quick Start

1. Open an `.mdx` or `.md` file in your workspace
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run **"MDX: Open Preview"** or use `Cmd+K X` / `Ctrl+K X`

## Security Model

MDX Preview has two security modes:

### Safe Mode (Default)

- Renders MDX as static HTML without JavaScript execution
- Used automatically in untrusted workspaces
- No custom React components or imports

### Trusted Mode

Requires **both**:

1. A trusted workspace (VS Code Workspace Trust)
2. `mdx-preview.preview.enableScripts` setting enabled

In Trusted Mode:

- Full MDX rendering with React components
- JavaScript execution enabled
- Import statements work

> **Note**: Trusted Mode is only available for local workspaces. Remote environments (SSH, WSL, Dev Containers, Codespaces) always use Safe Mode.

## Configuration

| Setting                                        | Default    | Description                                              |
| ---------------------------------------------- | ---------- | -------------------------------------------------------- |
| `mdx-preview.preview.enableScripts`            | `false`    | Enable JavaScript execution (requires trusted workspace) |
| `mdx-preview.preview.previewOnChange`          | `true`     | Preview on change (false = preview on save)              |
| `mdx-preview.preview.useVscodeMarkdownStyles`  | `true`     | Apply VS Code's markdown styling                         |
| `mdx-preview.preview.useWhiteBackground`       | `false`    | Force white background                                   |
| `mdx-preview.preview.mdx.customLayoutFilePath` | `""`       | Path to custom layout component                          |
| `mdx-preview.preview.security`                 | `"strict"` | CSP policy (`strict` or `disabled`)                      |
| `mdx-preview.build.useSucraseTranspiler`       | `false`    | Use Sucrase instead of Babel                             |

## Custom Layouts

Apply custom layouts to your MDX in three ways:

### 1. Export Default Layout

```mdx
import Layout from './components/Layout';

export default Layout;

# Hello World

This content will be wrapped in Layout.
```

### 2. Configuration Setting

Set `mdx-preview.preview.mdx.customLayoutFilePath` to the absolute path of your layout file.

### 3. VS Code Markdown Styles (Default)

When no custom layout is specified, VS Code's built-in markdown styling is applied.

## MDX Transclusion

Import other MDX files as components:

```mdx
import Introduction from './Introduction.mdx';
import Features from './Features.mdx';

# Documentation

<Introduction />

<Features />
```

## JavaScript/TypeScript Preview

Preview React apps that render to `#root`:

```tsx
// App.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

## Webview Limitations

VS Code webviews have some inherent limitations:

- No Service Workers or Local Storage
- Use `MemoryRouter` instead of `BrowserRouter` for React Router
- Some third-party components may not work

## Troubleshooting

### Component doesn't render?

1. Open Command Palette and run **"Developer: Open Webview Developer Tools"**
2. Check the console for errors
3. Try enabling `mdx-preview.build.useSucraseTranspiler`

### Preview shows "Safe Mode"?

1. Trust the workspace: Command Palette > **"Workspaces: Manage Workspace Trust"**
2. Enable scripts: Set `mdx-preview.preview.enableScripts` to `true`

## Requirements

- VS Code 1.90.0 or higher
- Node.js and npm for workspaces with dependencies

## Recommended Extensions

- [MDX](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) - Modern MDX language support (syntax highlighting, validation)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
