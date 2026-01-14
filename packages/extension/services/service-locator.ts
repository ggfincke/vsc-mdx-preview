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
// typed convenience functions for each registered service
// these provide better IntelliSense & type checking than generic getService()
// ============================================================================

// get the ConfigManager singleton - manages VS Code configuration settings for the extension
export function getConfigManager(): ConfigManager {
  return getService<ConfigManager>(ServiceNames.CONFIG_MANAGER);
}

// get the ConfigCache singleton - manages config file caching & watchers
export function getConfigCache(): ConfigCache {
  return getService<ConfigCache>(ServiceNames.CONFIG_CACHE);
}

// get the TrustManager singleton - manages workspace trust state & security mode
export function getTrustManager(): TrustManager {
  return getService<TrustManager>(ServiceNames.TRUST_MANAGER);
}

// get the ThemeManager singleton - manages preview & code block theme settings
export function getThemeManager(): ThemeManager {
  return getService<ThemeManager>(ServiceNames.THEME_MANAGER);
}

// get the PreviewManager singleton - manages webview panels & preview lifecycle
export function getPreviewManager(): PreviewManager {
  return getService<PreviewManager>(ServiceNames.PREVIEW_MANAGER);
}

// get the FrameworkDetector singleton - detects documentation frameworks (Docusaurus, Starlight, etc.)
export function getFrameworkDetector(): FrameworkDetector {
  return getService<FrameworkDetector>(ServiceNames.FRAMEWORK_DETECTOR);
}

// get the TailwindProcessor singleton - handles Tailwind CSS detection, scanning, & compilation
export function getTailwindProcessor(): TailwindProcessor {
  return getService<TailwindProcessor>(ServiceNames.TAILWIND_PROCESSOR);
}

// get the ErrorReporter singleton - centralized error handling & reporting
export function getErrorReporter(): ErrorReporter {
  return getService<ErrorReporter>(ServiceNames.ERROR_REPORTER);
}

// get the StatusBarManager singleton - manages status bar items for trust state & framework display
export function getStatusBarManager(): StatusBarManager {
  return getService<StatusBarManager>(ServiceNames.STATUS_BAR_MANAGER);
}

// get the OutputChannel instance - used for logging messages to the "MDX Preview" output panel
export function getOutputChannel(): OutputChannel {
  // OutputChannel is wrapped in an object to satisfy IService interface
  return ServiceRegistry.getInstance().get<OutputChannelService>(
    ServiceNames.OUTPUT_CHANNEL
  ).channel;
}
