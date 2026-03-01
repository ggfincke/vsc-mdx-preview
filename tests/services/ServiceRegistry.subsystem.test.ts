// tests/services/ServiceRegistry.subsystem.test.ts
// Unit tests for ServiceRegistry subsystem registration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Import after mocks
import { ServiceRegistry } from '../../packages/extension-host/src/app/services/ServiceRegistry';

describe('ServiceRegistry subsystem registration', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    ServiceRegistry.reset();
    registry = ServiceRegistry.getInstance();
  });

  afterEach(() => {
    ServiceRegistry.reset();
    vi.clearAllMocks();
  });

  describe('registerSubsystem', () => {
    it('should register a subsystem', () => {
      const disposeFn = vi.fn();
      registry.registerSubsystem('TestSubsystem', disposeFn);

      // Disposing the registry should call the subsystem's dispose function
      registry.dispose();
      expect(disposeFn).toHaveBeenCalledOnce();
    });

  });

  describe('disposal order', () => {
    it('should dispose subsystems in reverse registration order', () => {
      const disposalOrder: string[] = [];

      registry.registerSubsystem('First', () => {
        disposalOrder.push('First');
      });
      registry.registerSubsystem('Second', () => {
        disposalOrder.push('Second');
      });
      registry.registerSubsystem('Third', () => {
        disposalOrder.push('Third');
      });

      registry.dispose();

      // should be disposed in reverse order: Third, Second, First
      expect(disposalOrder).toEqual(['Third', 'Second', 'First']);
    });

    it('should dispose subsystems BEFORE services', () => {
      const disposalOrder: string[] = [];

      // register a service first
      registry.register('ServiceA', () => ({
        dispose: () => {
          disposalOrder.push('ServiceA');
        },
      }));

      // register a subsystem
      registry.registerSubsystem('SubsystemA', () => {
        disposalOrder.push('SubsystemA');
      });

      // register another service
      registry.register('ServiceB', () => ({
        dispose: () => {
          disposalOrder.push('ServiceB');
        },
      }));

      // initialize services
      registry.get('ServiceA');
      registry.get('ServiceB');

      registry.dispose();

      // subsystems should be disposed first, then services (both in reverse order)
      expect(disposalOrder).toEqual(['SubsystemA', 'ServiceB', 'ServiceA']);
    });

  });

  describe('error handling', () => {
    it('should continue disposing other subsystems after one throws', () => {
      const disposalOrder: string[] = [];

      registry.registerSubsystem('First', () => {
        disposalOrder.push('First');
      });
      registry.registerSubsystem('ThrowingSubsystem', () => {
        disposalOrder.push('Throwing');
        throw new Error('Subsystem error');
      });
      registry.registerSubsystem('Third', () => {
        disposalOrder.push('Third');
      });

      // should not throw, but should continue disposing
      expect(() => registry.dispose()).not.toThrow();

      // all subsystems should have been called (reverse order)
      expect(disposalOrder).toEqual(['Third', 'Throwing', 'First']);
    });

  });
});
