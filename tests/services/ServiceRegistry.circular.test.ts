// tests/services/ServiceRegistry.circular.test.ts
// unit tests for ServiceRegistry circular dependency detection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Import after mocks
import { ServiceRegistry } from '../../packages/extension-host/src/app/services/ServiceRegistry';
import { CircularDependencyError } from '../../packages/extension-host/src/shared/errors';

describe('ServiceRegistry circular dependency detection', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    ServiceRegistry.reset();
    registry = ServiceRegistry.getInstance();
  });

  afterEach(() => {
    ServiceRegistry.reset();
    vi.clearAllMocks();
  });

  it('throws CircularDependencyError on direct cycle (A -> B -> A)', () => {
    registry.register('ServiceA', () => {
      registry.get('ServiceB');
      return { dispose: vi.fn() };
    });

    registry.register('ServiceB', () => {
      registry.get('ServiceA');
      return { dispose: vi.fn() };
    });

    expect(() => registry.get('ServiceA')).toThrow(CircularDependencyError);
  });

  it('detects indirect cycle (A -> B -> C -> A)', () => {
    registry.register('ServiceA', () => {
      registry.get('ServiceB');
      return { dispose: vi.fn() };
    });

    registry.register('ServiceB', () => {
      registry.get('ServiceC');
      return { dispose: vi.fn() };
    });

    registry.register('ServiceC', () => {
      registry.get('ServiceA');
      return { dispose: vi.fn() };
    });

    expect(() => registry.get('ServiceA')).toThrow(CircularDependencyError);
  });

  it('detects self-reference cycle (A -> A)', () => {
    registry.register('SelfService', () => {
      registry.get('SelfService');
      return { dispose: vi.fn() };
    });

    expect(() => registry.get('SelfService')).toThrow(CircularDependencyError);
  });

  it('allows non-circular dependency chains', () => {
    registry.register('Base', () => ({
      dispose: vi.fn(),
      value: 42,
    }));

    registry.register('Consumer', () => {
      const base = registry.get<{ value: number }>('Base');
      return {
        dispose: vi.fn(),
        baseValue: base.value,
      };
    });

    const consumer = registry.get<{ baseValue: number }>('Consumer');
    expect(consumer.baseValue).toBe(42);
  });
});
