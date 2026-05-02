# MDX Preview for Visual Studio Code

A modern, actively maintained successor to the original [MDX Preview](https://marketplace.visualstudio.com/items?itemName=xyc.vscode-mdx-preview) by [Xiaoyi Chen](https://github.com/xyc). Built on MDX 3 with React 19, framework support, Tailwind CSS, and a two-mode security model.

![MDX Preview Demo](https://raw.githubusercontent.com/ggfincke/vsc-mdx-preview/main/assets/example.gif)

## Features

- **Live Preview** - Instant preview as you type without a dev server
- **React Components** - Full import and rendering support in Trusted Mode
- **Framework Shims** - Auto-detection and built-in shims for Docusaurus, Starlight, Nextra, and Next.js
- **Tailwind CSS** - Built-in Tailwind v4 compilation with auto-detection
- **Syntax Highlighting** - Shiki-powered code blocks with 100+ languages and 24 themes
- **Preview Themes** - 16 themes (GitHub, Atom, Solarized, etc.) with auto light/dark switching
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, state diagrams, and more
- **PlantUML Diagrams** - Server-side rendering via configurable PlantUML server
- **Graphviz Diagrams** - Client-side DOT graph rendering via WASM engine
- **Math Expressions** - KaTeX for inline (`$...$`) and block (`$$...$$`) math
- **GitHub Alerts** - NOTE, TIP, WARNING, CAUTION, IMPORTANT callouts
- **Image Lightbox** - Fullscreen image viewer with gallery navigation, zoom, and pan
- **Preview Zoom** - Preview-scoped zoom commands without changing VS Code's global zoom
- **Export to HTML** - Save the rendered preview as a standalone `.html` file from the toolbar or command palette
- **Authoring Feedback** - Source-line highlighting, MDX outline, symbols, and frontmatter-aware completions
- **Custom Plugins** - Load remark/rehype plugins from your project
- **TypeScript Preview** - Preview `.tsx`/`.ts` files that render to `#root`
- **Safe/Trusted Modes** - Safe Mode for untrusted content, Trusted Mode for full rendering

## Quick Start

1. Install npm dependencies in your workspace (`npm install`)
2. Open an `.mdx` or `.md` file
3. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run **"MDX: Open MDX Preview"**, or press `Cmd+K X` / `Ctrl+K X`

Preview automatically updates as you type. The [MDX](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) extension is installed automatically for syntax highlighting.

## Framework Support

MDX Preview detects your framework from `package.json` and provides compatible component shims:

| Framework      | Detection            | Example Shims                                   |
| -------------- | -------------------- | ----------------------------------------------- |
| **Docusaurus** | `@docusaurus/core`   | `@theme/Tabs`, `@theme/CodeBlock`, Admonitions  |
| **Starlight**  | `@astrojs/starlight` | `Card`, `CardGrid`, `Steps`, `Aside`, `Tabs`    |
| **Nextra**     | `nextra`             | `Callout`, `Tabs`, `Cards`, `FileTree`, `Steps` |
| **Next.js**    | `next` + MDX         | `next/image`, `next/link`                       |
| **Generic**    | (fallback)           | `Callout`, `Tabs`, `Collapsible`, `CodeGroup`   |

See [Frameworks](./docs/frameworks.md) for details and examples.

## Custom Layout

Apply a custom layout by exporting a default value:

```mdx
import Layout from './components/Layout';

export default Layout;

## Hello

Content wrapped in Layout.
```

Or set a global layout path via `mdx-preview.preview.mdx.customLayoutFilePath`. When nothing is specified, VS Code Markdown styles are applied by default (toggle with `mdx-preview.preview.useVscodeMarkdownStyles`).

## MDX Transclusion

Import other `.mdx` or `.md` files as components:

```mdx
import Introduction from './Introduction.mdx';

<Introduction />
```

## JavaScript/TypeScript Preview

Preview React apps that render to `#root`:

```tsx
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

## Configuration

Per-project customization via `.mdx-previewrc.json` (Trusted Mode only):

```json
{
  "remarkPlugins": ["remark-toc", ["remark-emoji", { "emoticon": true }]],
  "rehypePlugins": ["rehype-external-links"],
  "components": {
    "Button": "./src/components/Button.tsx"
  }
}
```

Plugins must be installed in your project's `node_modules`. See [Configuration](./docs/configuration.md) for the full reference.

## Security

**Safe Mode** (default) - Renders MDX as static HTML. No JavaScript execution, no imports, strict CSP. Used automatically in untrusted workspaces.

**Trusted Mode** - Full MDX rendering with React components and imports. Requires a trusted workspace **and** `mdx-preview.preview.enableScripts` enabled. Only available for local workspaces.

Code is only evaluated inside VS Code's isolated webview iframe. MDX files can only require dependencies within your active workspace. By default, only HTTPS content is allowed. You can change security settings through `mdx-preview.preview.security` or **"MDX: Change Security Settings"**.

See [Security](./docs/security.md) for the full security model.

## Extension Settings

| Setting                                        | Default              | Description                                                 |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| `mdx-preview.preview.enableScripts`            | `false`              | Enable JS execution (requires trusted workspace)            |
| `mdx-preview.preview.updateMode`               | `"onType"`           | When to update: `onType`, `onSave`, `manual`                |
| `mdx-preview.preview.previewTheme`             | `"none"`             | Preview theme (github-light, atom-dark, etc.)               |
| `mdx-preview.preview.codeBlockTheme`           | `"auto"`             | Code syntax theme (`auto` matches preview)                  |
| `mdx-preview.preview.autoTheme`                | `true`               | Auto light/dark switching with VS Code                      |
| `mdx-preview.preview.security`                 | `"strict"`           | CSP policy: `strict` or `disabled`                          |
| `mdx-preview.preview.useVscodeMarkdownStyles`  | `true`               | Use VS Code Markdown styles                                 |
| `mdx-preview.preview.useWhiteBackground`       | `false`              | Force white background                                      |
| `mdx-preview.preview.customCss`                | `""`                 | Path to custom CSS file                                     |
| `mdx-preview.preview.mdx.customLayoutFilePath` | `""`                 | Path to custom layout file                                  |
| `mdx-preview.framework`                        | `"auto"`             | Framework detection mode                                    |
| `mdx-preview.tailwind.enabled`                 | `"enabled"`          | Tailwind CSS: `auto`, `enabled`, `disabled`                 |
| `mdx-preview.preview.mermaidTheme`             | `"default"`          | Mermaid diagram theme                                       |
| `mdx-preview.preview.sourceLineHighlight`      | `true`               | Highlight rendered blocks by source line on hover           |
| `mdx-preview.preview.sourceLineHighlightColor` | `"dependent"`        | Highlight color mode: `dependent`, `white`, `black`, `auto` |
| `mdx-preview.preview.shimSideRail`             | `true`               | Show the framework shim side rail when relevant             |
| `mdx-preview.preview.openMdxLinksInPreview`    | `true`               | Open `.mdx` links in preview                                |
| `mdx-preview.framework.componentShims`         | `true`               | Enable framework component shims                            |
| `mdx-preview.components.builtins`              | `true`               | Enable built-in component shims                             |
| `mdx-preview.components.unknownBehavior`       | `"placeholder"`      | Unknown component handling: `strip`, `placeholder`, `raw`   |
| `mdx-preview.diagrams.plantUmlServer`          | `"https://kroki.io"` | PlantUML server URL                                         |
| `mdx-preview.build.useSucraseTranspiler`       | `false`              | Use Sucrase instead of Babel                                |

This table covers the most common settings. See [Configuration](./docs/configuration.md) for the full reference, including Tailwind tuning (`mdx-preview.tailwind.*`) and advanced options (`mdx-preview.advanced.*`).

## Webview Limitations

VS Code webviews have some inherent limitations:

- No Service Workers or Local Storage
- Use `MemoryRouter` instead of `BrowserRouter` for React Router
- Some third-party components may not work

## Troubleshooting

**Component doesn't render?** Open **"Developer: Open Webview Developer Tools"** from the Command Palette and check the console. Make sure you're in Trusted Mode. Try toggling `mdx-preview.build.useSucraseTranspiler`.

**Preview shows "Safe Mode"?** Trust the workspace via **"Workspaces: Manage Workspace Trust"**, then set `mdx-preview.preview.enableScripts` to `true`.

**Framework not detected?** Verify the framework package is in your `package.json`, or manually set `mdx-preview.framework`.

See [Troubleshooting](./docs/troubleshooting.md) for more.

## Documentation

- [Configuration](./docs/configuration.md) - Full configuration reference
- [Frameworks](./docs/frameworks.md) - Framework support and component shims
- [Security](./docs/security.md) - Security model deep dive
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
- [Contributing](./docs/contributing.md) - Development setup and guidelines
- [Architecture](./docs/architecture.mdx) - Extension and webview architecture
- [Examples](./examples) - Working examples for Docusaurus, Starlight, Nextra, Next.js, PlantUML, Graphviz, lightbox/zoom, and more

## Credits

Based on the original [vscode-mdx-preview](https://github.com/xyc/vscode-mdx-preview) by [Xiaoyi Chen](https://github.com/xyc), who created the original codebase, architecture, and UI.

## License

[GPL-3.0-or-later](LICENSE) (in accordance with the original project)
