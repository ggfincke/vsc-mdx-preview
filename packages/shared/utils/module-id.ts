// packages/shared/utils/module-id.ts
// utilities for working w/ npm:// module IDs used by the webview module system
//
// module ID format: npm://<package>@<version> or npm://<package>/<subpath>@<version>
// examples:
//   - npm://react@18
//   - npm://react/jsx-runtime@18
//   - npm://@mdx-js/react@3
//   - npm://@mdx-preview/shims-generic/Callout

// module ID prefix for npm packages
export const NPM_MODULE_PREFIX = 'npm://';

// check if an ID is an npm module ID (starts w/ npm://)
export function isNpmModuleId(id: string): boolean {
  return id.startsWith(NPM_MODULE_PREFIX);
}

// check if an import specifier is a bare import (not relative, not absolute, not npm://)
// bare imports are typically node_modules packages like 'react' or 'lodash/merge'
export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('/') &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}

// parsed npm module ID components
export interface ParsedNpmModuleId {
  // package name (e.g., 'react', '@mdx-js/react')
  package: string;
  // subpath within package (e.g., '/jsx-runtime', '/client')
  subpath?: string;
  // version string (e.g., '18', '3')
  version?: string;
}

// parse an npm:// module ID into its components
// examples:
// - 'npm://react@18' -> { package: 'react', version: '18' }
// - 'npm://react/jsx-runtime@18' -> { package: 'react', subpath: '/jsx-runtime', version: '18' }
// - 'npm://@mdx-js/react@3' -> { package: '@mdx-js/react', version: '3' }
// returns Parsed components or null if not a valid npm module ID
export function parseNpmModuleId(id: string): ParsedNpmModuleId | null {
  if (!isNpmModuleId(id)) {
    return null;
  }

  // Remove prefix: 'npm://react/jsx-runtime@18' -> 'react/jsx-runtime@18'
  const withoutPrefix = id.slice(NPM_MODULE_PREFIX.length);

  // Handle scoped packages (@scope/package)
  let packageName: string;
  let rest: string;

  if (withoutPrefix.startsWith('@')) {
    // Scoped package: @scope/package/subpath@version
    const scopeEnd = withoutPrefix.indexOf('/', 1);
    if (scopeEnd === -1) {
      // Invalid: @scope without /package
      return null;
    }

    // Find the next slash after scope/package (start of subpath)
    const subpathStart = withoutPrefix.indexOf('/', scopeEnd + 1);
    if (subpathStart === -1) {
      // No subpath: @scope/package@version or @scope/package
      const versionIndex = withoutPrefix.lastIndexOf('@');
      if (versionIndex > scopeEnd) {
        // Has version
        packageName = withoutPrefix.slice(0, versionIndex);
        rest = withoutPrefix.slice(versionIndex);
      } else {
        // No version
        packageName = withoutPrefix;
        rest = '';
      }
    } else {
      // Has subpath: @scope/package/subpath@version
      packageName = withoutPrefix.slice(0, subpathStart);
      rest = withoutPrefix.slice(subpathStart);
    }
  } else {
    // Non-scoped package: package/subpath@version
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex === -1) {
      // No subpath: package@version or package
      const versionIndex = withoutPrefix.lastIndexOf('@');
      if (versionIndex > 0) {
        packageName = withoutPrefix.slice(0, versionIndex);
        rest = withoutPrefix.slice(versionIndex);
      } else {
        packageName = withoutPrefix;
        rest = '';
      }
    } else {
      // Has subpath: package/subpath@version
      packageName = withoutPrefix.slice(0, slashIndex);
      rest = withoutPrefix.slice(slashIndex);
    }
  }

  // Extract version and subpath from rest
  let subpath: string | undefined;
  let version: string | undefined;

  if (rest) {
    if (rest.startsWith('@')) {
      // rest is just @version
      version = rest.slice(1);
    } else {
      // rest is /subpath@version or /subpath
      const versionIndex = rest.lastIndexOf('@');
      if (versionIndex !== -1) {
        subpath = rest.slice(0, versionIndex);
        version = rest.slice(versionIndex + 1);
      } else {
        subpath = rest;
      }
    }
  }

  return {
    package: packageName,
    subpath: subpath || undefined,
    version: version || undefined,
  };
}

// create an npm module ID from components
export function createNpmModuleId(
  packageName: string,
  subpath?: string,
  version?: string
): string {
  let id = NPM_MODULE_PREFIX + packageName;
  if (subpath) {
    id += subpath.startsWith('/') ? subpath : '/' + subpath;
  }
  if (version) {
    id += '@' + version;
  }
  return id;
}

// URL scheme pattern for module ID validation
// matches: http://, https://, npm://, file://, etc.
export const URL_SCHEME_PATTERN = /^[a-z]+:\/\//i;

// check if a string looks like a URL (has a scheme)
export function hasUrlScheme(str: string): boolean {
  return URL_SCHEME_PATTERN.test(str);
}

// validate a module fetch request for security
// returns true if the request is safe to process
// security checks:
// - No null bytes (potential injection)
// - Only npm:// scheme allowed (not http://, file://, etc.)
export function isValidModuleRequest(request: string): boolean {
  // No null bytes (potential injection)
  if (request.includes('\0')) {
    return false;
  }

  // Only allow npm:// scheme (not http://, file://, etc.)
  if (hasUrlScheme(request) && !isNpmModuleId(request)) {
    return false;
  }

  return true;
}
