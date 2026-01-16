// packages/extension/errors/error-codes.ts
// centralized error codes enum for consistent error handling

// error codes for all ExtensionError types
// used for programmatic error handling, logging, & user message templates
export enum ErrorCode {
  // Module Fetch errors
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  OUTSIDE_WORKSPACE = 'OUTSIDE_WORKSPACE',
  PARSE_ERROR = 'PARSE_ERROR',
  TRANSFORM_ERROR = 'TRANSFORM_ERROR',

  // Transpile errors
  TRANSPILE_ERROR = 'TRANSPILE_ERROR',

  // Security errors
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  TRUST_VIOLATION = 'TRUST_VIOLATION',

  // Config errors
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',
  CONFIG_VALIDATION_ERROR = 'CONFIG_VALIDATION_ERROR',

  // Plugin errors
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_LOAD_ERROR = 'PLUGIN_LOAD_ERROR',
  PLUGIN_INVALID_EXPORT = 'PLUGIN_INVALID_EXPORT',

  // Tailwind errors
  TAILWIND_COMPILATION_ERROR = 'TAILWIND_COMPILATION_ERROR',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
