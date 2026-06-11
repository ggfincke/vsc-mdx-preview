// packages/extension-host/src/app/services/index.ts
// public exports for the service registry system

export { ServiceRegistry } from './ServiceRegistry';
export { ServiceNames, type ServiceName } from './service-names';

// service locator utilities for type-safe service access
export {
  getConfigManager,
  getConfigCache,
  getTrustManager,
  getThemeManager,
  getPreviewManager,
  getFrameworkDetector,
  getTailwindProcessor,
  getErrorReporter,
  getStatusBarManager,
  getMetaResolver,
  getComponentDiagnostics,
} from './service-locator';
