// packages/extension/errors/error-codes.ts
// centralized error codes enum for consistent error handling
//
// error code structure follows numeric prefixes by category:
// - E001-E099: Trust & Security
// - E100-E199: Module Fetch
// - E200-E299: Configuration
// - E300-E399: Transpilation
// - E400-E499: Plugin
// - E500-E599: Tailwind
// - E600-E699: Webview
// - E700-E799: File I/O
// - E800-E899: Service
// - E900-E999: General

// error codes for all ExtensionError types
// used for programmatic error handling, logging, & user message templates
export enum ErrorCode {
  // =========================================================================
  // trust & security errors (E001-E099)
  // =========================================================================
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  PATH_INVALID = 'E002',
  TRUST_VIOLATION = 'TRUST_VIOLATION',
  TRUST_WORKSPACE_UNTRUSTED = 'E021',
  TRUST_SCRIPTS_DISABLED = 'E022',
  TRUST_REMOTE_DOCUMENT = 'E023',

  // =========================================================================
  // module fetch errors (E100-E199)
  // =========================================================================
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  OUTSIDE_WORKSPACE = 'OUTSIDE_WORKSPACE',
  MODULE_CIRCULAR_DEPENDENCY = 'E102',
  PARSE_ERROR = 'PARSE_ERROR',
  TRANSFORM_ERROR = 'TRANSFORM_ERROR',
  MODULE_FETCH_IO_ERROR = 'E162',

  // =========================================================================
  // configuration errors (E200-E299)
  // =========================================================================
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',
  CONFIG_FILE_NOT_FOUND = 'E201',
  CONFIG_VALIDATION_ERROR = 'CONFIG_VALIDATION_ERROR',
  CONFIG_PLUGIN_SPEC_INVALID = 'E221',
  CONFIG_COMPONENT_MAPPING_INVALID = 'E222',

  // =========================================================================
  // transpilation errors (E300-E399)
  // =========================================================================
  TRANSPILE_ERROR = 'TRANSPILE_ERROR',
  MDX_FRONTMATTER_ERROR = 'E301',
  BABEL_TRANSPILE_ERROR = 'E320',

  // =========================================================================
  // plugin errors (E400-E499)
  // =========================================================================
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_LOAD_ERROR = 'PLUGIN_LOAD_ERROR',
  PLUGIN_INVALID_EXPORT = 'PLUGIN_INVALID_EXPORT',
  PLUGIN_SAFE_MODE_BLOCKED = 'E460',

  // =========================================================================
  // tailwind errors (E500-E599)
  // =========================================================================
  TAILWIND_NOT_INSTALLED = 'E500',
  TAILWIND_VERSION_UNSUPPORTED = 'E501',
  TAILWIND_VERSION_DEPRECATED = 'E502',
  TAILWIND_CONFIG_NOT_FOUND = 'E520',
  TAILWIND_COMPILATION_ERROR = 'TAILWIND_COMPILATION_ERROR',
  TAILWIND_INVALID_PLUGIN = 'E562',

  // =========================================================================
  // webview errors (E600-E699)
  // =========================================================================
  WEBVIEW_MANIFEST_ERROR = 'E600',
  WEBVIEW_HANDSHAKE_TIMEOUT = 'E620',
  WEBVIEW_RPC_ERROR = 'E640',

  // =========================================================================
  // file I/O errors (E700-E799)
  // =========================================================================
  FILE_READ_ERROR = 'E700',
  FILE_NOT_FOUND = 'E701',
  WATCHER_CREATE_ERROR = 'E740',

  // =========================================================================
  // service errors (E800-E899)
  // =========================================================================
  SERVICE_NOT_REGISTERED = 'E800',
  SERVICE_ALREADY_DISPOSED = 'E801',

  // =========================================================================
  // general errors (E900-E999)
  // =========================================================================
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'E901',
}
