// packages/extension/services/index.ts
// Public exports for the service registry system

export { ServiceRegistry } from './ServiceRegistry';
export { ServiceNames, type ServiceName } from './service-names';
export type { IService, ServiceFactory, ServiceRegistration } from './types';

// Service locator utilities for type-safe service access
export {
  getService,
  hasService,
  isServiceInitialized,
  getConfigManager,
  getConfigCache,
  getTrustManager,
  getThemeManager,
  getPreviewManager,
  getFrameworkDetector,
  getTailwindProcessor,
  getErrorReporter,
  getStatusBarManager,
  getOutputChannel,
} from './service-locator';
