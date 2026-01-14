// packages/extension/test/ServiceRegistry.test.ts
// unit tests for ServiceRegistry

import { describe, it, expect, afterEach, vi } from 'vitest';
import { ServiceRegistry } from '../services/ServiceRegistry';

describe('ServiceRegistry', () => {
  afterEach(() => {
    ServiceRegistry.reset();
  });

  it('returns same instance (singleton)', () => {
    const r1 = ServiceRegistry.getInstance();
    const r2 = ServiceRegistry.getInstance();
    expect(r1).toBe(r2);
  });

  it('lazily creates service instances', () => {
    const registry = ServiceRegistry.getInstance();
    const factory = vi.fn(() => ({ dispose: vi.fn() }));

    registry.register('TestService', factory);
    expect(factory).not.toHaveBeenCalled();

    registry.get('TestService');
    expect(factory).toHaveBeenCalledOnce();

    registry.get('TestService');
    expect(factory).toHaveBeenCalledOnce(); // Not called again
  });

  it('disposes services in reverse registration order', () => {
    const registry = ServiceRegistry.getInstance();
    const disposeOrder: string[] = [];

    registry.register('First', () => ({
      dispose: () => disposeOrder.push('First'),
    }));
    registry.register('Second', () => ({
      dispose: () => disposeOrder.push('Second'),
    }));
    registry.register('Third', () => ({
      dispose: () => disposeOrder.push('Third'),
    }));

    // Initialize all services
    registry.get('First');
    registry.get('Second');
    registry.get('Third');

    registry.dispose();

    expect(disposeOrder).toEqual(['Third', 'Second', 'First']);
  });

  it('only disposes initialized services', () => {
    const registry = ServiceRegistry.getInstance();
    const dispose = vi.fn();

    registry.register('Initialized', () => ({ dispose }));
    registry.register('NotInitialized', () => ({ dispose }));

    registry.get('Initialized'); // Only initialize this one

    registry.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('handles services without dispose method', () => {
    const registry = ServiceRegistry.getInstance();

    registry.register('NoDispose', () => ({})); // No dispose method
    registry.get('NoDispose');

    expect(() => registry.dispose()).not.toThrow();
  });

  it('throws error when getting unregistered service', () => {
    const registry = ServiceRegistry.getInstance();

    expect(() => registry.get('NonExistent')).toThrow(
      'Service not registered: NonExistent'
    );
  });

  it('reports whether service is registered', () => {
    const registry = ServiceRegistry.getInstance();

    registry.register('TestService', () => ({}));

    expect(registry.has('TestService')).toBe(true);
    expect(registry.has('NonExistent')).toBe(false);
  });

  it('reports whether service is initialized', () => {
    const registry = ServiceRegistry.getInstance();

    registry.register('TestService', () => ({}));

    expect(registry.isInitialized('TestService')).toBe(false);

    registry.get('TestService');

    expect(registry.isInitialized('TestService')).toBe(true);
  });

  it('throws error when registering on disposed registry', () => {
    const registry = ServiceRegistry.getInstance();
    registry.dispose();

    expect(() => registry.register('Test', () => ({}))).toThrow(
      'Cannot register service on disposed registry'
    );
  });

  it('throws error when getting from disposed registry', () => {
    const registry = ServiceRegistry.getInstance();
    registry.register('TestService', () => ({}));
    registry.dispose();

    expect(() => registry.get('TestService')).toThrow(
      'Cannot get service from disposed registry'
    );
  });

  it('handles errors during disposal gracefully', () => {
    const registry = ServiceRegistry.getInstance();

    registry.register('ThrowsOnDispose', () => ({
      dispose: () => {
        throw new Error('Disposal error');
      },
    }));
    registry.register('NormalService', () => ({
      dispose: vi.fn(),
    }));

    // Initialize both
    registry.get('ThrowsOnDispose');
    registry.get('NormalService');

    // Should not throw even if one service fails to dispose
    expect(() => registry.dispose()).not.toThrow();
  });

  it('static reset disposes and clears instance', () => {
    const registry1 = ServiceRegistry.getInstance();
    const dispose = vi.fn();
    registry1.register('TestService', () => ({ dispose }));
    registry1.get('TestService');

    ServiceRegistry.reset();

    expect(dispose).toHaveBeenCalledOnce();

    // New instance should be fresh
    const registry2 = ServiceRegistry.getInstance();
    expect(registry2).not.toBe(registry1);
    expect(registry2.has('TestService')).toBe(false);
  });
});
