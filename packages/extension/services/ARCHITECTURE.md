# Service Architecture Guidelines

This document describes the singleton and service patterns used in the MDX Preview extension.

## Singleton Patterns

The extension uses two singleton patterns for different use cases.

### SingletonService (Class-based)

**Use for:** Services with lifecycle management, subscriptions, VS Code disposables.

**Features:**
- Extends `SingletonService<T>` abstract base class
- Manages `disposables[]` collection for automatic cleanup
- Provides `getInstance()`, `dispose()`, and `onDispose()` hook
- Integrates with `ServiceRegistry` for coordinated disposal

**Examples:**
- `TrustManager` - Trust state management with subscriptions
- `ConfigManager` - VS Code settings access with change events
- `ConfigCache` - Config file caching with file watchers
- `ThemeManager` - Preview theming with VS Code theme observation
- `PreviewManager` - Webview panel lifecycle
- `FrameworkDetector` - MDX framework detection
- `TailwindProcessor` - Tailwind CSS compilation
- `ErrorReporter` - Centralized error handling
- `StatusBarManager` - VS Code status bar items
- `ComponentDiagnostics` - Unknown component detection

**Example Usage:**
```typescript
export class MyService extends SingletonService<MyService> {
  protected static override instance: MyService | undefined;
  protected readonly logTag = 'MY-SERVICE';

  protected constructor() {
    super();
    // Setup subscriptions, watchers, etc.
    this.addDisposable(someWatcher);
  }

  protected override onDispose(): void {
    // Custom cleanup beyond automatic disposable cleanup
  }
}
```

### createSingleton (Factory-based)

**Use for:** Stateless/pure utilities, cached function results, lightweight singletons without lifecycle.

**Features:**
- Lightweight alternative to class-based singletons
- Returns `{ get(), reset() }` interface
- No built-in disposal (use for stateless patterns only)
- `reset()` for testing scenarios

**Examples:**
- `FileProbeStrategy` - File probing for module resolution
- `TypeScriptPathStrategy` - TypeScript path alias resolution
- Resolver singletons in module system

**Example Usage:**
```typescript
const { get: getMyResolver } = createSingleton(() => new MyResolver());

// Usage
const resolver = getMyResolver();

// Testing
const { get, reset } = createResettableSingleton(() => new MyCache());
// ... use cache ...
reset(); // Clear for next test
```

## ServiceRegistry

**Purpose:** Central coordinator for service & subsystem lifecycle management.

**Features:**
- Lazy initialization via factory functions
- Circular dependency detection
- Reverse-order disposal (dependencies disposed last)
- Subsystem support for factory singletons & module-level state
- All `SingletonService` instances must register here

**Registration (in extension.ts activate):**
```typescript
const registry = ServiceRegistry.getInstance();

// Register all services in dependency order
registry.register('CONFIG_MANAGER', () => ConfigManager.getInstance());
registry.register('TRUST_MANAGER', () => TrustManager.getInstance());
// ... other services ...

// Register subsystems AFTER services (so they dispose BEFORE services)
registerResolverSubsystem();
registerCacheSubsystem();
```

**Disposal (in extension.ts deactivate):**
```typescript
ServiceRegistry.getInstance().dispose();
// 1. Subsystems disposed first (reverse registration order)
// 2. Services disposed second (reverse registration order)
```

## Subsystem Registration

**Purpose:** Unified lifecycle for factory singletons & module-level state.

For modules w/ factory singletons or module-level caches that need cleanup, use subsystem registration instead of manual disposal calls:

```typescript
import { ServiceRegistry } from './services';
import { debug } from './logging';

export const MY_SUBSYSTEM = 'MySubsystem';

export function registerMySubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(MY_SUBSYSTEM, () => {
    debug('[MY-SUBSYSTEM] Disposing...');
    mySingleton.dispose();
    myCache.clear();
    debug('[MY-SUBSYSTEM] Disposed');
  });
}
```

**Key Points:**
- Subsystems dispose BEFORE services (subsystems depend on services, not vice versa)
- Use for factory singletons & module-level state (caches, watchers)
- Keep factory singletons lightweight (no IService overhead required)
- Register in `activate()` AFTER services
- Single `ServiceRegistry.dispose()` call handles all cleanup

**Current Subsystems:**
- `ResolverSubsystem` - Resolver singletons, cached file system, stat/compiled caches
- `CacheSubsystem` - Component detection cache, path security caches, & other unmanaged caches

## Service Access Patterns

**Preferred (in order):**

1. **Service-locator functions** (RECOMMENDED for all external code):
   ```typescript
   import { getConfigManager, getTrustManager } from './services';

   const config = getConfigManager();
   const trustState = getTrustManager().getState();
   ```

2. **ServiceRegistry.get()** (for dynamic access only):
   ```typescript
   const service = ServiceRegistry.getInstance().get<MyService>('MY_SERVICE');
   ```

3. **Direct getInstance()** (ONLY within the service class or its tests):
   ```typescript
   // Only use inside the class or its tests
   const instance = MyService.getInstance();
   ```

### When NOT to use getInstance() directly

- In consuming code outside the service module - use service-locators instead
- When a service is registered w/ ServiceRegistry - use the corresponding getter
- When a service-locator function exists - always prefer it over direct access

### Migration checklist for legacy code

If you encounter direct `getInstance()` calls in consuming code, refactor to use service-locators:

| Instead of... | Use... |
|---------------|--------|
| `ConfigManager.getInstance()` | `getConfigManager()` |
| `TrustManager.getInstance()` | `getTrustManager()` |
| `ThemeManager.getInstance()` | `getThemeManager()` |
| `PreviewManager.getInstance()` | `getPreviewManager()` |
| `FrameworkDetector.getInstance()` | `getFrameworkDetector()` |
| `TailwindProcessor.getInstance()` | `getTailwindProcessor()` |
| `ErrorReporter.getInstance()` | `getErrorReporter()` |
| `StatusBarManager.getInstance()` | `getStatusBarManager()` |
| `ConfigCache.getInstance()` | `getConfigCache()` |

### Rationale

Service-locators provide:
- Type safety w/o explicit type imports
- Decoupling from implementation details
- Consistent access pattern across the codebase
- Single point of control for testing & mocking

## Trust Validation

The extension provides two approaches for trust checking:

### TrustManager.getState()

**Use for:** Conditional branching without throwing.

```typescript
const trustState = getTrustManager().getState();
if (trustState.canExecute) {
  // Proceed with trusted operation
} else {
  // Fallback behavior
}
```

### validateTrust.ts utilities

**Use for:** Operations that should throw on trust failure.

```typescript
import { requireTrustedMode, requireTrustedModeForDocument } from './security/validateTrust';

// Throws TrustError if not trusted
requireTrustedMode('load plugins');

// Document-aware check (includes remote/scheme checks)
requireTrustedModeForDocument(documentUri, 'execute module code');
```

## Guidelines Summary

| Scenario | Pattern |
|----------|---------|
| Service w/ lifecycle & subscriptions | `SingletonService` + `ServiceRegistry` |
| Stateless utility singleton | `createSingleton()` + subsystem registration |
| Module-level state (cache, watchers) | Subsystem registration |
| Accessing services | Use `service-locator.ts` getters |
| Accessing utility singletons | Direct getter (e.g., `getUnifiedResolver()`) |
| Trust check (conditional) | `TrustManager.getState()` |
| Trust check (throwing) | `validateTrust.ts` utilities |
