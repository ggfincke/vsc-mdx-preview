// packages/extension-host/src/app/services/ServiceRegistry.ts
// central registry for managing service lifecycle

import type { Disposable } from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { ServiceError, CircularDependencyError } from '../../shared/errors';
import type { IService, ServiceFactory, ServiceRegistration } from '../types';

// module-level tagged logger for service registry
const log = createTaggedLogger(LogTags.SERVICE_REGISTRY);

// subsystem disposal function type
type SubsystemDisposeFn = () => void;

// subsystem registration metadata
interface SubsystemRegistration {
  name: string;
  dispose: SubsystemDisposeFn;
}

// * central registry for managing service lifecycle
// lazy service creation, singleton instances & reverse-order disposal
// compatible w/ existing getInstance() pattern
export class ServiceRegistry implements Disposable {
  private static instance: ServiceRegistry | undefined;
  private services = new Map<string, ServiceRegistration<IService>>();
  private disposed = false;

  // track services currently being initialized (for cycle detection)
  private initializationStack: string[] = [];

  // subsystem registrations for factory singletons & module-level state
  private subsystems = new Map<string, SubsystemRegistration>();

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
      log.debug(`Warning: Overwriting registration for ${name}`);
    }

    // delete-before-set: overwrite re-inserts at Map tail -> fresh disposal order
    this.services.delete(name);
    this.services.set(name, {
      name,
      factory,
      instance: undefined,
    });

    log.debug(`Registered: ${name}`);
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
      log.debug(`Warning: Overwriting subsystem registration for ${name}`);
    }

    // delete-before-set: overwrite re-inserts at Map tail -> fresh disposal order
    this.subsystems.delete(name);
    this.subsystems.set(name, {
      name,
      dispose,
    });

    log.debug(`Registered subsystem: ${name}`);
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
      log.debug(`Creating instance: ${name}`);

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

  // dispose all subsystems & services
  // order: subsystems first (reverse order), then services (reverse order)
  // subsystems depend on services, so they must be disposed first
  dispose(): void {
    if (this.disposed) {
      return;
    }

    log.debug('Starting disposal...');

    // 1. dispose subsystems in reverse registration order (FIRST)
    const reversedSubsystems = Array.from(this.subsystems.values()).reverse();

    for (const subsystem of reversedSubsystems) {
      log.debug(`Disposing subsystem: ${subsystem.name}`);
      try {
        subsystem.dispose();
      } catch (error: unknown) {
        log.debug(`Error disposing subsystem ${subsystem.name}: ${error}`);
      }
    }
    this.subsystems.clear();

    // 2. dispose services in reverse registration order (SECOND)
    const reversedRegistrations = Array.from(this.services.values())
      .filter((reg) => reg.instance !== undefined)
      .reverse();

    for (const registration of reversedRegistrations) {
      log.debug(`Disposing service: ${registration.name}`);
      try {
        registration.instance?.dispose?.();
      } catch (error: unknown) {
        log.debug(`Error disposing service ${registration.name}: ${error}`);
      }
    }

    this.services.clear();
    this.disposed = true;
    log.debug('All subsystems & services disposed');
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
