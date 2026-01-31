// tests/services/ServiceRegistry.circular.test.ts
// Unit tests for ServiceRegistry circular dependency detection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}));

// Import after mocks
import { ServiceRegistry } from '../../packages/extension/services/ServiceRegistry';
import { CircularDependencyError, ServiceError } from '../../packages/extension/errors';

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

  describe('direct circular dependency (A -> B -> A)', () => {
    it('should throw CircularDependencyError', () => {
      registry.register('ServiceA', () => {
        // This will trigger B's factory
        registry.get('ServiceB');
        return { dispose: vi.fn() };
      });

      registry.register('ServiceB', () => {
        // create the cycle
        registry.get('ServiceA');
        return { dispose: vi.fn() };
      });

      expect(() => registry.get('ServiceA')).toThrow(CircularDependencyError);
    });

    it('should include cycle path in error', () => {
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
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const cycleError = error as CircularDependencyError;
        expect(cycleError.cycle).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
        expect(cycleError.message).toContain('ServiceA -> ServiceB -> ServiceA');
      }
    });
  });

  describe('indirect circular dependency (A -> B -> C -> A)', () => {
    it('should throw CircularDependencyError', () => {
      registry.register('ServiceA', () => {
        registry.get('ServiceB');
        return { dispose: vi.fn() };
      });

      registry.register('ServiceB', () => {
        registry.get('ServiceC');
        return { dispose: vi.fn() };
      });

      registry.register('ServiceC', () => {
        // Cycle back to A
        registry.get('ServiceA');
        return { dispose: vi.fn() };
      });

      expect(() => registry.get('ServiceA')).toThrow(CircularDependencyError);
    });

    it('should include full cycle path in error', () => {
      registry.register('A', () => {
        registry.get('B');
        return { dispose: vi.fn() };
      });

      registry.register('B', () => {
        registry.get('C');
        return { dispose: vi.fn() };
      });

      registry.register('C', () => {
        registry.get('A');
        return { dispose: vi.fn() };
      });

      try {
        registry.get('A');
        expect.fail('Should have thrown CircularDependencyError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const cycleError = error as CircularDependencyError;
        expect(cycleError.cycle).toEqual(['A', 'B', 'C', 'A']);
        expect(cycleError.message).toContain('A -> B -> C -> A');
      }
    });
  });

  describe('self-reference cycle (A -> A)', () => {
    it('should throw CircularDependencyError', () => {
      registry.register('SelfService', () => {
        // Self-reference
        registry.get('SelfService');
        return { dispose: vi.fn() };
      });

      expect(() => registry.get('SelfService')).toThrow(CircularDependencyError);
    });

    it('should include self-reference in cycle path', () => {
      registry.register('Self', () => {
        registry.get('Self');
        return { dispose: vi.fn() };
      });

      try {
        registry.get('Self');
        expect.fail('Should have thrown CircularDependencyError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const cycleError = error as CircularDependencyError;
        expect(cycleError.cycle).toEqual(['Self', 'Self']);
      }
    });
  });

  describe('initialization stack management', () => {
    it('should clear initialization stack after error', () => {
      registry.register('A', () => {
        // Self-cycle
        registry.get('A');
        return { dispose: vi.fn() };
      });

      expect(() => registry.get('A')).toThrow();
      expect(registry.getInitializationStack()).toEqual([]);
    });

    it('should clear initialization stack on factory error', () => {
      registry.register('ErrorService', () => {
        throw new Error('Factory error');
      });

      expect(() => registry.get('ErrorService')).toThrow('Factory error');
      expect(registry.getInitializationStack()).toEqual([]);
    });

    it('should track initialization stack during creation', () => {
      let capturedStack: readonly string[] = [];

      registry.register('Outer', () => {
        capturedStack = registry.getInitializationStack();
        registry.get('Inner');
        return { dispose: vi.fn() };
      });

      registry.register('Inner', () => {
        return { dispose: vi.fn() };
      });

      registry.get('Outer');
      expect(capturedStack).toEqual(['Outer']);
    });
  });

  describe('non-circular dependencies', () => {
    it('should allow simple dependency chain', () => {
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

    it('should allow diamond dependency (A -> B, A -> C, B -> D, C -> D)', () => {
      registry.register('D', () => ({
        dispose: vi.fn(),
        value: 'D',
      }));

      registry.register('B', () => {
        registry.get('D');
        return { dispose: vi.fn(), value: 'B' };
      });

      registry.register('C', () => {
        registry.get('D');
        return { dispose: vi.fn(), value: 'C' };
      });

      registry.register('A', () => {
        registry.get('B');
        registry.get('C');
        return { dispose: vi.fn(), value: 'A' };
      });

      // Should not throw - diamond is not circular
      expect(() => registry.get('A')).not.toThrow();
    });

    it('should allow accessing same service multiple times', () => {
      let createCount = 0;

      registry.register('Shared', () => {
        createCount++;
        return { dispose: vi.fn(), id: createCount };
      });

      registry.register('Consumer1', () => {
        registry.get('Shared');
        return { dispose: vi.fn() };
      });

      registry.register('Consumer2', () => {
        registry.get('Shared');
        return { dispose: vi.fn() };
      });

      registry.get('Consumer1');
      registry.get('Consumer2');

      // Shared should only be created once
      expect(createCount).toBe(1);
    });
  });

  describe('error codes', () => {
    it('should use E802 error code for circular dependency', () => {
      registry.register('A', () => {
        registry.get('A');
        return { dispose: vi.fn() };
      });

      try {
        registry.get('A');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        expect((error as CircularDependencyError).code).toBe('E802');
      }
    });

    it('should include service name in error', () => {
      registry.register('MyService', () => {
        registry.get('MyService');
        return { dispose: vi.fn() };
      });

      try {
        registry.get('MyService');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        expect((error as CircularDependencyError).serviceName).toBe('MyService');
      }
    });
  });

  describe('registry reset', () => {
    it('should clear initialization stack on reset', () => {
      // Create a service that will throw during initialization
      registry.register('PartialInit', () => {
        // This will throw but we'll catch it
        throw new Error('Stop mid-init');
      });

      try {
        registry.get('PartialInit');
      } catch {
        // Expected
      }

      // Reset should clear everything
      ServiceRegistry.reset();
      registry = ServiceRegistry.getInstance();

      // Fresh registry should have empty stack
      expect(registry.getInitializationStack()).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle very deep dependency chains without circular error', () => {
      const depth = 50;

      for (let i = 0; i < depth; i++) {
        const serviceName = `Service${i}`;
        const nextService = i < depth - 1 ? `Service${i + 1}` : null;

        registry.register(serviceName, () => {
          if (nextService) {
            registry.get(nextService);
          }
          return { dispose: vi.fn(), level: i };
        });
      }

      // Should not throw - just a deep chain, not circular
      expect(() => registry.get('Service0')).not.toThrow();
    });

    it('should detect cycle even in deep chains', () => {
      // A -> B -> C -> D -> E -> A (cycle back to start)
      const services = ['A', 'B', 'C', 'D', 'E'];

      services.forEach((name, i) => {
        // Wraps around
        const nextService = services[(i + 1) % services.length];
        registry.register(name, () => {
          registry.get(nextService);
          return { dispose: vi.fn() };
        });
      });

      expect(() => registry.get('A')).toThrow(CircularDependencyError);
    });
  });
});
