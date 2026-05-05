# Changelog

All notable changes to the MDX Preview extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.7] - 2026-05-05

### Added

- **Export Preview as HTML**: New `MDX: Export Preview as HTML` command saves the rendered preview to a standalone `.html` file via a save dialog; available from the command palette and the preview toolbar (`editor/title`) when a preview is focused
- **RPC**: Webview `getExportableHtml()` method serializes the live preview DOM (including injected styles) into a self-contained HTML document for the export command

### Fixed

- **Dependencies**: Dedupe `mdx-forge` to ^0.4.2 across the root and all workspaces so nested 0.3.1 installs disappear from the lockfile; drop the conditional `import('mdx-forge/components/generic')` path from preload codegen so generic shim loaders reuse the same static import binding as the eager preloader

### Infrastructure

- **Guardrails**: New `check:mdx-forge-deps` script fails CI on mismatched ranges or nested `mdx-forge` installs; added regression test asserting the generated preload source never reintroduces the dynamic `mdx-forge/components/generic` import

## [1.3.5] - 2026-04-24

### Added

- **Trust Gating**: `content-mode-guard.ts` centralizes trusted-content gating — trusted RPC payloads are discarded when `TrustState.canExecute` is false or the trust handshake has not completed
- **Lifecycle**: `registerUnhandledRejectionHandler()` / `disposeUnhandledRejectionHandler()` register the `process.on('unhandledRejection')` listener as a disposable that is torn down in `deactivate()`

### Changed

- **Activation**: Wrap background promises (`handleTrustChange`, `refreshAllPreviews`, `showSafeModeNotificationIfNeeded`, `packageJsonWatcher.start`) in `reportBackgroundPromiseFailure()` so async failures are logged instead of surfacing as unhandled rejections
- **RPC Queue**: `createRpcMessageQueue` accepts `getTrustState` / `onTrustStateChange` so the client & queue share a single trust state; direct handlers consult `shouldHandleDirectMessage` before dispatching trusted payloads
- **Dependencies**: Bump `mdx-forge` ^0.3.1 -> ^0.4.1; relax `@types/vscode` back to ^1.90.0 for broader engine compatibility

### Tests

- Expanded preload atomic registration & shim loading coverage
- Added direct-handler trust-gating coverage for `webview-rpc-client`
- Refreshed `duplicate-divergence` & `utility-parity` tests against the `mdx-forge` browser surface
- `chore(runtime-utils)`: trim noisy comments in `semaphore.ts` & `lru-cache.ts` while preserving cross-repo duplicate markers

## [1.3.4] - 2026-04-24

### Fixed

- **Security**: Resolve high-severity `lodash` / `lodash-es` advisories (code injection via `_.template`, prototype pollution via `_.unset` / `_.omit`) — bump to 4.18.1 & update the workspace override to match
- **Security**: Bump transitive `@azure/msal-node` 5.1.1 -> 5.1.4

### Changed

- **Dependencies** (minor-and-patch group, 19 updates): `get-tsconfig` 4.13.7->4.14.0, `postcss` 8.5.8->8.5.10, `@types/vscode` 1.110.0->1.116.0, `@vscode/vsce` 3.7.1->3.9.1, `esbuild` 0.27.4->0.28.0, `globals` 17.4.0->17.5.0, `jsdom` 29.0.1->29.0.2, `katex` 0.16.44->0.16.45, `prettier` 3.8.1->3.8.3, `sass` 1.98.0->1.99.0, `typescript-eslint` 8.58.0->8.58.2, `vitest` 4.1.2->4.1.4, `@viz-js/viz` 3.25.0->3.26.0, `dompurify` 3.3.3->3.4.0, `mermaid` 11.13.0->11.14.0, `react` / `react-dom` 19.2.4->19.2.5, `eslint-plugin-react-hooks` 7.0.1->7.1.1, `vite` 8.0.3->8.0.9
- **CI**: Bump `softprops/action-gh-release` v2 -> v3

## [1.3.3] - 2026-04-03

### Documentation

- Refreshed README, architecture, caching, configuration, contributing & troubleshooting guides; synced `MDX_AUTHORING_GUIDE.md` with the in-extension authoring guide; trimmed ~260 net lines of stale content across 12 docs

