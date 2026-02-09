// tests/services/ServiceRegistry.subsystem.test.ts
// Unit tests for ServiceRegistry subsystem registration

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}));

// Mock logging
vi.mock('../../packages/extension-host/src/shared/logging/logger', () => ({
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
import { ServiceRegistry } from '../../packages/extension-host/src/app/services/ServiceRegistry';
import { ServiceError } from '../../packages/extension-host/src/shared/errors';

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

    it('should throw when registering on disposed registry', () => {
      registry.dispose();

      expect(() => {
        registry.registerSubsystem('TestSubsystem', vi.fn());
      }).toThrow(ServiceError);
    });

    it('should allow overwriting subsystem registration', () => {
      const firstDispose = vi.fn();
      const secondDispose = vi.fn();

      registry.registerSubsystem('TestSubsystem', firstDispose);
      registry.registerSubsystem('TestSubsystem', secondDispose);

      registry.dispose();

      // only the second dispose should be called
      expect(firstDispose).not.toHaveBeenCalled();
      expect(secondDispose).toHaveBeenCalledOnce();
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

    it('should dispose multiple subsystems before multiple services', () => {
      const disposalOrder: string[] = [];

      // register services
      registry.register('Service1', () => ({
        dispose: () => disposalOrder.push('Service1'),
      }));
      registry.register('Service2', () => ({
        dispose: () => disposalOrder.push('Service2'),
      }));

      // register subsystems
      registry.registerSubsystem('Subsystem1', () => {
        disposalOrder.push('Subsystem1');
      });
      registry.registerSubsystem('Subsystem2', () => {
        disposalOrder.push('Subsystem2');
      });

      // initialize services
      registry.get('Service1');
      registry.get('Service2');

      registry.dispose();

      // subsystems first (reverse order), then services (reverse order)
      expect(disposalOrder).toEqual([
        'Subsystem2',
        'Subsystem1',
        'Service2',
        'Service1',
      ]);
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

    it('should continue disposing services after subsystem throws', () => {
      const disposalOrder: string[] = [];

      registry.register('ServiceA', () => ({
        dispose: () => disposalOrder.push('ServiceA'),
      }));

      registry.registerSubsystem('ThrowingSubsystem', () => {
        disposalOrder.push('Throwing');
        throw new Error('Subsystem error');
      });

      registry.get('ServiceA');
      registry.dispose();

      // both subsystem & service should have been called
      expect(disposalOrder).toEqual(['Throwing', 'ServiceA']);
    });
  });

  describe('reset', () => {
    it('should clear subsystems on reset', () => {
      const disposeFn = vi.fn();

      registry.registerSubsystem('TestSubsystem', disposeFn);

      // reset clears everything & disposes
      ServiceRegistry.reset();
      expect(disposeFn).toHaveBeenCalledOnce();

      // get fresh registry & verify subsystem is gone
      registry = ServiceRegistry.getInstance();

      // disposing again should not call the old dispose function
      vi.clearAllMocks();
      registry.dispose();
      expect(disposeFn).not.toHaveBeenCalled();
    });
  });

  describe('idempotent disposal', () => {
    it('should only dispose subsystems once', () => {
      const disposeFn = vi.fn();

      registry.registerSubsystem('TestSubsystem', disposeFn);

      registry.dispose();
      registry.dispose();
      registry.dispose();

      expect(disposeFn).toHaveBeenCalledOnce();
    });
  });
});
