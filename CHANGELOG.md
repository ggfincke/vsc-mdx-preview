# Changelog

All notable changes to the MDX Preview extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