## [1.3.2] - 2026-04-01

### Infrastructure

- **Release Workflow**: Verify release tags are ancestors of `origin/main` before publishing (`git merge-base --is-ancestor`) & fetch full history on checkout so the ancestry check can resolve

## [1.3.1] - 2026-04-01

### Changed

- **Dependencies**: Bump `mdx-forge` from ^0.2.1 to ^0.3.1 — removes stale compiler barrel, uses ES2022 `Error.cause` constructor & fixes README docs

## [1.3.0] - 2026-03-30

### Added

- **Lightbox**: Zoom via mouse wheel & double-click toggle, drag-to-pan, and section-scoped gallery navigation w/ arrow keys & buttons
- **Commands**: Preview-level Zoom In, Zoom Out & Zoom Reset commands w/ keybindings and localStorage persistence
- **Webview State**: `UIFlagsContext` for preview-level UI state (zoom level)

### Changed

- **Dependencies**: Bump TypeScript 5 -> 6, Vite 7 -> 8, jsdom 28 -> 29, vitest 4.0 -> 4.1, dependency-cruiser, typescript-eslint & @vitejs/plugin-react
- **Dependencies**: Replace `tsconfck` w/ `get-tsconfig` for synchronous tsconfig parsing — removes async wrapper & simplifies `TypeScriptConfigResolver`
- **Dependencies**: Add `mdx-forge` ^0.2.4 as explicit dependency, `@types/babel__core` & `katex` dev deps
- **Build**: Convert Vite `manualChunks` to function form (Vite 8 compat)

### Fixed

- **TypeScript 6**: `Error.captureStackTrace` typing, codegen `baseUrl` removal, DOM lib for runtime-utils

## [1.2.8] - 2026-03-21

### Fixed

- **CI**: Update lodash-es override from 4.17.21 to 4.17.23 to resolve `npm list` version mismatch (includes prototype pollution fix)
- **CI**: Add `--no-dependencies` to `vsce package` to skip extraneous WASM package errors from Tailwind's `@tailwindcss/oxide-wasm32-wasi` bundleDependencies
- **Security Docs**: Remove resolved lodash-es vulnerability entry (GHSA-xxjr-mmjv-4gpg)

## [1.2.7] - 2026-03-21

### Added

- **Language Features**: Document symbol provider, completion provider (directives, callout types, frontmatter keys) & outline tree view for MDX files
- **Guardrails**: Linked-deps check script, command parity verifier (`verify-commands.ts`), reverse orphan check in settings verifier

### Changed

- **Preview Pipeline**: Flatten evaluation pipeline to prepare/evaluate/post-push flow; remove `evaluate-mode-stage.ts` & `tailwind-channel-utils.ts`
- **Preview**: Extract webview HTML/resources from `webview-manager.ts`, extract `PreviewTailwindState` from `Preview.ts`, split `TailwindProcessor.process()` into browser & advanced profiles
- **Errors**: Extract severity inference & notification concerns from `ErrorReporter` into `error-severity.ts` & `error-notification.ts`
- **Watchers**: Replace `FilePathWatcher` w/ `EventSubscriptionWatcher`, simplify `createFileWatcher`
- **Webview RPC**: Inline direct handlers into `webview-rpc-client.ts`, add `buildSimpleQueuedHandlers()` & `buildOptionalHandlers()` batch builders
- **Webview State**: Merge `NextraContext` into `PreviewContext`, add `UIFlagsContext`, reduce provider nesting from 5 to 4
- **Extension**: Consume mdx-forge API changes — compute `preloadId`/`webviewImport` in codegen, use `getSemanticAlias()` & registry-driven directive/snippet data, consume canonical framework metadata & frontmatter overrides
- **Contracts**: Canonicalize framework UI metadata, add frontmatter override descriptors, centralize preload ID constants

### Removed

- **Dead Code**: `FilePathWatcher`, `TocContext.tsx`, `NextraContext.tsx`, `rpc-direct-handlers.ts`, `evaluate-mode-stage.ts`, `processors.ts`, runtime-utils validation exports

## [1.2.6] - 2026-03-05

### Changed

