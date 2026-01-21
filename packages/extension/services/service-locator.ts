// packages/extension/services/service-locator.ts
// Type-safe service access helpers for the ServiceRegistry

import { ServiceRegistry } from './ServiceRegistry';
import { ServiceNames, type ServiceName } from './service-names';
import type { IService } from './types';

// Import service types for typed convenience functions
import type { ConfigManager } from '../config/ConfigManager';
import type { ConfigCache } from '../config/ConfigCache';
import type { TrustManager } from '../security/TrustManager';
import type { ThemeManager } from '../themes/ThemeManager';
import type { PreviewManager } from '../preview/preview-manager';
import type { FrameworkDetector } from '../framework/FrameworkDetector';
import type { TailwindProcessor } from '../tailwind/TailwindProcessor';
import type { ErrorReporter } from '../errors/ErrorReporter';
import type { StatusBarManager } from '../preview/StatusBarManager';
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

// ============================================================================
// Service Getter Factory
// Creates typed getter functions for registered services
// ============================================================================

// factory for creating service getter functions
// reduces boilerplate for standard getter pattern
function createServiceGetter<T extends IService>(name: ServiceName): () => T {
  return () => ServiceRegistry.getInstance().get<T>(name);
}

// ============================================================================
// Typed Convenience Functions
// These provide better IntelliSense & type checking than generic getService()
// ============================================================================

// ConfigManager - manages VS Code configuration settings for the extension
export const getConfigManager = createServiceGetter<ConfigManager>(ServiceNames.CONFIG_MANAGER);

// ConfigCache - manages config file caching & watchers
export const getConfigCache = createServiceGetter<ConfigCache>(ServiceNames.CONFIG_CACHE);

// TrustManager - manages workspace trust state & security mode
export const getTrustManager = createServiceGetter<TrustManager>(ServiceNames.TRUST_MANAGER);

// ThemeManager - manages preview & code block theme settings
export const getThemeManager = createServiceGetter<ThemeManager>(ServiceNames.THEME_MANAGER);

// PreviewManager - manages webview panels & preview lifecycle
export const getPreviewManager = createServiceGetter<PreviewManager>(ServiceNames.PREVIEW_MANAGER);

// FrameworkDetector - detects documentation frameworks (Docusaurus, Starlight, etc.)
export const getFrameworkDetector = createServiceGetter<FrameworkDetector>(ServiceNames.FRAMEWORK_DETECTOR);

// TailwindProcessor - handles Tailwind CSS detection, scanning, & compilation
export const getTailwindProcessor = createServiceGetter<TailwindProcessor>(ServiceNames.TAILWIND_PROCESSOR);

// ErrorReporter - centralized error handling & reporting
export const getErrorReporter = createServiceGetter<ErrorReporter>(ServiceNames.ERROR_REPORTER);

// StatusBarManager - manages status bar items for trust state & framework display
export const getStatusBarManager = createServiceGetter<StatusBarManager>(ServiceNames.STATUS_BAR_MANAGER);

// get the OutputChannel instance - used for logging messages to the "MDX Preview" output panel
export function getOutputChannel(): OutputChannel {
  // OutputChannel is wrapped in an object to satisfy IService interface
  return ServiceRegistry.getInstance().get<OutputChannelService>(
    ServiceNames.OUTPUT_CHANNEL
  ).channel;
}
