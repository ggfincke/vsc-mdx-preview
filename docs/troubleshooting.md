# Troubleshooting

This guide covers common issues with MDX Preview and how to resolve them. If your issue isn't covered here, check the [Output panel](#viewing-logs) for detailed error messages.

---

## Quick Diagnostics

Before diving into specific issues, run through this checklist:

| Check                   | How to Verify                               |
| ----------------------- | ------------------------------------------- |
| Extension installed     | View > Extensions > Search "MDX Preview"    |
| Document is `.mdx` file | Check file extension in editor tab          |
| Workspace is open       | File > Open Folder (not just a single file) |
| Preview is open         | Use `Ctrl+K X` / `Cmd+K X` to open preview  |
| Output panel            | View > Output > Select "MDX Preview"        |

---

## Preview Not Appearing

### Symptoms

- Preview panel is blank or white
- "Loading..." indicator stuck
- Panel opens but nothing renders

### Solutions

**1. Check document extension**

Ensure your file has a `.mdx` or `.md` extension. The preview only activates for these file types.

**2. Verify workspace is open**

MDX Preview requires a workspace (folder) to be open, not just a single file:

```
File > Open Folder > Select your project folder
```

**3. Refresh the preview**

Use the Command Palette:

```
MDX: Refresh Preview
```

**4. Check the Output panel**

View > Output > Select "MDX Preview" from the dropdown. Look for error messages.

**5. Reload the window**

If the preview is stuck, reload VS Code:

```
Command Palette > Developer: Reload Window
```

---

## Safe Mode vs Trusted Mode Issues

### "Preview shows HTML, not React components"

**Cause:** Preview is in Safe Mode (no JavaScript execution)

**Solution:** Enable Trusted Mode:

1. Trust the workspace: Command Palette > "Workspaces: Manage Workspace Trust"
2. Enable scripts in settings:
   ```json
   {
     "mdx-preview.preview.enableScripts": true
   }
   ```

### "Components not rendering"

**Cause:** One or more trust requirements not met

**Check all 4 requirements:**

| Requirement       | How to Check                                                    |
| ----------------- | --------------------------------------------------------------- |
| Workspace trusted | Command Palette > "Workspaces: Manage Workspace Trust"          |
| Scripts enabled   | Settings > `mdx-preview.preview.enableScripts`                  |
| Not remote        | Check lower-left corner of VS Code for "SSH", "Container", etc. |
| Local file        | Check file path starts with `/` or drive letter                 |

### "Seeing placeholder boxes"

**Cause:** Unknown component behavior set to placeholder

**Solution:** Components without imports show placeholders. Either:

1. Add the import statement for the component
2. Check if the component name is spelled correctly
3. Change the behavior in settings:
   ```json
   {
     "mdx-preview.components.unknownBehavior": "raw"
   }
   ```

---

## Module Resolution Failures

### "Cannot find module X"

**Symptoms:** Error message like "Cannot find module './Button'" or "Module not found: react-icons"

**Solutions:**

**1. Check the import path**

```mdx
// Correct - relative path with extension
import Button from './components/Button.tsx';

// Correct - package name
import { FaGithub } from 'react-icons/fa';

// Wrong - missing file extension for local files
import Button from './components/Button'; // May need .tsx
```

**2. Verify file exists**

Check that the imported file exists at the specified path relative to your MDX file.

**3. Check tsconfig.json paths**

If using path aliases like `@/components`, ensure your `tsconfig.json` has the paths configured:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**4. Install missing packages**

For npm packages, ensure they're installed:

```bash
npm install react-icons
```

**5. Check node_modules**

Verify the package exists in your project's `node_modules` folder.

### "Module outside allowed directory"

**Cause:** Attempting to import a file outside the workspace

**Solution:** All imports must be within the workspace folder. You cannot import files from parent directories or absolute system paths.

### "Circular dependency detected"

**Cause:** Module A imports B, and B imports A (directly or indirectly)

