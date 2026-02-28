// packages/extension-host/src/app/services/types.ts
// type definitions for the service registry system

// interface that all managed services must implement
// services can optionally have a dispose method for cleanup
export interface IService {
  dispose?(): void;
}

// service factory function type - returns a singleton instance of the service
export type ServiceFactory<T extends IService> = () => T;

// service registration metadata stored in the registry
export interface ServiceRegistration<T extends IService> {
  name: string;
  factory: ServiceFactory<T>;
  instance?: T;
  registrationOrder: number;
}
