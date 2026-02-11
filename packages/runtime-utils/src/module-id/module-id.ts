// packages/runtime-utils/src/module-id/module-id.ts
// utilities for working w/ npm:// module IDs used by the webview module system
// module ID format: npm://<package>@<version> or npm://<package>/<subpath>@<version>
// examples: npm://react@18, npm://react/jsx-runtime@18, npm://@mdx-js/react@3

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
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !/^[a-zA-Z]:[\\/]/.test(specifier) &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}

// parsed npm module ID components
export interface ParsedNpmModuleId {
  // package name
  package: string;
  // subpath
  subpath?: string;
  // version
  version?: string;
}

// parse an npm:// module ID into its components
// examples
// - 'npm://react@18' -> { package: 'react', version: '18' }
// - 'npm://react/jsx-runtime@18' -> { package: 'react', subpath: '/jsx-runtime', version: '18' }
// - 'npm://@mdx-js/react@3' -> { package: '@mdx-js/react', version: '3' }
// return parsed components or null if not valid npm module ID
export function parseNpmModuleId(id: string): ParsedNpmModuleId | null {
  if (!isNpmModuleId(id)) {
    return null;
  }

  // remove prefix: 'npm://react/jsx-runtime@18' -> 'react/jsx-runtime@18'
  const withoutPrefix = id.slice(NPM_MODULE_PREFIX.length);

  // handle scoped packages (@scope/package)
  let packageName: string;
  let rest: string;

  if (withoutPrefix.startsWith('@')) {
    // scoped package: @scope/package/subpath@version
    const scopeEnd = withoutPrefix.indexOf('/', 1);
    if (scopeEnd === -1) {
      // invalid: @scope w/o /package
      return null;
    }

    // find the next slash after scope/package (start of subpath)
    const subpathStart = withoutPrefix.indexOf('/', scopeEnd + 1);
    if (subpathStart === -1) {
      // no subpath: @scope/package@version or @scope/package
      const versionIndex = withoutPrefix.lastIndexOf('@');
      if (versionIndex > scopeEnd) {
        // has version
        packageName = withoutPrefix.slice(0, versionIndex);
        rest = withoutPrefix.slice(versionIndex);
      } else {
        // no version
        packageName = withoutPrefix;
        rest = '';
      }
    } else {
      // has subpath: @scope/package/subpath@version
      packageName = withoutPrefix.slice(0, subpathStart);
      rest = withoutPrefix.slice(subpathStart);
    }
  } else {
    // non-scoped package: package/subpath@version
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex === -1) {
      // no subpath: package@version or package
      const versionIndex = withoutPrefix.lastIndexOf('@');
      if (versionIndex > 0) {
        packageName = withoutPrefix.slice(0, versionIndex);
        rest = withoutPrefix.slice(versionIndex);
      } else {
        packageName = withoutPrefix;
        rest = '';
      }
    } else {
      // has subpath: package/subpath@version
      packageName = withoutPrefix.slice(0, slashIndex);
      rest = withoutPrefix.slice(slashIndex);
    }
  }

  // extract version & subpath from rest
  let subpath: string | undefined;
  let version: string | undefined;

  if (rest) {
    if (rest.startsWith('@')) {
      // rest is @version only
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
// match: http://, https://, npm://, file://, etc
// (side comment removed - pattern is self-explanatory)
export const URL_SCHEME_PATTERN = /^[a-z]+:\/\//i;

// check if a string looks like a URL (has a scheme)
export function hasUrlScheme(str: string): boolean {
  return URL_SCHEME_PATTERN.test(str);
}

// validate a module fetch request for security
// return true if request is safe to process
// security checks
// - no null bytes (potential injection)
// - only npm:// scheme allowed (not http://, file://, etc.)
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