**Solution:** Refactor to break the cycle:

1. Move shared code to a third module
2. Use dynamic imports where possible
3. Restructure component hierarchy

---

## Import/Export Issues

### "Named export X not found"

**Cause:** Import syntax doesn't match export syntax

**Check:**

```typescript
// If the file exports like this:
export function Button() { ... }

// Import like this:
import { Button } from './Button';  // ✓ Correct

// NOT like this:
import Button from './Button';  // ✗ Wrong (no default export)
```

### "Default export undefined"

**Cause:** File doesn't have a default export

**Check:**

```typescript
// If importing like this:
import MyComponent from './MyComponent';

// The file must have:
export default function MyComponent() { ... }
// OR
export default MyComponent;
```

---

## CSS/Styling Issues

### "Styles not applied"

**Solutions:**

**1. Check CSS import**

Ensure CSS is imported in your MDX or a component:

```mdx
import './styles.css';
```

**2. Check CSS file path**

Verify the path is correct relative to the importing file.

**3. Check webview developer tools**

Command Palette > "Developer: Open Webview Developer Tools" > Elements tab

**4. Check for CSS conflicts**

The preview uses its own base styles. Your CSS might be overridden. Use more specific selectors or `!important`.

### "Tailwind classes not working"

**Solutions:**

**1. Verify Tailwind is installed**

```bash
npm install tailwindcss
```

**2. Check Tailwind config exists**

Ensure `tailwind.config.js` or `tailwind.config.ts` exists in your project root.

**3. Enable Tailwind processing**

```json
{
  "mdx-preview.tailwind.enabled": "enabled"
}
```

**4. Check content paths**

Your `tailwind.config.js` should include MDX files:

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,mdx}', './docs/**/*.mdx'],
  // ...
};
```

**5. Verify entry CSS**

Tailwind needs an entry CSS file with the directives:

```css
/* globals.css or similar */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### "SCSS/SASS not compiling"

**Cause:** `sass` package not installed in workspace

**Solution:**

```bash
npm install sass
```

MDX Preview loads sass from your workspace's `node_modules`, not from the extension bundle.

---

## Framework-Specific Issues

### Docusaurus

**Issue:** `@theme/*` imports not resolving

**Solutions:**

1. Verify framework detection:

   ```json
   {
     "mdx-preview.framework": "docusaurus"
   }
   ```

2. Check package.json has `@docusaurus/core` or `@docusaurus/preset-classic`

3. Verify component shims are enabled:
   ```json
   {
     "mdx-preview.framework.componentShims": true
   }
   ```

### Starlight

**Issue:** Barrel import components not rendering

**Solution:** Use the barrel import syntax:

```mdx
// Correct
import { Card, Aside } from '@astrojs/starlight/components';

// Also works
import Card from '@astrojs/starlight/components/Card';
```

### Nextra

**Issue:** `_meta.json` settings not applied

**Solutions:**

1. Verify `_meta.json` is in the document's directory or a parent directory
2. Check JSON syntax is valid
3. Verify the filename key matches your MDX file (without extension):
   ```json
   {
     "getting-started": {
       "title": "Getting Started",
       "theme": { "layout": "full" }
     }
   }
   ```

**Issue:** Layout not applying

Check frontmatter vs `_meta.json` precedence. Frontmatter overrides `_meta.json`.

### Next.js

**Issue:** `next/image` not optimizing

**Expected:** The preview uses a shim that renders a standard `<img>` tag. Image optimization is a Next.js runtime feature.

**Issue:** `next/link` not navigating

**Expected:** Links in preview open in VS Code, not in browser. This is by design.

---

## Syntax Highlighting Issues

### "Code blocks not highlighted"

**Solutions:**

**1. Add language identifier**

````mdx
```javascript
const hello = 'world';
```
````

Not:

````mdx
```
const hello = 'world';
```
````

**2. Check supported languages**

