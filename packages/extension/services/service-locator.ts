// packages/extension/services/service-locator.ts
// type-safe service access helpers for ServiceRegistry
//
// PREFERRED ACCESS PATTERN FOR SERVICES
//
// provide the RECOMMENDED way to access services throughout
// the extension. Use these typed getter functions instead of
// - Direct getInstance() calls (use only within the service class itself)
// - ServiceRegistry.get() (use only for dynamic/advanced access patterns)
//
// USAGE
// ```typescript
// import { getConfigManager, getTrustManager } from './services';
//
// const config = getConfigManager();
// const updateMode = config.get('preview.updateMode');
//
// const trustState = getTrustManager().getState();
// if (trustState.canExecute) {
//   // proceed w/ trusted operation
// }
// ```
//
// WHY USE SERVICE LOCATOR FUNCTIONS
// 1. Type safety - each getter returns the correct service type
// 2. Lazy initialization - services created on first access
// 3. Decoupling - consuming code doesn't depend on service implementation
// 4. Testability - services can be mocked via ServiceRegistry
//
// for more details, see: packages/extension/services/ARCHITECTURE.md

import { ServiceRegistry } from './ServiceRegistry';
import { ServiceNames, type ServiceName } from './service-names';
import type { IService } from '../types';

// import service types for typed convenience functions
import type { ConfigManager } from '../config/ConfigManager';
import type { ConfigCache } from '../config/ConfigCache';
import type { TrustManager } from '../security/TrustManager';
import type { ThemeManager } from '../themes/ThemeManager';
import type { PreviewManager } from '../preview/preview-manager';
import type { FrameworkDetector } from '../framework/FrameworkDetector';
import type { TailwindProcessor } from '../tailwind/TailwindProcessor';
import type { ErrorReporter } from '../errors/ErrorReporter';
import type { StatusBarManager } from '../preview/StatusBarManager';
import type { MetaResolver } from '../nextra/MetaResolver';
import type { OutputChannel } from 'vscode';

// wrapper interface for OutputChannel to satisfy IService
interface OutputChannelService extends IService {
  channel: OutputChannel;
  dispose(): void;
}

// generic service accessor
// use typed convenience functions below for better type safety
export function getService<T extends IService>(name: ServiceName): T {
  return ServiceRegistry.getInstance().get<T>(name);
}

// check if a service is registered (useful for conditional access w/o throwing errors)
export function hasService(name: ServiceName): boolean {
  return ServiceRegistry.getInstance().has(name);
}

// check if a service has been initialized (factory called)
export function isServiceInitialized(name: ServiceName): boolean {
  return ServiceRegistry.getInstance().isInitialized(name);
}

// service getter factory
// create typed getter functions for registered services

// factory for creating service getter functions
// reduce boilerplate for standard getter pattern
function createServiceGetter<T extends IService>(name: ServiceName): () => T {
  return () => ServiceRegistry.getInstance().get<T>(name);
}

// typed service getters (preferred)
// these provide better IntelliSense & type checking than generic getService()
// import & use these in your code
// import { getConfigManager, getTrustManager } from './services';

// get the ConfigManager service - manages VS Code configuration settings for the extension
export const getConfigManager = createServiceGetter<ConfigManager>(
  ServiceNames.CONFIG_MANAGER
);

// get the ConfigCache service - manages config file caching & watchers
export const getConfigCache = createServiceGetter<ConfigCache>(
  ServiceNames.CONFIG_CACHE
);

// get the TrustManager service - manages workspace trust state & security mode
export const getTrustManager = createServiceGetter<TrustManager>(
  ServiceNames.TRUST_MANAGER
);

// get the ThemeManager service - manages preview & code block theme settings
export const getThemeManager = createServiceGetter<ThemeManager>(
  ServiceNames.THEME_MANAGER
);

// get the PreviewManager service - manages webview panels & preview lifecycle
export const getPreviewManager = createServiceGetter<PreviewManager>(
  ServiceNames.PREVIEW_MANAGER
);

// get the FrameworkDetector service - detects documentation frameworks (Docusaurus, Starlight, etc.)
export const getFrameworkDetector = createServiceGetter<FrameworkDetector>(
  ServiceNames.FRAMEWORK_DETECTOR
);

// get the TailwindProcessor service - handles Tailwind CSS detection, scanning, & compilation
export const getTailwindProcessor = createServiceGetter<TailwindProcessor>(
  ServiceNames.TAILWIND_PROCESSOR
);

// get the ErrorReporter service - centralized error handling & reporting
export const getErrorReporter = createServiceGetter<ErrorReporter>(
  ServiceNames.ERROR_REPORTER
);

// get the StatusBarManager service - manages status bar items for trust state & framework display
export const getStatusBarManager = createServiceGetter<StatusBarManager>(
  ServiceNames.STATUS_BAR_MANAGER
);

// get the MetaResolver service - resolves Nextra _meta.json page-level settings
export const getMetaResolver = createServiceGetter<MetaResolver>(
  ServiceNames.META_RESOLVER
);

// get the OutputChannel instance - used for logging messages to the "MDX Preview" output panel
// note: OutputChannel is wrapped internally to satisfy IService interface requirements
export function getOutputChannel(): OutputChannel {
  return ServiceRegistry.getInstance().get<OutputChannelService>(
    ServiceNames.OUTPUT_CHANNEL
  ).channel;
}
