// tests/services/ServiceRegistry.circular.test.ts
// unit tests for ServiceRegistry circular dependency detection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocks
import { ServiceRegistry } from '../../packages/extension/services/ServiceRegistry';
import { CircularDependencyError } from '../../packages/extension/errors';

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

  it('includes cycle path in error message', () => {
    registry.register('ServiceA', () => {
      registry.get('ServiceB');
      return { dispose: vi.fn() };
    });

    registry.register('ServiceB', () => {
      registry.get('ServiceA');
      return { dispose: vi.fn() };
    });

    try {
      registry.get('ServiceA');
      expect.fail('Should have thrown CircularDependencyError');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CircularDependencyError);
      const cycleError = error as CircularDependencyError;
      expect(cycleError.cycle).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
      expect(cycleError.message).toContain('ServiceA -> ServiceB -> ServiceA');
    }
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
