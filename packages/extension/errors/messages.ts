// packages/extension/errors/messages.ts
// user-friendly error message templates & formatting

import type { ExtensionError } from './index';

// message templates w/ {placeholder} syntax
// ! Placeholders must match actual field names on error classes
const USER_MESSAGES: Record<string, string> = {
  // ModuleFetchError uses modulePath & parentModule
  MODULE_NOT_FOUND:
    "Cannot find module '{modulePath}'. Did you run npm install?",
  OUTSIDE_WORKSPACE: "Cannot access '{modulePath}' - outside workspace folders",
  PARSE_ERROR: "Syntax error in '{modulePath}'",
  TRANSFORM_ERROR: "Failed to compile '{modulePath}'",
  // TranspileError uses sourceFile, line, column
  TRANSPILE_ERROR: "Compilation error in '{sourceFile}' at line {line}",
  // SecurityError uses attemptedPath
  PATH_TRAVERSAL: "Access denied: '{attemptedPath}' is outside workspace",
  TRUST_VIOLATION:
    'Operation blocked - workspace not trusted or scripts disabled',
  // ConfigError uses configPath
  CONFIG_PARSE_ERROR: "Failed to parse config file '{configPath}'",
  CONFIG_VALIDATION_ERROR: "Invalid configuration in '{configPath}'",
  // PluginError uses pluginName
  PLUGIN_NOT_FOUND: "Cannot find plugin '{pluginName}'. Ensure it's installed.",
  PLUGIN_LOAD_ERROR: "Failed to load plugin '{pluginName}'",
  PLUGIN_INVALID_EXPORT:
    "Plugin '{pluginName}' does not export a valid function",
  // Tailwind errors
  TAILWIND_COMPILATION_ERROR: 'Tailwind CSS compilation failed',
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
