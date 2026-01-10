# Changelog

All notable changes to the MDX Preview extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.7] - 2026-01-09

### Added

- **Configuration File Support**: Per-project customization via `.mdx-previewrc.json` files with JSON schema validation
- **Custom Plugin Loading**: Load custom remark/rehype plugins from workspace `node_modules` (Trusted Mode only)
- **Component Mapping**: Auto-generate import statements for custom components via config file
- **Dependency Watching**: Automatic preview refresh when imported local files change

### Changed

- **Preview Subsystem**: Reorganized into `preview/config/` and `preview/watchers/` directories for better maintainability
- **Webview Components**: Reorganized component directory structure (ErrorBoundary, LoadingBar, TrustBanner)
- **MDX Transpiler**: Integrated plugin loader and component mapping support

### Documentation

- Added custom plugins example project (`examples/custom-plugins/`)
- Updated basic example with component demo

## [1.0.0-alpha.6] - 2026-01-08

### Added

- **Shared Types Package**: New `@mdx-preview/shared-types` package for type sharing between extension and webview
- **Structured Errors**: Structured error types and user-friendly error messages in extension
- **Clickable Stack Traces**: Error stack traces in webview now link to source file locations
- **Image Lightbox**: Click images to view full-size with zoom support
- **Zoom Controls**: Preview zoom commands (`Cmd+=`/`Ctrl+=` to zoom in, `Cmd+-`/`Ctrl+-` to zoom out, `Cmd+0`/`Ctrl+0` to reset)
- **Lazy Image Loading**: Images now load lazily for better performance

### Changed

- **Preview Manager**: Extracted StatusBarManager, CustomCssWatcher, DocumentTracker, and TypeScriptConfigResolver into separate helper classes
- **MDX Transpiler**: Extracted shared plugins into dedicated module; added rehype-lazy-images plugin
- **Module Fetcher**: Integrated structured errors with improved logging
- **Extension Lifecycle**: Improved lifecycle management with comprehensive test coverage
- **Mermaid Rendering**: Extracted into reusable `useMermaidRendering` hook

### Documentation

- Updated README with new features and fixed repository URLs
- Updated example MDX showcase with Calculator component

## [1.0.0-alpha.5] - 2026-01-07

### Added

- **Preview Themes**: MPE-style preview themes (GitHub, Atom, Solarized, etc.) via `mdx-preview.preview.previewTheme` setting
- **Code Block Themes**: Configurable syntax highlighting themes (24 options) via `mdx-preview.preview.codeBlockTheme` setting
- **Theme Commands**: Quick pick commands for selecting preview and code block themes
- **Auto Theme Switching**: Automatically switch between light/dark themes based on VS Code color theme

### Changed

- **Shiki Theming**: Switched from bundled themes to CSS variable-based theming for flexible customization
- **CSS Styling**: Updated preview CSS to better mirror VS Code's native markdown preview

### Removed

- **Scroll Sync**: Removed bidirectional scroll synchronization feature (simplifies architecture)

## [1.0.0-alpha.4] - 2026-01-06

### Added

- **Safe Mode Parity**: Syntax highlighting, math expressions, and GitHub alerts now work in Safe Mode
- **Frontmatter Passthrough**: Both Safe and Trusted modes now pass frontmatter to the webview

### Changed

- Updated transpiler pipelines with remark-math, rehype-katex, rehype-shiki, and remark-github-alerts
- `compileToSafeHTML` now returns `SafeHTMLResult` with html and frontmatter fields

### Fixed

- Mermaid placeholder test assertions updated for container-based rendering

## [1.0.0-alpha.3] - 2025-01-04

### Added

- **Syntax Highlighting**: Shiki-based syntax highlighting for code blocks with theme support
- **Mermaid Diagrams**: Client-side rendering of Mermaid diagrams (flowcharts, sequence diagrams, state diagrams, etc.)
- **GitHub Alerts**: Support for GitHub-style alerts/callouts (NOTE, TIP, WARNING, CAUTION, IMPORTANT)
- **Math Expressions**: KaTeX integration for rendering inline and block math expressions (via rehype-katex and remark-math)
- **Frontmatter Display**: Visual display of YAML frontmatter metadata
- **Code Block Component**: Enhanced code block rendering with language labels and styling
- **Raw HTML Support**: rehype-raw plugin for HTML passthrough in safe mode

### Changed

- **MDX Transpiler**: Enhanced to extract and pass frontmatter metadata to webview
- **Content Security Policy**: Updated to allow inline styles for Shiki and KaTeX
- **Module Transform**: Improved handling of TypeScript and transpilation edge cases
- **Webview Components**: Integrated new rendering components for rich content
- **Build System**: Added esbuild configuration for extension bundling

### Fixed

- ESLint configuration now properly excludes .mjs files from type checking

## [1.0.0-alpha.2] - 2025-01-03

### Added

- **Table of Contents**: Automatic TOC generation from headings with collapsible sections
- **Scroll Synchronization**: Bi-directional scroll sync between editor and preview
- **Stale Content Indicator**: Visual indicator when preview content is outdated
- **Trust Banner**: Informational banner explaining trust mode differences
- **Source Position Tracking**: rehype-sourcepos plugin for accurate source mapping
- **Theme Context**: Centralized theme management for webview components
- **Heading Auto-linking**: Automatic ID generation and anchor links for all headings

### Changed

- **Module Resolution**: Enhanced error handling and logging for failed module loads
- **Babel Transpilation**: Improved error messages and configuration handling
- **Preview Manager**: Refactored to support TOC generation and scroll sync
- **Workspace Manager**: Better lifecycle management and event handler disposal
- **Test Infrastructure**: Added integration tests and webview component tests

### Fixed

- Improved error handling in module fetcher for missing dependencies
- Better workspace event cleanup on extension deactivation
- Enhanced RPC communication reliability between extension and webview

## [1.0.0-alpha.1] - 2025-01-02

### Added

- **Safe Mode**: Static HTML rendering without JavaScript execution for untrusted workspaces
- **Trusted Mode**: Full MDX component evaluation with live preview for trusted workspaces
- **Workspace Trust Integration**: Respects VS Code's workspace trust model
- **Security**: Content Security Policy (CSP) for webview protection
- **Security**: Path traversal prevention for module loading
- **Modern Build System**: Vite-based webview build with hot reload support

### Changed

- **MDX 3**: Upgraded from MDX 1/2 to MDX 3 with modern unified ecosystem
- **React 18**: Upgraded from React 16/17 to React 18 with concurrent features
- **TypeScript**: Upgraded to ES2022 target with strict mode enabled
- **Module Resolution**: Switched to enhanced-resolve for proper `exports` field and browser condition support
- **Test Infrastructure**: Unified on Vitest (removed Jest)

### Fixed

- Browser-aware module resolution now properly handles `exports` conditions
- `node:` prefixed imports are now correctly recognized as core modules
- React-DOM preloading now provides correct APIs for both `react-dom` and `react-dom/client`
- Workspace event handlers are now properly disposed on extension deactivation

### Security

- Safe Mode prevents all script execution by default
- Trusted Mode requires explicit opt-in via workspace trust + configuration
- CSP restricts script sources and prevents inline script injection

---

_For changes prior to the 1.0.0 rewrite, see [CHANGELOG-legacy.md](./dev-docs/CHANGELOG-legacy.md)._
