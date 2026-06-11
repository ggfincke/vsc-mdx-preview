// packages/extension-host/src/app/services/service-names.ts
// constants for service identifiers used in the registry

// service name constants for type-safe registry access
// listed in registration order; disposal runs in reverse (last registered disposed first)
export const ServiceNames = {
  // services w/ no dependencies (registered first, disposed last)
  CONFIG_MANAGER: 'ConfigManager',
  CONFIG_CACHE: 'ConfigCache',
  TRUST_MANAGER: 'TrustManager',
  THEME_MANAGER: 'ThemeManager',
  PREVIEW_MANAGER: 'PreviewManager',
  FRAMEWORK_DETECTOR: 'FrameworkDetector',
  TAILWIND_PROCESSOR: 'TailwindProcessor',
  ERROR_REPORTER: 'ErrorReporter',

  // services w/ dependencies (registered last, disposed first)
  STATUS_BAR_MANAGER: 'StatusBarManager',
  COMPONENT_DIAGNOSTICS: 'ComponentDiagnostics',
  META_RESOLVER: 'MetaResolver',
} as const;

export type ServiceName = (typeof ServiceNames)[keyof typeof ServiceNames];
