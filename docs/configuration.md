# Configuration

This document covers the active configuration surface for MDX Preview:

- VS Code settings under the `mdx-preview.*` namespace
- Per-project `.mdx-previewrc.json` files
- Frontmatter keys recognized by the preview runtime
- Theme and behavior defaults that affect the webview

---

## Configuration Precedence

MDX Preview merges configuration in this order:

1. Frontmatter overrides for recognized preview keys
2. Project config file (`.mdx-previewrc.json` or `.mdx-previewrc`)
3. VS Code workspace settings
4. VS Code user settings
5. Built-in defaults

Only a small, explicit set of frontmatter keys override VS Code settings. See [Frontmatter Overrides](#frontmatter-overrides).

---

## VS Code Settings

All settings are prefixed with `mdx-preview.` in `settings.json`.

### Preview Settings

| Setting                            | Type    | Default       | Description                                                               |
| ---------------------------------- | ------- | ------------- | ------------------------------------------------------------------------- |
| `preview.updateMode`               | string  | `"onType"`    | Update on type, save, or manual refresh                                   |
| `preview.debounceDelay`            | number  | `300`         | Debounce delay in milliseconds for `onType` updates                       |
| `preview.enableScripts`            | boolean | `false`       | Enable Trusted Mode when trust requirements are satisfied                 |
| `preview.openMdxLinksInPreview`    | boolean | `true`        | Open relative `.md` and `.mdx` links in the preview instead of the editor |
| `preview.security`                 | string  | `"strict"`    | CSP policy: `"strict"` or `"disabled"`                                    |
| `preview.useVscodeMarkdownStyles`  | boolean | `true`        | Layer VS Code markdown styles under preview content                       |
| `preview.useWhiteBackground`       | boolean | `false`       | Force a white preview background                                          |
| `preview.customCss`                | string  | `""`          | Path to a custom CSS file injected into the preview                       |
| `preview.mdx.customLayoutFilePath` | string  | `""`          | Path to a global custom MDX layout component                              |
| `preview.sourceLineHighlight`      | boolean | `true`        | Highlight rendered blocks by source line on hover                         |
| `preview.sourceLineHighlightColor` | string  | `"dependent"` | Highlight color mode: `"dependent"`, `"white"`, `"black"`, `"auto"`       |
| `preview.scrollSync`               | string  | `"off"`       | Scroll sync: `"off"`, `"editorToPreview"`, `"previewToEditor"`, `"bidirectional"` |
| `preview.shimSideRail`             | boolean | `true`        | Show the framework shim side rail when applicable                         |

### Theme Settings

| Setting                   | Type    | Default              | Description                                            |
| ------------------------- | ------- | -------------------- | ------------------------------------------------------ |
| `preview.previewTheme`    | string  | `"none"`             | Preview document theme                                 |
| `preview.codeBlockTheme`  | string  | `"auto"`             | Code block syntax theme                                |
| `preview.mermaidTheme`    | string  | `"default"`          | Mermaid diagram theme                                  |
| `preview.autoTheme`       | boolean | `true`               | Auto-switch preview theme pairs based on VS Code theme |
| `diagrams.plantUmlServer` | string  | `"https://kroki.io"` | PlantUML/Kroki server URL                              |

### Build Settings

| Setting                      | Type    | Default | Description                                               |
| ---------------------------- | ------- | ------- | --------------------------------------------------------- |
| `build.useSucraseTranspiler` | boolean | `false` | Use Sucrase instead of Babel for dependency transpilation |

### Tailwind Settings

| Setting                        | Type   | Default     | Description                                                   |
| ------------------------------ | ------ | ----------- | ------------------------------------------------------------- |
| `tailwind.enabled`             | string | `"enabled"` | Tailwind processing mode: `"auto"`, `"enabled"`, `"disabled"` |
| `tailwind.maxFileSizeBytes`    | number | `10485760`  | Maximum file size scanned for Tailwind class extraction       |
| `tailwind.maxCssFilesToSearch` | number | `500`       | Maximum CSS files searched for Tailwind entry points          |
| `tailwind.cacheMaxEntries`     | number | `50`        | Maximum Tailwind compilation cache entries                    |
| `tailwind.cacheTtlSeconds`     | number | `300`       | Tailwind cache TTL in seconds                                 |
| `tailwind.compilationTimeout`  | number | `15000`     | Tailwind compilation timeout in milliseconds                  |

### Framework and Component Settings

| Setting                      | Type    | Default         | Description                                                                                  |
| ---------------------------- | ------- | --------------- | -------------------------------------------------------------------------------------------- |
| `framework`                  | string  | `"auto"`        | Framework mode: `"auto"`, `"generic"`, `"docusaurus"`, `"starlight"`, `"nextra"`, `"nextjs"` |
| `framework.componentShims`   | boolean | `true`          | Enable framework-specific component shims                                                    |
| `components.builtins`        | boolean | `true`          | Enable built-in generic components such as `Callout` and `Tabs`                              |
| `components.unknownBehavior` | string  | `"placeholder"` | Safe Mode unknown component behavior: `"strip"`, `"placeholder"`, `"raw"`                    |

### Advanced Settings

| Setting                      | Type    | Default | Description                                                    |
| ---------------------------- | ------- | ------- | -------------------------------------------------------------- |
| `advanced.watcherDebounceMs` | number  | `500`   | Debounce delay for extension-side file watchers                |
| `advanced.debugOutput`       | boolean | `false` | Enable verbose debug logging in the MDX Preview output channel |

---

## Project Configuration File

Create `.mdx-previewrc.json` or `.mdx-previewrc` in your project. The extension searches upward from the current document until it reaches the workspace root.

### Supported Fields

```json
{
  "remarkPlugins": ["remark-toc"],
  "rehypePlugins": [["rehype-external-links", { "target": "_blank" }]],
  "components": {
    "Button": "./src/components/Button.tsx"
  },
  "framework": "docusaurus",
  "frameworkOptions": {
    "enableShims": true,
    "customAliases": {
      "@components": "./src/components"
    }
  },
  "tailwind": {
    "enabled": "auto",
    "configPath": "./tailwind.config.ts"
  },
  "unknownBehavior": "placeholder",
  "enableScripts": false
}
```

| Field                            | Type           | Description                                                                 |
| -------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `remarkPlugins`                  | `PluginSpec[]` | Custom remark plugins loaded from workspace `node_modules` in Trusted Mode  |
| `rehypePlugins`                  | `PluginSpec[]` | Custom rehype plugins loaded from workspace `node_modules` in Trusted Mode  |
| `components`                     | object         | Map component names to import paths for Trusted Mode auto-import generation |
| `framework`                      | string         | Override framework auto-detection for this project                          |
| `frameworkOptions.enableShims`   | boolean        | Enable or disable framework shims for this project                          |
| `frameworkOptions.customAliases` | object         | Custom alias mappings used during module resolution                         |
| `tailwind.enabled`               | string         | Tailwind mode override for this project                                     |
| `tailwind.configPath`            | string         | Relative path to a Tailwind config file                                     |
| `unknownBehavior`                | string         | Safe Mode unknown component behavior override                               |
| `enableScripts`                  | boolean        | Force Safe Mode for this project when set to `false`                        |

### Plugin Spec Formats

```json
{
  "remarkPlugins": ["remark-gfm", ["remark-toc", { "heading": "contents" }]]
}
```

- `"plugin-name"` loads a plugin without options
- `["plugin-name", { ... }]` loads a plugin with options

Plugins and custom component imports are only active in Trusted Mode.

---

## Frontmatter Overrides

These are the only frontmatter keys that override preview settings:

| Key              | Maps To                              | Description                                    |
| ---------------- | ------------------------------------ | ---------------------------------------------- |
| `previewTheme`   | `mdx-preview.preview.previewTheme`   | Override the preview theme for one document    |
| `codeBlockTheme` | `mdx-preview.preview.codeBlockTheme` | Override the code block theme for one document |

Example:

```yaml
---
previewTheme: github-dark
codeBlockTheme: github-dark
---
```

### Framework Frontmatter

Other frontmatter keys may still matter to framework-specific behavior, but they are not generic preview-setting overrides.

- Nextra metadata can consume keys such as `title`, `description`, `sidebarTitle`, and `layout`
- `_meta.json` and Nextra frontmatter are merged by the Nextra metadata resolver

---

## Theme Inventory

### Preview Themes

There are 16 preview themes:

- `github-light`
- `github-dark`
- `atom-dark`
- `atom-light`
- `atom-material`
- `one-dark`
- `one-light`
- `solarized-dark`
- `solarized-light`
- `gothic`
- `medium`
- `monokai`
- `newsprint`
- `night`
- `none`
- `vue`

### Code Block Themes

There are 24 code block themes:

- `auto`
- `default`
- `atom-dark`
- `atom-light`
- `atom-material`
- `coy`
- `darcula`
- `dark`
- `funky`
- `github`
- `github-dark`
- `hopscotch`
- `monokai`
- `okaidia`
- `one-dark`
- `one-light`
- `pen-paper-coffee`
- `pojoaque`
- `solarized-dark`
- `solarized-light`
- `twilight`
- `vs`
- `vue`
- `xonokai`

### Mermaid Themes

- `default`
- `dark`
- `forest`
- `neutral`
- `base`
- `null`

---

## Editor ↔ Preview Sync

Two coordinated features keep the editor view and rendered preview aligned. Both rely on `data-source-line` annotations emitted by the MDX compiler and only act on blocks the compiler can map (paragraphs, headings, lists, tables, code blocks, callouts, and so on).

### Scroll Sync Modes

| Mode               | What it does                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `off` _(default)_  | Scrolling the editor or preview has no effect on the other side.                                      |
| `editorToPreview`  | When the editor's visible source line changes, the preview scrolls the matching block into view.     |
| `previewToEditor`  | While the preview scrolls, the editor reveals the source line for the block under the reading anchor. |
| `bidirectional`    | Both directions, with mutual suppression so the two sides do not bounce off each other.              |

**Reading anchor.** Sync uses the top-third reading band (~35% from the top of the viewport) as the anchor point. The mapped line lands at the anchor rather than snapping to vertical center, so the line you were last looking at stays roughly where your eye already is.

**Suppression windows.** When one side initiates a sync, the other side ignores its own scroll events for a short settle window. This prevents oscillation in `bidirectional` mode and after extension-driven editor moves (such as `Cmd/Ctrl+Click` navigation).

**Lifecycle.**

- Scroll sync state is tracked per `Preview` and disposed when the preview is closed.
- Toggling the setting at runtime is honored without reloading. Switching to a mode that includes `editorToPreview` immediately scrolls the preview to the currently visible editor line.
- Changes survive webview reloads; cached "last dispatched line" state is reset so the same line can be re-sent against the fresh DOM.

### Cmd/Ctrl+Click Preview Navigation

Hold `Cmd` (macOS) or `Ctrl` (Windows/Linux) and left-click a rendered preview block to open the editor at the corresponding source line. The click skips elements that own native click behavior — anchors, buttons, form controls, `<details>`/`<summary>`, and anything with `[role="button"]` or `contenteditable` — so links, toggles, and form fields keep working.

This navigation is always available regardless of the `scrollSync` mode and is enabled in both Safe and Trusted Mode.

---

## Practical Examples

### Minimal Trusted Mode

```json
{
  "mdx-preview.preview.enableScripts": true
}
```

### Preview Interaction Tweaks

```json
{
  "mdx-preview.preview.sourceLineHighlight": true,
  "mdx-preview.preview.sourceLineHighlightColor": "auto",
  "mdx-preview.preview.shimSideRail": true
}
```

### Bidirectional Scroll Sync

```json
{
  "mdx-preview.preview.scrollSync": "bidirectional"
}
```

See [Editor ↔ Preview Sync](#editor--preview-sync) for the full behavior of each mode.

### Docusaurus Project

```json
{
  "framework": "docusaurus",
  "frameworkOptions": {
    "enableShims": true
  }
}
```

### Tailwind Project

```json
{
  "tailwind": {
    "enabled": "enabled",
    "configPath": "./tailwind.config.ts"
  }
}
```

---

## Cache and Refresh Behavior

- Config files are cached and watched for changes
- Tailwind results are cached separately from config resolution
- Use `MDX: Clear All Caches` if you suspect stale config or stale transpilation
- Use `MDX: Show Effective Configuration` to inspect the resolved configuration and its sources

---

## Troubleshooting

### Config File Not Loading

1. Verify the file is named `.mdx-previewrc.json` or `.mdx-previewrc`
2. Confirm the file is inside the workspace root
3. Check the JSON syntax
4. Run `MDX: Show Effective Configuration`

### Plugins Not Loading

1. Confirm the workspace is trusted
2. Set `mdx-preview.preview.enableScripts` to `true`
3. Make sure the plugin is installed in the workspace's `node_modules`

### Settings Seem Ignored

1. Remember the precedence order: frontmatter, config file, workspace settings, user settings, defaults
2. Verify the exact setting names under the `mdx-preview.` prefix
3. Check the `MDX Preview` output channel for configuration errors
