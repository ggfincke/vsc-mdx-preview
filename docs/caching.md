# Caching Architecture

MDX Preview uses multiple caching layers to optimize performance. This document
describes all caches, their invalidation triggers, and troubleshooting guidance.

## Cache Layers

### Extension-Side Caches (Node.js)

| Cache               | Location                               | Type                  | TTL | Max   | Invalidation Trigger                       |
| ------------------- | -------------------------------------- | --------------------- | --- | ----- | ------------------------------------------ |
| Resolver FS         | resolver-factory.ts                    | CachedInputFileSystem | 30s | -     | PackageJsonWatcher, manual command         |
| File Prober Stats   | file-prober.ts                         | LRUCache              | 5s  | 1000  | Resolution invalidation, auto-expires      |
| TS Path Index       | TypeScriptPathStrategy.ts              | Map                   | -   | -     | Resolution invalidation, manual command    |
| Path Security       | checkFsPath.ts                         | LRUCache              | 5m  | 200   | Workspace changes, resolution invalidation |
| TypeScript Config   | TypeScriptConfigResolver.ts            | PathCache             | -   | 50    | tsconfig.json watcher, manual command      |
| MDX Preview Config  | ConfigCache.ts                         | PathCache             | -   | 100   | Config watcher, manual command             |
| Babel Options       | babel.ts                               | Singleton             | -   | 1     | Manual command                             |
| PostCSS Module      | TailwindCompiler.ts                    | Singleton             | -   | 1     | Manual command                             |
| Sass Module         | SassHandler.ts                         | Map                   | -   | -     | PackageJsonWatcher, manual command         |
| Tailwind Results    | TailwindProcessor.ts                   | LRUCache              | 5m  | 50    | Auto-expires, manual command               |
| Tailwind Scan       | TailwindProcessor.ts (scanCache field) | ContentHashCache      | 5m  | 200   | DependencyWatcher, manual command          |
| Tailwind Detection  | TailwindDetector.ts                    | PathCache + LRU       | 5m  | 10-20 | File watchers, manual command              |
| Framework           | FrameworkDetector.ts                   | PathCache + Map       | -   | 100   | PackageJsonWatcher, manual command         |
| Nextra Metadata     | MetaResolver.ts                        | PathCache             | -   | 100   | \_meta.json watcher, manual command        |
| Component Detection | ComponentDetector.ts                   | ContentHashCache      | 5m  | 50    | Content hash, manual command               |
| Mermaid Icon Packs  | IconPackResolver.ts                    | LRUCache              | 5m  | 64    | File stamp, auto-expires, manual command   |

> The Tailwind CSS cache TTL (5m) and max entries (50) are the defaults of `mdx-preview.tailwind.cacheTtlSeconds` and `mdx-preview.tailwind.cacheMaxEntries` and can be overridden in settings; related Tailwind limits are `mdx-preview.tailwind.compilationTimeout` (15s) and `mdx-preview.tailwind.maxFileSizeBytes` (10MB).

### Webview-Side Caches (Browser)

| Cache              | Location             | Type               | Max        | Invalidation Trigger            |
| ------------------ | -------------------- | ------------------ | ---------- | ------------------------------- |
| Module Cache       | ModuleCache.ts       | LRU (count+memory) | 500 / 50MB | Preview refresh, manual command |
| Style Cache        | StyleCache.ts        | Ref-counted LRU    | 100        | Preview refresh, manual command |
| Dependency Tracker | DependencyTracker.ts | Multi-map          | -          | Preview refresh, manual command |

## Invalidation Triggers

### Automatic Invalidation

1. **PackageJsonWatcher** - Clears: Resolver cache, Sass cache, Framework cache
2. **DependencyWatcher** - Clears: Tailwind scan cache for changed files
3. **Config file watchers** - Clears: Respective config caches
4. **TTL expiration** - Clears: Resolver FS (30s), File prober (5s), Tailwind (5m)

### Manual Invalidation

- **`MDX: Clear All Caches` command** - Runs the extension cache-invalidator registry for resolution/path security, TypeScript & preview config, Babel/PostCSS, Sass/Tailwind, framework/Nextra metadata, component detection, and Mermaid icon packs; then clears active webview module, style, and dependency caches. Lazy services are cleared only when already initialized.
- **`MDX: Refresh Preview` command** - Clears webview caches for the active preview

## Tailwind Cache Key Composition

The Tailwind CSS cache key is a SHA-1 hash of:

- `schemaVersion`: Cache schema version (bump on breaking changes)
- `version`: Tailwind version ('v4')
- `content`: Extracted class tokens from MDX and dependencies
- `configPath`: Absolute path to tailwind.config.js
- `configStamp`: mtime of config file
- `entryCssPath`: Absolute path to entry CSS file
- `entryStamp`: mtime of entry CSS file

When any of these values change, a new cache key is generated, ensuring stale
CSS is not served.

## Troubleshooting

### Stale Styles After Installing Dependencies

If styles don't update after `npm install`:

1. Run `MDX: Clear All Caches` from the Command Palette
2. Or restart the preview

### Tailwind Classes Not Applying

If Tailwind classes aren't being applied:

1. Check that Tailwind is installed (`npm list tailwindcss`)
2. Run `MDX: Clear All Caches`
3. Check Output panel (MDX Preview) for errors

### SCSS/Sass Not Compiling

If Sass files show "not installed" message:

1. Install sass: `npm install -D sass`
2. Run `MDX: Clear All Caches`
3. Refresh the preview

### Module Not Updating After Edit

If a module doesn't reflect recent edits:

1. The DependencyWatcher should auto-detect changes
2. If not, run `MDX: Clear All Caches`
3. Check that the file is saved (unsaved changes won't trigger watcher)

## Cache Architecture Details

### Two-Layer Cache System

MDX Preview uses a two-layer cache architecture:

1. **Extension-side caches** (Node.js) - Handle file resolution, transpilation
   results, and configuration parsing
2. **Webview-side caches** (Browser) - Handle evaluated modules, injected styles,
   and dependency tracking

This separation is necessary because the webview runs in a sandboxed browser
environment that cannot directly access the filesystem.

### Cache Coordination

When a file changes:

1. File watcher detects change
2. Extension-side caches are invalidated (resolver, scan cache)
3. Webview is notified via RPC to invalidate affected modules
4. Preview re-evaluates with fresh data

### Memory Management

The webview module cache uses dual eviction:

- **Count-based**: Maximum 500 modules
- **Memory-based**: Maximum 50MB estimated memory usage

Preloaded modules (React, MDX runtime, etc.) are protected from eviction.
