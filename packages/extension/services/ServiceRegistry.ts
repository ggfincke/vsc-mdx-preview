// packages/extension/services/ServiceRegistry.ts
// central registry for managing service lifecycle

import type { Disposable } from 'vscode';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { ServiceError, CircularDependencyError } from '../errors';
import type { IService, ServiceFactory, ServiceRegistration } from '../types';

// subsystem disposal function type
type SubsystemDisposeFn = () => void;

// subsystem registration metadata
interface SubsystemRegistration {
  name: string;
  dispose: SubsystemDisposeFn;
  registrationOrder: number;
}

// * central registry for managing service lifecycle
// key features:
// - lazy initialization: services are created on first access
// - dependency ordering: services disposed in reverse registration order
// - singleton pattern: each service type has one instance
// - compatible w/ existing getInstance() pattern
export class ServiceRegistry implements Disposable {
  private static instance: ServiceRegistry | undefined;
  private services = new Map<string, ServiceRegistration<IService>>();
  private registrationCounter = 0;
  private disposed = false;

  // track services currently being initialized (for cycle detection)
  private initializationStack: string[] = [];

  // subsystem registrations for factory singletons & module-level state
  private subsystems = new Map<string, SubsystemRegistration>();
  private subsystemCounter = 0;

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
      debug(
        `[${LogTags.SERVICE_REGISTRY}] Warning: Overwriting registration for ${name}`
      );
    }

    this.services.set(name, {
      name,
      factory,
      instance: undefined,
      registrationOrder: this.registrationCounter++,
    });

    debug(`[${LogTags.SERVICE_REGISTRY}] Registered: ${name}`);
  }

  // register a subsystem w/ disposal function
  // subsystems are disposed BEFORE services (reverse registration order)
  // use for factory singletons & module-level state that need cleanup
  registerSubsystem(name: string, dispose: SubsystemDisposeFn): void {
    if (this.disposed) {
      throw new ServiceError(
        'Cannot register subsystem on disposed registry',
        'E801'
      );
    }

    if (this.subsystems.has(name)) {
      debug(
        `[${LogTags.SERVICE_REGISTRY}] Warning: Overwriting subsystem registration for ${name}`
      );
    }

    this.subsystems.set(name, {
      name,
      dispose,
      registrationOrder: this.subsystemCounter++,
    });

    debug(`[${LogTags.SERVICE_REGISTRY}] Registered subsystem: ${name}`);
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

    // lazy initialization w/ cycle tracking
    if (!registration.instance) {
      debug(`[${LogTags.SERVICE_REGISTRY}] Creating instance: ${name}`);

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

  // dispose all subsystems & services
  // order: subsystems first (reverse order), then services (reverse order)
  // subsystems depend on services, so they must be disposed first
  dispose(): void {
    if (this.disposed) {
      return;
    }

    debug(`[${LogTags.SERVICE_REGISTRY}] Starting disposal...`);

    // 1. dispose subsystems in reverse registration order (FIRST)
    const sortedSubsystems = Array.from(this.subsystems.values()).sort(
      (a, b) => b.registrationOrder - a.registrationOrder
    );

    for (const subsystem of sortedSubsystems) {
      debug(
        `[${LogTags.SERVICE_REGISTRY}] Disposing subsystem: ${subsystem.name}`
      );
      try {
        subsystem.dispose();
      } catch (error) {
        debug(
          `[${LogTags.SERVICE_REGISTRY}] Error disposing subsystem ${subsystem.name}: ${error}`
        );
      }
    }
    this.subsystems.clear();

    // 2. dispose services in reverse registration order (SECOND)
    const sortedRegistrations = Array.from(this.services.values())
      .filter((reg) => reg.instance !== undefined)
      .sort((a, b) => b.registrationOrder - a.registrationOrder);

    for (const registration of sortedRegistrations) {
      debug(
        `[${LogTags.SERVICE_REGISTRY}] Disposing service: ${registration.name}`
      );
      try {
        registration.instance?.dispose?.();
      } catch (error) {
        debug(
          `[${LogTags.SERVICE_REGISTRY}] Error disposing service ${registration.name}: ${error}`
        );
      }
    }

    this.services.clear();
    this.disposed = true;
    debug(`[${LogTags.SERVICE_REGISTRY}] All subsystems & services disposed`);
  }

  // reset the registry (for testing) - disposes all subsystems & services, clears registrations
  static reset(): void {
    if (ServiceRegistry.instance) {
      ServiceRegistry.instance.initializationStack = [];
      // dispose() already clears subsystems & services
      ServiceRegistry.instance.dispose();
      ServiceRegistry.instance = undefined;
    }
  }
}
