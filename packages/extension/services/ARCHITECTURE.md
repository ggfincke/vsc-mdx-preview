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

**Purpose:** Central coordinator for service lifecycle management.

**Features:**
- Lazy initialization via factory functions
- Circular dependency detection
- Reverse-order disposal (dependencies disposed last)
- All `SingletonService` instances must register here

**Registration (in extension.ts activate):**
```typescript
const registry = ServiceRegistry.getInstance();

// Register all services in dependency order
registry.register('CONFIG_MANAGER', () => ConfigManager.getInstance());
registry.register('TRUST_MANAGER', () => TrustManager.getInstance());
// ... other services ...
```

**Disposal (in extension.ts deactivate):**
```typescript
ServiceRegistry.getInstance().dispose();
// All services disposed in reverse registration order
```

## Service Access Patterns

**Preferred (in order):**

1. **Service-locator functions** (most common):
   ```typescript
   import { getConfigManager, getTrustManager } from './services';

   const config = getConfigManager();
   const trustState = getTrustManager().getState();
   ```

2. **ServiceRegistry.get()** (for dynamic access):
   ```typescript
   const service = ServiceRegistry.getInstance().get<MyService>('MY_SERVICE');
   ```

3. **Direct getInstance()** (only within the service class itself):
   ```typescript
   // Only use inside the class or its tests
   const instance = MyService.getInstance();
   ```

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
| Service with lifecycle | `SingletonService` + `ServiceRegistry` |
| Pure/stateless utility | `createSingleton` |
| Accessing services | Use `service-locator.ts` getters |
| Trust check (conditional) | `TrustManager.getState()` |
| Trust check (throwing) | `validateTrust.ts` utilities |
