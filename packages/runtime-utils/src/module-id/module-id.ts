// packages/runtime-utils/src/module-id/module-id.ts
// GPL npm module ID helpers; shared classifier mirrors mdx-forge browser helper
// ! cross-repo duplicate: keep common behavior covered by parity tests

const NPM_MODULE_PREFIX = 'npm://';
const NODE_MODULE_PREFIX = 'node:';
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/;

export function isNpmModuleId(id: string): boolean {
  return id.startsWith(NPM_MODULE_PREFIX);
}

export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !WINDOWS_ABSOLUTE_PATH_PATTERN.test(specifier) &&
    !hasDisallowedUrlScheme(specifier) &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}

function hasDisallowedUrlScheme(str: string): boolean {
  if (!URL_SCHEME_PATTERN.test(str)) {
    return false;
  }

  return (
    !str.startsWith(NODE_MODULE_PREFIX) && !str.startsWith(NPM_MODULE_PREFIX)
  );
}

export function isValidModuleRequest(request: string): boolean {
  if (request.includes('\0')) {
    return false;
  }

  if (hasDisallowedUrlScheme(request)) {
    return false;
  }

  return true;
}
