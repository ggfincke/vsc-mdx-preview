# Changelog

All notable changes to the MDX Preview extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-alpha.12] - 2026-01-30

### Added

- **Shared Package Expansion**: Centralized config enums/defaults/schema, logging types, module error types w/ suggestions, callout normalization, codegen scripts
- **Lazy Import Utility**: `lazyImport()` for deferred module loading
- **Circular Dependency Detection**: ServiceRegistry now detects circular dependencies
- **PathCache & WatchableCache**: New cache utilities for extension
- **Resilient Shim Loading**: Retry & fallback support for webview shim loading
- **Conditional Shim Preloading**: Generic shims now preload based on usage

### Changed

- **Shared Package Architecture**: Component registry moved to shims module, LRUCache & ContentHashCache moved to shared
- **Extension Types**: Centralized types directory, shared error types & config enums
- **Service Registry**: Subsystem registration for resolver & meta subsystems
- **Preview Subsystem**: Extracted Preview class & commands from PreviewManager
- **Config System**: Simplified config caching & TypeScript config resolution
- **Module System**: Simplified resolver strategies, shared file prober, improved transform pipeline
- **Webview Architecture**: Granular React contexts for reduced re-renders, ModuleRegistry subsystem extraction, context factory pattern
- **Build System**: Production optimizations, browser mainField in esbuild, parallel builds w/ concurrently

### Performance

- **Lazy Loading**: Babel, MDX compilers, PostCSS, KaTeX CSS, & framework CSS now lazy-load on demand
- **Resolver Caching**: fs.statSync calls cached w/ 5s TTL, async resolution w/ parallel file probing
- **Shiki Optimization**: O(1) language lookup & lazy highlighter initialization
- **Webview Optimizations**: React.memo for components, cached Mermaid init, parallel dependency fetching, memory-based LRU eviction, O(1) style tracking
- **Tailwind**: Scan cache & improved detector w/ find-up utility
- **DependencyWatcher**: LRU eviction to bound memory

### Fixed

- **Framework Shims**: Docusaurus detection, Starlight tabs, preload alias resolution
- **Webview Components**: Misc component improvements & utility updates

### Build

- **Dependencies**: Moved sass/typescript to devDependencies, added tsconfck
- **Bundle Size**: Comprehensive .vscodeignore cleanup for smaller VSIX
- **TypeScript**: Replaced TS compiler w/ tsconfck for config parsing, Sucrase for transpilation

### Documentation

- Refreshed README w/ new architecture docs
- Added service architecture guide & expanded trust validation docs

## [1.0.0-alpha.11] - 2026-01-21

### Added

- **Nextra Framework Support**: Full Nextra support with component shims (Callout, Tabs, Cards, FileTree, Steps, Bleed), `_meta.json` awareness, and frontmatter extensions
- **Language Aliases**: Code block language aliases (`js`→`javascript`, `ts`→`typescript`, `sh`→`bash`, etc.)
- **Mermaid Theme Setting**: Configurable Mermaid diagram theme via `mdx-preview.preview.mermaidTheme`
- **MDX Link Navigation**: New `openMdxLinksInPreview` setting for in-preview navigation
- **Monorepo Architecture**: Restructured into `@mdx-preview/shared`, `compiler`, and `module-system` packages
- **Service Infrastructure**: SingletonService, BaseWatcher, SubscriberManager, and EffectivePreviewConfig patterns
- **Component System**: BaseCallout/BaseTabs factories, component classifier, registry parity validation
- **Diagnostics**: Component detection with quick-fix code actions
- **Testing**: Security unit tests and example projects (admonitions, docusaurus, nextjs, nextra, starlight)

### Changed

- **Architecture**: Services to SingletonService pattern, watchers to BaseWatcher, module resolution to UnifiedResolver
- **Code Style**: Standardized terse comment style across codebase
- **CSS Architecture**: Extracted base component styles to `base/styles/` folder
- **Examples**: Consolidated Nextra and Next.js examples into single index.mdx files
- **Tailwind**: Added v3 deprecation warning
- **Generic Shims**: Fixed `Tabs`, `TabItem`, `Tab`, `Details` alias registration

