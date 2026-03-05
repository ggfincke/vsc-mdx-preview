// packages/runtime-utils/src/module-id/module-id.ts
// utilities for working w/ npm:// module IDs used by the webview module system
// format: npm://<package>@<version> or npm://<package>/<subpath>@<version>
// ! cross-repo duplicate: mdx-forge/src/browser/internal/module-id.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

// module ID prefix for npm packages
const NPM_MODULE_PREFIX = 'npm://';

// check if an ID is an npm module ID (starts w/ npm://)
export function isNpmModuleId(id: string): boolean {
  return id.startsWith(NPM_MODULE_PREFIX);
}

// check if an import specifier is a bare import (not relative, not absolute, not npm://)
// bare imports are typically node_modules packages like 'react' or 'lodash/merge'
export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !/^[a-zA-Z]:[\\/]/.test(specifier) &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}

// URL scheme pattern for module ID validation
const URL_SCHEME_PATTERN = /^[a-z]+:\/\//i;

// check if a string looks like a URL (has a scheme)
function hasUrlScheme(str: string): boolean {
  return URL_SCHEME_PATTERN.test(str);
}

// validate a module fetch request for security
export function isValidModuleRequest(request: string): boolean {
  // reject null bytes (potential injection)
  if (request.includes('\0')) {
    return false;
  }

  // only allow npm:// scheme (not http://, file://, etc.)
  if (hasUrlScheme(request) && !isNpmModuleId(request)) {
    return false;
  }

  return true;
}
