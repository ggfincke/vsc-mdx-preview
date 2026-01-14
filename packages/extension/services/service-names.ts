// packages/extension/services/service-names.ts
// constants for service identifiers used in the registry

// service name constants for type-safe registry access
// services are registered in dependency order (dependencies first)
export const ServiceNames = {
  // services w/ no dependencies
  CONFIG_MANAGER: 'ConfigManager',
  CONFIG_CACHE: 'ConfigCache',
  TRUST_MANAGER: 'TrustManager',
  THEME_MANAGER: 'ThemeManager',
  PREVIEW_MANAGER: 'PreviewManager',
  FRAMEWORK_DETECTOR: 'FrameworkDetector',
  TAILWIND_PROCESSOR: 'TailwindProcessor',
  ERROR_REPORTER: 'ErrorReporter',
  OUTPUT_CHANNEL: 'OutputChannel',

  // services w/ dependencies (disposed first)
  STATUS_BAR_MANAGER: 'StatusBarManager',
} as const;

export type ServiceName = (typeof ServiceNames)[keyof typeof ServiceNames];
