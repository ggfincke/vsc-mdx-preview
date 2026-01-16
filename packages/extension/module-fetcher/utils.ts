// packages/extension/module-fetcher/utils.ts
// shared utilities for module fetching & resolution

// noop module for core/unshimmable modules (CommonJS export format)
export const NOOP_MODULE = `Object.defineProperty(exports, '__esModule', { value: true });
  function noop() {}
  exports.default = noop;`;

// Node.js core modules that cannot be shimmed in a browser environment
// these return noop module when requested
// https://github.com/calvinmetcalf/rollup-plugin-node-builtins
// license: MIT except ES6 ports of browserify modules
export const UNSHIMMABLE_CORE_MODULES = new Set([
  'dns',
  'dgram',
  'child_process',
  'cluster',
  'module',
  'net',
  'readline',
  'repl',
  'tls',
  'crypto',
]);

// Node.js core modules that could theoretically be shimmed
// but return noop for security/simplicity in webview context
export const SHIMMABLE_CORE_MODULES = new Set([
  'process',
  'events',
  'util',
  'os',
  'fs',
  'path',
  'buffer',
  'url',
  'string_decoder',
  'punycode',
  'querystring',
  'stream',
  'http',
  'https',
  'assert',
  'constants',
  'timers',
  'console',
  'vm',
  'zlib',
  'tty',
  'domain',
]);

// combined set of all Node.js core modules for quick lookup
export const ALL_CORE_MODULES = new Set([
  ...UNSHIMMABLE_CORE_MODULES,
  ...SHIMMABLE_CORE_MODULES,
]);

// normalize module request by stripping `node:` prefix if present
export function normalizeNodePrefix(request: string): string {
  return request.startsWith('node:') ? request.slice(5) : request;
}

// check if module request is for a Node.js core module (handles both `node:fs` & `fs` forms)
export function isCoreModule(request: string): boolean {
  const normalized = normalizeNodePrefix(request);
  return ALL_CORE_MODULES.has(normalized);
}

// NOTE: extractImports has been moved to import-extractor.ts
// Import from there instead: import { extractImports } from './import-extractor';

// build a noop result for core modules that can't be shimmed
export function buildNoopResult(normalizedRequest: string) {
  return {
    fsPath: `/externalModules/${normalizedRequest}`,
    code: NOOP_MODULE,
    dependencies: [],
  };
}