- **Commands**: Consolidate `authoring-guide.ts`, `authoring-guide-text.ts` & `debug.ts` into `simple-commands.ts`; replace 873-line TS template literal w/ raw `.md` file import via esbuild text loader
- **Tailwind**: Extract parser utils (`extractBalanced`, `extractBracedExpressions`, `extractStringLiterals`, `isEscaped`) from `ContentScanner` into standalone `parser-utils.ts`

### Removed

- **runtime-utils**: Remove unused exports (`isError`, `extractErrorStack`, `extractErrorChain`, `formatErrorWithCause`, `NPM_MODULE_PREFIX`, `parseNpmModuleId`, `createNpmModuleId`, `hasUrlScheme`, `URL_SCHEME_PATTERN`, PlantUML URL helpers & all validation type guards); drop `./validation` subpath export

## [1.2.5] - 2026-03-03

### Changed

- **Rendering Parity**: Unified Safe & Trusted Mode rendering — added `markdown-body` class to TrustedPreview, extracted shared code block enhancement hook, centralized external link handling via `openExternal()` RPC, & switched Safe Mode to `useLayoutEffect` for flash-free diagram scanning

## [1.2.4] - 2026-03-03

### Changed

- **Authoring Guide**: Updated authoring guide content

## [1.2.3] - 2026-03-03

### Changed

- **Dependencies**: Addressed open dependency PR updates (`@tailwindcss/postcss`, `ajv`, `katex`, `mermaid`, `react-error-boundary`, `jsdom`, & `typescript-eslint`)

## [1.2.2] - 2026-03-03

### Fixed

- **Table Rendering**: Fixed table column compression in preview

## [1.2.1] - 2026-03-03

### Changed

- **Workspace Cleanup**: Removed stale configs (empty `.gitmodules`, unused `.nvmrc`), trimmed `launch.json` to two configs, & cleaned unrelated entries from `.vscode/settings.json`

## [1.2.0] - 2026-03-01

### Added

- **Explorer Preview Command**: Added an `Open MDX Preview` command in Explorer & editor title context menus for Markdown & MDX files
- **Preview Runtime Controls**: Added source-line highlight color and shim side-rail preview controls
- **Source-Line Highlight Picker**: Added a command palette picker for source-line highlight color modes

### Changed

- **Command Palette Access**: Made the `Toggle Scripts` command available from the command palette even when a Markdown editor is not active
- **Preview UX Polish**: Refined preview runtime state plumbing and theme-aware highlight behavior
- **Dependencies**: Refreshed core dependencies including `@tailwindcss/postcss`, `ajv`, `katex`, `mermaid`, `react-error-boundary`, `jsdom`, & `typescript-eslint`

### Fixed

- **Safe Mode Trust Banner**: Persist dismissed Safe Mode banners across reloads for the same trust state & reset the dismissal after Trusted Mode becomes available
- **Unhandled Rejection Reporting**: Route unhandled promise rejections to the output/error pipeline without showing noisy user notifications

### Refactored

- **Preview Pipeline**: Split preview update/refresh orchestration & evaluation into smaller flow and stage modules to reduce duplication
- **Webview RPC**: Decomposed the webview RPC client into focused bootstrap, queue, registration, & direct-handler modules
- **Guardrails**: Added automated checks for legacy path prefixes, comment style, & test-suite philosophy

### Tests

- Reworked the test suite around repository test philosophy checks & added focused regressions for preview updates, Safe Mode processing, trust-banner persistence, module-system loading, & unhandled rejection handling

### Documentation

- Refreshed architecture docs, examples, & authoring docs to cover the new preview UX and internal flow changes

## [1.1.1] - 2026-02-13

### Fixed

- Fix activation crash caused by circular dependency between `logger.ts` & `ConfigManager.ts`

## [1.1.0] - 2026-02-13

### Infrastructure

