// packages/extension-host/src/features/module-runtime/fetch/utils.ts
// shared utilities for module fetching & resolution

import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger for module fetching utilities
const log = createTaggedLogger(LogTags.MODULE_SYSTEM);

// noop module for core/unshimmable modules (CommonJS export format)
export const NOOP_MODULE = `Object.defineProperty(exports, '__esModule', { value: true });
  function noop() {}
  exports.default = noop;`;

// track whether we've shown the core module warning (once per session)
let hasWarnedAboutCoreModules = false;

// track all core modules used in current preview (for debug output)
const usedCoreModules = new Set<string>();

// node.js core modules that cannot be shimmed in a browser environment
// return noop module when requested
// https://github.com/calvinmetcalf/rollup-plugin-node-builtins
// license: MIT except ES6 ports of browserify modules
const UNSHIMMABLE_CORE_MODULES = new Set([
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

// node.js core modules that could theoretically be shimmed
// return noop for security/simplicity in webview context
const SHIMMABLE_CORE_MODULES = new Set([
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
const ALL_CORE_MODULES = new Set([
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

// build a noop result for core modules that can't be shimmed in browser
export function buildNoopResult(normalizedRequest: string) {
  usedCoreModules.add(normalizedRequest);

  // show warning once per session when core modules are used
  if (!hasWarnedAboutCoreModules) {
    hasWarnedAboutCoreModules = true;
    log.warn(
      `Node.js core module "${normalizedRequest}" imported. ` +
        `Core modules (fs, path, crypto, etc.) are not available in browser preview. ` +
        `Code using these modules will receive no-op stubs.`
    );
  }

  log.debug(
    `Core module "${normalizedRequest}" -> noop. ` +
      `Used so far: ${Array.from(usedCoreModules).join(', ')}`
  );

  return {
    fsPath: `/externalModules/${normalizedRequest}`,
    code: NOOP_MODULE,
    dependencies: [],
  };
}
