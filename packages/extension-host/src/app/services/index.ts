// packages/extension-host/src/app/services/index.ts
// public exports for the service registry system

export { ServiceRegistry } from './ServiceRegistry';
export { ServiceNames, type ServiceName } from './service-names';

// service locator utilities for type-safe service access
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
  getMetaResolver,
  getComponentDiagnostics,
  getOutputChannel,
} from './service-locator';