- **Architecture Refresh**: Completed 10-phase monorepo restructuring
  - Renamed `packages/extension` -> `packages/extension-host` with feature-sliced internals
  - Renamed `packages/webview-app` -> `packages/webview-client` with feature-sliced internals
  - Deleted `packages/shared` — split into `@mdx-preview/contracts`, `@mdx-preview/runtime-utils`, `@mdx-preview/codegen`
  - Created [`mdx-forge`](https://github.com/ggfincke/mdx-forge) public library with subpath exports (compiler, browser, components)
  - Added 11 dependency-cruiser boundary rules with CI enforcement
  - Migrated 134 files from `@mdx-preview/shared` to direct package imports
- **Runtime Cleanup**: Consolidated runtime layer onto `mdx-forge/browser`
  - Deleted `@mdx-preview/registry` package (ModuleCache, StyleCache, DependencyTracker replaced by mdx-forge)
  - Merged RPC handler-configs into handler-factory
  - Centralized cache/timeout constants, complete SETTINGS constant coverage (27/27 keys)
  - Added cross-repo parity tests with mdx-forge and shared test mock factories

### Changed

- **React 19**: Upgraded from React 18 to React 19
- **Shiki 3**: Upgraded from Shiki 1 to Shiki 3
- **mdx-forge 0.1.6**: Updated from 0.1.3 to 0.1.6
- **CI**: Bumped `actions/checkout` from v4 to v6

### Documentation

- Fixed 37 documentation inaccuracies across public-facing docs

## [1.0.3] - 2026-02-08

### Added

- **PlantUML Diagrams**: Server-side PlantUML rendering via configurable server URL with RPC proxy
- **Graphviz Diagrams**: Client-side Graphviz rendering using `@viz-js/viz` WASM engine
- **Diagram Rendering Pipeline**: Integrated PlantUML and Graphviz renderers into both Safe and Trusted Mode previews

### Changed

- Extracted preview, RPC, and theme types into dedicated modules in shared package
- Consolidated extension type definitions with re-exports from runtime sources
- Inlined `SubscriberManager` into `SingletonService`
- Inlined `PreviewState` and `PreviewEvaluator` into `Preview` class
- Table-driven resolution steps in module system resolver
- Added `createDiagramPlaceholder` factory for rehype plugins
- Added `createIconComponent` factory and table-driven stack parser in webview
- Added module error factories and consolidated type re-exports
- Extracted `addClasses` utility and DRY file-utils helpers

### Infrastructure

- Added `contents: write` permission for GitHub Releases in CI workflow

### Tests

- Added PlantUML, Graphviz, and CSP connect-src tests
- Added command handler, watcher, and semaphore test coverage

### Documentation

- Refreshed project documentation

## [1.0.2] - 2026-02-06

### Changed

- **react-error-boundary**: Upgraded from v4 to v6 with error type normalization fix
- **remark-directive**: Upgraded from v3 to v4

### Refactored

- Extracted factory patterns for config toggle & theme selection commands, reducing duplication
- Replaced `CssHandler` & `JsonHandler` classes with `createSimpleHandler` factory
- Centralized debounce handling in `BaseWatcher` with auto-cancel on stop
- Simplified `DocumentTracker` to implement `IWatcher` directly instead of extending `BaseWatcher`
- Renamed `result-builders.ts` to `resolution-builders.ts` in resolver strategies

### Tests

- Added test suites for `ErrorReporter`, `Preview`, `PreviewManager`, `BaseWatcher`, `CustomCssWatcher`, `DependencyWatcher`, `App`, `TrustedPreview`, config-info & security commands
- Added shared package tests for `LRUCache`, `ContentHashCache`, and registry queries
- Trimmed low-value circular dependency tests & removed `WithSubscribers` test suite

### Infrastructure

- Bumped CI actions: `actions/setup-node` v6, `actions/upload-artifact` v6, `softprops/action-gh-release` v2
- Updated dev dependencies: `@types/dompurify` 3.2.0, `eslint-plugin-react-refresh` 0.5.0, `@vitejs/plugin-react` 5.1.3
- Release workflow now uses changelog for GitHub Release notes instead of auto-generated commits

## [1.0.1] - 2026-02-06

### Added

- **Copy Authoring Guide**: New "Copy Authoring Guide to Clipboard" command for quick access to MDX authoring reference

### Infrastructure

- Dependabot for automated npm & GitHub Actions dependency updates
- Prettier format check & bundle size gate in CI pipeline
- Open VSX publishing in release workflow
- GitHub issue templates (bug report & feature request) and PR template
- `.nvmrc` for Node 20 version pinning

## [1.0.0] - 2026-02-04

This release represents a complete rewrite of the MDX Preview extension, introducing a two-mode security model, modern framework support, and extensive new features while maintaining backward compatibility with existing MDX workflows.

### Added

#### Core Features

- **Two-Mode Rendering System**: Safe Mode (static HTML, no JS) for untrusted workspaces; Trusted Mode (full React evaluation) for trusted workspaces
- **Workspace Trust Integration**: Respects VS Code's workspace trust model with explicit opt-in for script execution
- **Preview Themes**: 15+ preview themes (GitHub, Atom, Solarized, etc.) with auto light/dark switching
- **Code Block Themes**: 23 syntax highlighting themes with configurable selection
- **Table of Contents**: Automatic TOC generation from headings with collapsible sections

#### Framework Support

- **Docusaurus**: Auto-detection, admonitions (:::note, :::tip, etc.), Tabs, TabItem, CodeBlock, Details components
- **Nextra**: Full support with Callout, Tabs, Cards, FileTree, Steps, Bleed components and `_meta.json` awareness
- **Astro Starlight**: Component shims for Starlight documentation sites
- **Next.js**: Image and Link component shims with MDX integration

#### Rich Content

- **Syntax Highlighting**: Shiki-based highlighting with language aliases (js->javascript, ts->typescript, etc.)
- **Mermaid Diagrams**: Client-side rendering of flowcharts, sequence diagrams, state diagrams, and more
- **Math Expressions**: KaTeX integration for inline and block math expressions
- **GitHub Alerts**: Support for NOTE, TIP, WARNING, CAUTION, IMPORTANT callouts
- **Raw HTML Support**: HTML passthrough in both rendering modes

#### Tailwind CSS

- **Live Compilation**: Real-time Tailwind utility class compilation in MDX previews (Trusted Mode)
- **Version Support**: Tailwind v4 with automatic detection
- **Smart Extraction**: Class extraction from MDX/JSX content and dependencies
- **Configuration**: Per-project settings via `mdx-preview.tailwind.*` or `.mdx-previewrc.json`

#### Configuration

- **Config File Support**: Per-project customization via `.mdx-previewrc.json` with JSON schema validation
- **Custom Plugin Loading**: Load custom remark/rehype plugins from workspace `node_modules` (Trusted Mode)
- **Component Mapping**: Auto-generate import statements for custom components via config file
- **Frontmatter Support**: Visual display of YAML frontmatter metadata in both modes

#### Developer Experience

- **Image Lightbox**: Click images to view full-size with zoom support
- **Clickable Stack Traces**: Error stack traces link to source file locations
- **Diagnostics**: Component detection with quick-fix code actions for unknown components
- **Dependency Watching**: Automatic preview refresh when imported local files change
- **MDX Link Navigation**: In-preview navigation between MDX documents
- **Stale Content Indicator**: Visual indicator when preview content is outdated

#### Architecture

- **Service Registry**: Centralized service lifecycle management with lazy initialization and ordered disposal
- **Monorepo Structure**: Organized into extension, webview-app, and shared packages
- **Module Prewarming**: Background module prewarming for faster first render
- **Cache Subsystem**: Unified cache lifecycle management with coordinated invalidation

### Changed

- **MDX 3**: Upgraded from MDX 1/2 to MDX 3 with modern unified ecosystem
- **React 18**: Upgraded from React 16/17 to React 18
- **TypeScript**: ES2022 target with strict mode enabled
- **Build System**: Vite-based webview build, esbuild for extension bundling
- **Module Resolution**: Enhanced-resolve with proper `exports` field and browser condition support
- **Test Infrastructure**: Unified on Vitest with integration test support

### Security

- **Content Security Policy**: Dynamic CSP generation based on trust state (strict for Safe Mode, relaxed for Trusted Mode)
- **Path Traversal Prevention**: File path validation to prevent directory traversal attacks
- **Trust Validation**: Central TrustManager with throwing assertions for security-critical operations
- **Binary Detection**: Automatic detection and rejection of binary files
- **Resource Limits**: Module loading depth and concurrency limits to prevent abuse

### Removed

- **Scroll Sync**: Removed bidirectional scroll synchronization (simplifies architecture)
- **Zoom Commands**: Removed zoom in/out/reset commands for simplification

---

<details>
<summary><strong>Alpha Releases (1.0.0-alpha.1 – 1.0.0-alpha.13)</strong></summary>

## [1.0.0-alpha.13] - 2026-02-03

### Added

- **Cache Subsystem**: Unified cache lifecycle management w/ coordinated invalidation
- **Security Enhancements**: Binary file detection, async path validation w/ symlink resolution, module fetching resource limits
- **Concurrency Controls**: Semaphore utility, module loading depth & concurrency limits, Tailwind cache concurrency limits
- **Commands**: `showEffectiveConfig` debugging command, `clearAllCaches` command
- **Module Prewarming**: Background module prewarming for faster first render
- **Utilities**: Async utilities (timeout, retry, fallback), debounce support for file watchers, keyed lazy import w/ ESM fallback
- **Shared Package**: NullableLRUCache, pure validation type guards, Semaphore utility
- **Webview**: Keyboard navigation for shim components
- **Marketplace**: Added badges (version, installs, license), `engines.node` requirement (>=18.0.0)

### Changed

- **Zoom Commands Removed**: Removed zoom feature for simplification (zoomIn, zoomOut, resetZoom)
- **Architecture**: Extracted TailwindCache to separate module, centralized SVG icons in shared package, split monolithic constants into modular folder
- **Config System**: Added key groups & onDidChangeKey convenience method, simplified config resolution
- **Logging**: Reactive debug output, extracted createTaggedLoggerFactory to shared
- **Module System**: Improved import extractor regex coverage, extracted shared resolver logic
- **Error Handling**: Moved module error factories to shared package, added non-throwing tryRequireTrustedMode helpers

### Fixed

- Fixed `.mdx` file extension declaration in manifest
- Fixed `test:webview` script to run actual webview tests
- Added missing `onCommand:` activation events for all commands
- Fixed README command wording inconsistencies
- Fixed license consistency (GPL-3.0-or-later)
- Consolidated validation exports & removed dead code

### Documentation

- Added services ARCHITECTURE.md w/ validation type exports
- Added known vulnerabilities section to security docs
- Updated architecture & caching documentation
- Added security review date

### Style

- Standardized comments across all packages to imperative lowercase style guide

### Build

- Added `@vscode/vsce` to devDependencies
- Excluded `*.vsix` files from packaging
- Updated CI workflow configuration
- Updated test infrastructure w/ integration tests

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
- **Language Aliases**: Code block language aliases (`js`->`javascript`, `ts`->`typescript`, `sh`->`bash`, etc.)
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

</details>

---

<details>
<summary><strong>Legacy Releases (v0.1.1 – v0.3.0)</strong></summary>

The following releases were part of the original extension by [xyc](https://github.com/xyc):

## [0.3.0] - 2020-04-30

- Upgraded TypeScript to 3.8.3
- Support SASS version `^1.26.3`
- Bug fix: Don't resolve dependency path `..` as npm module
- Updated test scripts

## [0.2.2] - 2019-09-21

- Fixed Windows path issues ([#13](https://github.com/xyc/vscode-mdx-preview/issues/13))

## [0.2.1] - 2019-05-07

- TypeScript fix: tsconfig target default to ESNext

## [0.2.0] - 2019-05-07

- Added TypeScript support ([#1](https://github.com/xyc/vscode-mdx-preview/issues/1))
- Added dynamic imports support ([#3](https://github.com/xyc/vscode-mdx-preview/pull/3))
- Added hot update for dependent files ([#5](https://github.com/xyc/vscode-mdx-preview/issues/5))

## [0.1.5] - 2019-04-13

- Added preview refresh button

## [0.1.4] - 2019-04-08

- Updated webview DOM structure (default renders to #root)

## [0.1.3] - 2019-04-08

- Fixed issue [#2](https://github.com/xyc/vscode-mdx-preview/issues/2)
- Updated default React to 16.8.6
- Documentation update

## [0.1.2] - 2019-04-02

- Fixed typo in documentation

## [0.1.1] - 2019-04-01

- Initial release

</details>
