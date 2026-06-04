// packages/extension-host/src/shared/errors/messages.ts
// user-friendly error message templates & formatting

import type { ExtensionError } from './index';
import type { ModuleError } from '@mdx-preview/contracts';

// message templates w/ {placeholder} syntax
// ! Placeholders must match actual field names on error classes
const USER_MESSAGES: Record<string, string> = {
  // trust & security errors
  PATH_TRAVERSAL: "Access denied: '{attemptedPath}' is outside workspace",
  TRUST_VIOLATION:
    'Operation blocked - workspace not trusted or scripts disabled',

  // module fetch errors (uses moduleId & parentModuleId)
  E100: "Cannot find module '{moduleId}'. Did you run npm install?",
  E101: "Cannot access '{moduleId}' - outside workspace folders",
  E102: "Circular dependency detected: '{moduleId}'",
  E110: "Syntax error in '{moduleId}'",
  E120: "Failed to compile '{moduleId}'",

  // configuration errors (uses configPath)
  CONFIG_PARSE_ERROR: "Failed to parse config file '{configPath}'",
  CONFIG_VALIDATION_ERROR: "Invalid configuration in '{configPath}'",

  // transpilation errors (uses sourceFile, line, column)
  TRANSPILE_ERROR: "Compilation error in '{sourceFile}' at line {line}",

  // plugin errors (uses pluginName)
  PLUGIN_NOT_FOUND: "Cannot find plugin '{pluginName}'. Ensure it's installed.",
  PLUGIN_LOAD_ERROR: "Failed to load plugin '{pluginName}'",
  PLUGIN_INVALID_EXPORT:
    "Plugin '{pluginName}' does not export a valid function",
  E460: 'Custom plugins are blocked in Safe Mode',

  // tailwind errors (uses phase)
  E500: 'Tailwind CSS not installed in workspace',
  E501: 'Tailwind version not supported. Minimum: v4',
  E520: 'Tailwind config not found',
  TAILWIND_COMPILATION_ERROR: 'Tailwind CSS compilation failed',
  E562: 'Invalid Tailwind PostCSS plugin',

  // webview errors (uses phase)
  E600: 'Could not find Vite manifest in extension',
  E620: 'Preview initialization timed out',
  E640: 'Failed to communicate w/ preview',

  // service errors (uses serviceName)
  E800: "Service not registered: '{serviceName}'",
  E801: 'Cannot access disposed service registry',
};

// format error for user display (replaces placeholders w/ error context)
export function formatUserError(error: ExtensionError | ModuleError): string {
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
export function formatLogError(
  error: ExtensionError | ModuleError
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    code: error.code,
    message: error.message,
  };

  // add cause if present
  if (error.cause) {
    result.cause = error.cause.message;
  }

  // add all enumerable custom properties (moduleId, sourceFile, line, etc.)
  const errorRecord = error as unknown as Record<string, unknown>;
  for (const key of Object.keys(error)) {
    if (!['name', 'message', 'stack', 'code', 'cause'].includes(key)) {
      result[key] = errorRecord[key];
    }
  }

  return result;
}
