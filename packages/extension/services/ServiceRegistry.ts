// packages/extension/services/ServiceRegistry.ts
// central registry for managing service lifecycle

import type { Disposable } from 'vscode';
import { debug } from '../logging';
import { ServiceError, CircularDependencyError } from '../errors';
import type { IService, ServiceFactory, ServiceRegistration } from './types';

// * central registry for managing service lifecycle
// key features:
// - lazy initialization: services are created on first access
// - dependency ordering: services disposed in reverse registration order
// - singleton pattern: each service type has one instance
// - backward compatible: works alongside existing getInstance() pattern
export class ServiceRegistry implements Disposable {
  private static instance: ServiceRegistry | undefined;
  private services = new Map<string, ServiceRegistration<IService>>();
  private registrationCounter = 0;
  private disposed = false;

  // track services currently being initialized (for cycle detection)
  private initializationStack: string[] = [];

  private constructor() {}

  // get the singleton ServiceRegistry instance
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // register a service factory (called lazily on first access)
  register<T extends IService>(name: string, factory: ServiceFactory<T>): void {
    if (this.disposed) {
      throw new ServiceError(
        'Cannot register service on disposed registry',
        'E801'
      );
    }

    if (this.services.has(name)) {
      debug(`[SERVICE-REGISTRY] Warning: Overwriting registration for ${name}`);
    }

    this.services.set(name, {
      name,
      factory,
      instance: undefined,
      registrationOrder: this.registrationCounter++,
    });

    debug(`[SERVICE-REGISTRY] Registered: ${name}`);
  }

  // get a service instance by name (creates on first access via lazy initialization)
  get<T extends IService>(name: string): T {
    if (this.disposed) {
      throw new ServiceError(
        'Cannot get service from disposed registry',
        'E801'
      );
    }

    const registration = this.services.get(name);
    if (!registration) {
      throw new ServiceError(`Service not registered: ${name}`, 'E800', name);
    }

    // check for circular dependency
    if (this.initializationStack.includes(name)) {
      // build the cycle path for clear error reporting
      const cycleStart = this.initializationStack.indexOf(name);
      const cycle = [...this.initializationStack.slice(cycleStart), name];
      throw new CircularDependencyError(cycle);
    }

    // lazy initialization with cycle tracking
    if (!registration.instance) {
      debug(`[SERVICE-REGISTRY] Creating instance: ${name}`);

      // push onto stack before initialization
      this.initializationStack.push(name);

      try {
        registration.instance = registration.factory();
      } finally {
        // always pop from stack, even on error
        this.initializationStack.pop();
      }
    }

    return registration.instance as T;
  }

  // check if a service is registered
  has(name: string): boolean {
    return this.services.has(name);
  }

  // check if a service instance has been created
  isInitialized(name: string): boolean {
    return this.services.get(name)?.instance !== undefined;
  }

  // get the current initialization stack (for testing/diagnostics)
  getInitializationStack(): readonly string[] {
    return [...this.initializationStack];
  }

  // dispose all services in reverse registration order
  // ensures dependent services are disposed before their dependencies
  dispose(): void {
    if (this.disposed) {
      return;
    }

    debug('[SERVICE-REGISTRY] Starting disposal...');

    // sort by registration order descending (reverse order)
    const sortedRegistrations = Array.from(this.services.values())
      .filter((reg) => reg.instance !== undefined)
      .sort((a, b) => b.registrationOrder - a.registrationOrder);

    for (const registration of sortedRegistrations) {
      debug(`[SERVICE-REGISTRY] Disposing: ${registration.name}`);
      try {
        registration.instance?.dispose?.();
      } catch (error) {
        debug(
          `[SERVICE-REGISTRY] Error disposing ${registration.name}: ${error}`
        );
      }
    }

    this.services.clear();
    this.disposed = true;
    debug('[SERVICE-REGISTRY] All services disposed');
  }

  // reset the registry (for testing) - disposes all services & clears registrations
  static reset(): void {
    if (ServiceRegistry.instance) {
      ServiceRegistry.instance.initializationStack = [];
      ServiceRegistry.instance.dispose();
      ServiceRegistry.instance = undefined;
    }
  }
}
