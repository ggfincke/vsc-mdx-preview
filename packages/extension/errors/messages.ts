// packages/extension/errors/messages.ts
// user-friendly error message templates & formatting

import type { ExtensionError } from './index';

// message templates w/ {placeholder} syntax
// ! Placeholders must match actual field names on error classes
const USER_MESSAGES: Record<string, string> = {
  // ===========================================================================
  // trust & security errors
  // ===========================================================================
  PATH_TRAVERSAL: "Access denied: '{attemptedPath}' is outside workspace",
  E002: "Invalid path format: '{attemptedPath}'",
  TRUST_VIOLATION:
    'Operation blocked - workspace not trusted or scripts disabled',
  E021: 'Workspace is not trusted. Trust this workspace to enable Trusted Mode.',
  E022: "Scripts are disabled. Enable 'mdx-preview.preview.enableScripts' in settings.",
  E023: 'Remote environment detected. Trusted Mode requires local workspaces.',

  // ===========================================================================
  // module fetch errors (uses modulePath & parentModule)
  // ===========================================================================
  MODULE_NOT_FOUND:
    "Cannot find module '{modulePath}'. Did you run npm install?",
  OUTSIDE_WORKSPACE: "Cannot access '{modulePath}' - outside workspace folders",
  E102: "Circular dependency detected: '{modulePath}'",
  PARSE_ERROR: "Syntax error in '{modulePath}'",
  TRANSFORM_ERROR: "Failed to compile '{modulePath}'",
  E162: "Failed to read module file: '{modulePath}'",

  // ===========================================================================
  // configuration errors (uses configPath)
  // ===========================================================================
  CONFIG_PARSE_ERROR: "Failed to parse config file '{configPath}'",
  E201: "Config file not found: '{configPath}'",
  CONFIG_VALIDATION_ERROR: "Invalid configuration in '{configPath}'",
  E221: 'Invalid plugin specification in config',
  E222: 'Invalid component mapping in config',

  // ===========================================================================
  // transpilation errors (uses sourceFile, line, column)
  // ===========================================================================
  TRANSPILE_ERROR: "Compilation error in '{sourceFile}' at line {line}",
  E301: "Invalid frontmatter in '{sourceFile}'",
  E320: "Babel transform failed for '{sourceFile}'",

  // ===========================================================================
  // plugin errors (uses pluginName)
  // ===========================================================================
  PLUGIN_NOT_FOUND: "Cannot find plugin '{pluginName}'. Ensure it's installed.",
  PLUGIN_LOAD_ERROR: "Failed to load plugin '{pluginName}'",
  PLUGIN_INVALID_EXPORT:
    "Plugin '{pluginName}' does not export a valid function",
  E460: 'Custom plugins are blocked in Safe Mode',

  // ===========================================================================
  // tailwind errors (uses phase)
  // ===========================================================================
  E500: 'Tailwind CSS not installed in workspace',
  E501: 'Tailwind version not supported. Minimum: v3',
  E502: 'Tailwind CSS v3 is deprecated. Upgrade to v4 for improved performance.',
  E520: 'Tailwind config not found',
  TAILWIND_COMPILATION_ERROR: 'Tailwind CSS compilation failed',
  E562: 'Invalid Tailwind PostCSS plugin',

  // ===========================================================================
  // webview errors (uses phase)
  // ===========================================================================
  E600: 'Could not find Vite manifest in extension',
  E620: 'Preview initialization timed out',
  E640: 'Failed to communicate with preview',

  // ===========================================================================
  // file I/O errors (uses filePath)
  // ===========================================================================
  E700: "Failed to read file: '{filePath}'",
  E701: "File not found: '{filePath}'",
  E740: "Failed to create file watcher for '{pattern}'",

  // ===========================================================================
  // service errors (uses serviceName)
  // ===========================================================================
  E800: "Service not registered: '{serviceName}'",
  E801: 'Cannot access disposed service registry',

  // ===========================================================================
  // general errors
  // ===========================================================================
  UNKNOWN_ERROR: 'An unexpected error occurred',
  E901: 'Internal extension error',
};

// format error for user display (replaces placeholders w/ error context)
export function formatUserError(error: ExtensionError): string {
  const template = USER_MESSAGES[error.code] || error.message;

  // replace {key} placeholders w/ values from error object
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const errorRecord = error as unknown as Record<string, unknown>;
    const value = errorRecord[key];
    // return original placeholder if value is undefined (avoids silent failures)
    return value !== undefined && value !== null ? String(value) : match;
  });
}

// format error for logging (includes full context)
export function formatLogError(error: ExtensionError): Record<string, unknown> {
  const result: Record<string, unknown> = {
    code: error.code,
    message: error.message,
  };

  // add cause if present
  if (error.cause) {
    result.cause = error.cause.message;
  }

  // add all enumerable custom properties (modulePath, sourceFile, line, etc.)
  const errorRecord = error as unknown as Record<string, unknown>;
  for (const key of Object.keys(error)) {
    if (!['name', 'message', 'stack', 'code', 'cause'].includes(key)) {
      result[key] = errorRecord[key];
    }
  }

  return result;
}
