// packages/extension/nextra/meta-subsystem.ts
// Nextra meta resolver subsystem registration for unified lifecycle management

import { ServiceRegistry } from '../services';
import { disposeMetaWatchers } from './MetaResolver';

export const META_SUBSYSTEM = 'MetaSubsystem';

// register the meta subsystem w/ ServiceRegistry
// call in extension activate() AFTER service registrations
export function registerMetaSubsystem(): void {
  ServiceRegistry.getInstance().registerSubsystem(
    META_SUBSYSTEM,
    disposeMetaWatchers
  );
}