Shiki supports most common languages. Check the language identifier is correct (e.g., `typescript` not `ts`, though `ts` works as an alias).

### "Wrong colors in code blocks"

**Solutions:**

**1. Check code block theme**

```json
{
  "mdx-preview.preview.codeBlockTheme": "github-dark"
}
```

**2. Use 'auto' for matching**

The `auto` setting selects a theme that matches your preview theme:

```json
{
  "mdx-preview.preview.codeBlockTheme": "auto"
}
```

---

## Mermaid Diagram Issues

### "Diagram not rendering"

**Solutions:**

**1. Check syntax**

Diagrams must use the `mermaid` language identifier:

````mdx
```mermaid
graph TD
    A --> B
```
````

**2. Verify Mermaid syntax**

Use the [Mermaid Live Editor](https://mermaid.live) to validate your diagram syntax.

**3. Check webview console**

Open webview developer tools and check for Mermaid errors:

```
Command Palette > Developer: Open Webview Developer Tools > Console
```

### "Diagram renders incorrectly"

**Solutions:**

**1. Check theme compatibility**

Some Mermaid features look different in different themes:

```json
{
  "mdx-preview.preview.mermaidTheme": "default"
}
```

**2. Simplify the diagram**

Complex diagrams may have rendering issues. Try simplifying.

---

## KaTeX Math Issues

### "Math not rendering"

**Solutions:**

**1. Check delimiters**

Inline math: `$E = mc^2$`
Display math: `$$E = mc^2$$`

**2. Escape special characters**

In MDX, some characters need escaping:

```mdx
$\{x\}$ // Braces need escaping
```

**3. Check for syntax errors**

Invalid LaTeX will not render. Test at [KaTeX Demo](https://katex.org/).

---

## Performance Issues

### "Preview slow to update"

**Solutions:**

**1. Increase debounce delay**

```json
{
  "mdx-preview.preview.debounceDelay": 500
}
```

**2. Switch to onSave mode**

```json
{
  "mdx-preview.preview.updateMode": "onSave"
}
```

**3. Check dependency tree**

Large numbers of imports slow down resolution. Consider consolidating imports.

### "High memory usage"

**Solutions:**

**1. Clear all caches**

```
Command Palette > MDX: Clear All Caches
```

**2. Reduce Tailwind cache**

```json
{
  "mdx-preview.tailwind.cacheMaxEntries": 20
}
```

### "Extension activation slow"

**Cause:** First activation loads Babel and other dependencies lazily

**This is expected.** Subsequent previews will be faster.

---

## Trust and Security Errors

### "TrustError: Operation requires trusted mode"

**Cause:** Attempting an operation that requires Trusted Mode

**Solution:**

1. Trust the workspace: `Workspaces: Manage Workspace Trust`
2. Enable scripts: `mdx-preview.preview.enableScripts: true`

### "SecurityError: Path outside allowed directory"

**Cause:** Attempting to access files outside the workspace

**Solution:** Ensure all imports are within the workspace folder.

### "Content Security Policy blocked X"

**Cause:** CSP blocking external resources or inline scripts

**Solutions:**

**1. Check if you're loading external resources**

External scripts/styles may be blocked. Use local resources instead.

**2. Disable CSP (for debugging only)**

```json
{
  "mdx-preview.preview.security": "disabled"
}
```

> [!CAUTION]
> Only disable CSP temporarily for debugging. Re-enable for normal use.

---

## Debugging Techniques

### Viewing Logs

**Output Panel:**

1. View > Output
2. Select "MDX Preview" from the dropdown
3. Look for errors and debug information

**Webview Developer Tools:**

1. Command Palette > "Developer: Open Webview Developer Tools"
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Check Elements tab for DOM issues

**Extension Host Logs:**

1. Help > Toggle Developer Tools
2. Check Console tab for extension errors

### Check Effective Configuration

Use the built-in command to view the full effective configuration:

```
Command Palette > MDX: Show Effective Configuration
```

This opens a JSON document showing metadata (document path, framework, trust state), merged configuration values, and the source of each setting (frontmatter, config file, workspace settings, user settings, or default).

You can also check the Output panel (View > Output > "MDX Preview") for configuration loading logs.

### Common Log Tags

| Tag               | Meaning                    |
| ----------------- | -------------------------- |
| `[TRUST-MANAGER]` | Trust state changes        |
| `[PREVIEW]`       | Preview lifecycle events   |
| `[MODULE-SYSTEM]` | Module resolution/fetching |
| `[CONFIG]`        | Configuration loading      |
| `[FRAMEWORK]`     | Framework detection        |
| `[TAILWIND]`      | Tailwind CSS processing    |

---

## Cache Issues

### "Stale content shown"

**Solutions:**

**1. Refresh preview**

```
Command Palette > MDX: Refresh Preview
```

**2. Clear all caches**

```
Command Palette > MDX: Clear All Caches
```

This clears all extension-side caches (resolver, Sass, component detection, path security) and all webview-side caches (modules, styles, dependencies) in one command.

**3. Reload window**

```
Command Palette > Developer: Reload Window
```

---

## Export to HTML Issues

### "MDX Preview: Open a preview before exporting HTML"

**Cause:** The `MDX: Export Preview as HTML` command was triggered with no active preview.

**Solution:** Open a preview (`Ctrl+K X` / `Cmd+K X` on an `.mdx`/`.md` file) first, then re-run the command from the command palette or click the export button in the preview toolbar.

### Export saves but the file looks unstyled

**Cause:** The exported HTML inlines the styles that were applied at the moment of export. If the preview hadn't fully loaded a custom theme, Tailwind layer, or KaTeX/Mermaid CSS yet, the snapshot can ship without those rules.

**Solution:**

1. Wait for the preview to finish rendering (loading bar idle, no spinners) before exporting
2. If you depend on Tailwind, make sure Trusted Mode is active so Tailwind has run — Safe Mode does not compile Tailwind
3. Re-run `MDX: Refresh Preview` and then re-export

### Exported file references local images that don't resolve

**Cause:** The export pulls images from the rendered DOM. If those images use webview-internal URIs, opening the saved `.html` outside VS Code can't resolve them.

**Solution:** Use absolute `https:` image URLs (or inline `data:` images) in your MDX when you intend to share the exported HTML outside VS Code.

---

## Editor ↔ Preview Sync Issues

### "Scroll sync isn't doing anything"

**Cause:** `mdx-preview.preview.scrollSync` defaults to `"off"`.

**Solution:** Set it to one of `"editorToPreview"`, `"previewToEditor"`, or `"bidirectional"`:

```json
{
  "mdx-preview.preview.scrollSync": "bidirectional"
}
```

The setting takes effect immediately; no reload required.

### "Some blocks don't sync"

Sync relies on `data-source-line` annotations from the MDX compiler. Custom React components rendered in Trusted Mode may not emit these annotations, so the preview anchor falls back to the nearest annotated block. Stick with standard MDX block structures (paragraphs, headings, lists, tables, code blocks, callouts) when you want precise sync.

### "Preview snaps to the wrong place"

The sync target lands at the top-third reading band (~35% from the top of the viewport), not at the very top or center. If the preview seems to jump too far up or down, confirm you're scrolling using either real scroll input (wheel, trackpad, keyboard) or the editor's visible range — programmatic jumps from extensions outside MDX Preview can fire visible-range events that compete with sync.

### "Cmd/Ctrl+Click does nothing"

**Causes & fixes:**

1. You clicked a native interactive element (link, button, form control, `<details>`, `[role="button"]`, contenteditable). Source-line navigation intentionally defers to native behavior on those elements.
2. The block has no `data-source-line` annotation. This happens for custom components in Trusted Mode that don't preserve the annotation.
3. The preview is in an error state. Check the Output panel for a `[RPC-WEBVIEW]` warning like `Failed to open source line`.

### "Editor and preview keep fighting each other in bidirectional mode"

The sync uses short suppression windows on both sides to break feedback loops. If you still see oscillation:

1. Confirm only one preview is open for the document
2. Reload the window (`Developer: Reload Window`) — stale schedulers from a crashed webview can occasionally outlive the preview
3. As a workaround, switch temporarily to `editorToPreview` or `previewToEditor`

---

## Remote Development Issues

### "Trusted Mode not available"

**Cause:** Trusted Mode is disabled in remote environments

**This is by design.** Remote environments (SSH, Containers, WSL, Codespaces) use Safe Mode only for security reasons.

**Workaround:** Use Safe Mode features (Markdown, Mermaid, KaTeX) which work in remote environments.

### "Files not resolving"

**Cause:** Path resolution differs in remote environments

**Solution:** Check that paths are valid in the remote file system context.

---

## Common Error Messages

| Error                                         | Cause                              | Solution                                  |
| --------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| "Module not found"                            | Import path incorrect              | Check path and file existence             |
| "TrustError"                                  | Not in Trusted Mode                | Enable workspace trust and scripts        |
| "SecurityError"                               | Path validation failed             | Keep imports within workspace             |
| "Parse error"                                 | Syntax error in MDX                | Check MDX/JSX syntax                      |
| "Circular dependency"                         | Module cycle detected              | Refactor to break cycle                   |
| "Plugin load failed"                          | Plugin not installed               | Install plugin: `npm install <plugin>`    |
| "Tailwind compile failed"                     | Tailwind configuration error       | Check tailwind.config.js                  |
| "Sass not found"                              | sass package missing               | `npm install sass`                        |
| "Open a preview before exporting HTML"        | No active preview when exporting   | Open a preview first, then re-export      |
| "Failed to export HTML — ..."                 | Preview DOM serialization failed   | Refresh preview, retry; check Output logs |

---

## FAQ

### Can I use MDX Preview with framework X?

MDX Preview supports Docusaurus, Starlight, Nextra, and Next.js with built-in shims. For other frameworks, use the generic shims or map custom components in `.mdx-previewrc.json`.

### How do I add custom components?

Add them to `.mdx-previewrc.json`:

```json
{
  "components": {
    "Button": "./src/components/Button.tsx"
  }
}
```

### Why is Safe Mode the default?

Safe Mode ensures untrusted workspaces can't execute arbitrary code. This is a security feature. Enable Trusted Mode explicitly when you trust the content.

### How do I enable Trusted Mode?

1. Open Command Palette
2. Run "Workspaces: Manage Workspace Trust"
3. Trust the workspace
4. Add to settings: `"mdx-preview.preview.enableScripts": true`

### Can I use external URLs in imports?

No. For security, only local workspace files and npm packages can be imported.

### How do I customize the preview theme?

```json
{
  "mdx-preview.preview.previewTheme": "github-dark",
  "mdx-preview.preview.codeBlockTheme": "one-dark"
}
```

### Where are preview settings stored?

- **User settings:** `~/.config/Code/User/settings.json` (Linux/Mac) or `%APPDATA%\Code\User\settings.json` (Windows)
- **Workspace settings:** `.vscode/settings.json` in your project
- **Project config:** `.mdx-previewrc.json` in your project

### How do I report a bug?

Open an issue at: https://github.com/ggfincke/vsc-mdx-preview/issues

Include:

1. VS Code version
2. Extension version
3. Steps to reproduce
4. Expected vs actual behavior
5. Output panel logs

---

## Still Having Issues?

1. Check the [Output panel](#viewing-logs) for detailed error messages
2. Try the [debugging techniques](#debugging-techniques)
3. Search existing [GitHub issues](https://github.com/ggfincke/vsc-mdx-preview/issues)
4. Open a new issue with reproduction steps