### Fixed

- **Starlight FileTree**: Minor styling and structure improvements
- **CodeBlock CSS**: Import CodeBlock.css in webview index.tsx
- **Babel Interop**: Added `__esModule` markers for proper interop
- **Shim Components**: Updated to use shared utilities and fixed styling

### Removed

- **Legacy Directories**: Removed old module-fetcher, transpiler, shared-types, and module-loader directories
- **Example Files**: Consolidated redundant Nextra and Next.js example files

## [1.0.0-alpha.10] - 2026-01-14

### Added

- **Service Registry**: Centralized service lifecycle management with lazy initialization and ordered disposal
- **ConfigManager**: Type-safe configuration access with caching and change notifications
- **ErrorReporter**: Centralized error handling with context-aware reporting and notifications
- **EvaluationEngine**: Extracted MDX evaluation logic for better testability and separation of concerns
- **PreviewContainer**: New webview component for unified preview content rendering
- **FileScanValidator**: Improved Tailwind class extraction with validation
- **Plugin Builder**: Configurable MDX pipeline with custom plugin support
- **PackageJsonWatcher**: Watch package.json changes for dependency tracking

### Changed

- **Module Loader**: Split webview module-loader into focused modules (loadModule, preload, require, aliases)
- **Security Module**: Reorganized DOMPurify config into allowlist, processors, and safeModeStyles modules
- **Preview System**: Integrated service registry throughout preview subsystem
- **Watcher System**: Updated all watchers to use service registry pattern
- **Extension Core**: Refactored extension activation to use service registry
- **Hook Extraction**: Extracted `useImageLightbox` and `useSafeModeProcessing` hooks for reusability

### Removed

- **ThemeContext**: Removed unused ThemeContext in favor of direct theme management
- **domPurifyConfig**: Split into separate focused modules (allowlist, processors, safeModeStyles)

### Style

- Updated CSS across all webview components for consistency
- Improved framework shim component styles (Docusaurus, Starlight)

## [1.0.0-alpha.9] - 2026-01-12

### Added

- **Tailwind CSS Support**: Live compilation of Tailwind utility classes in MDX previews (Trusted Mode only)
  - Auto-detection of Tailwind config and CSS entry files
  - Support for both Tailwind v3 and v4
  - Smart class extraction from MDX/JSX content and dependencies
  - LRU caching with configurable TTL for compiled CSS
  - Configuration via `mdx-preview.tailwind.*` settings
- **Tailwind Config Watcher**: Auto-refresh preview when Tailwind config or entry CSS changes

### Changed

- **Import Resolution**: Extracted shared import resolution utility for dependency watching
- **rehype-raw**: Switched to official `rehype-raw` package with proper MDX passThrough configuration

### Fixed

- **Raw HTML Parsing**: Fixed GitHub alerts and KaTeX output not rendering correctly in Trusted Mode

## [1.0.0-alpha.8] - 2026-01-11

### Added

- **Framework Support**: Auto-detect Docusaurus, Next.js, and Astro Starlight from workspace dependencies
- **Component Shims**: Framework-compatible components (Tabs, Cards, Details, Image, Link) in Trusted Mode
- **Admonitions**: Docusaurus-style admonitions (:::note, :::tip, :::warning, :::caution)
- **Transpiler Fallback**: Automatic fallback from Sucrase to Babel for improved compatibility

### Changed

- **Module Fetcher**: Refactored into specialized handlers (CSS, SASS, Image, JSON, Script)
- **Preview System**: Decomposed preview-manager into focused modules (Configuration, DocumentHandler, Initializer, Bridge)
- **Theme System**: Reorganized into dedicated `/theme` module with improved structure
- **Watcher System**: Added WatcherManager and ConfigWatcher for better coordination

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
