// packages/extension/module-fetcher/utils.ts
// Shared utilities for module fetching & resolution

import { init as initLexer, parse as parseImports } from 'es-module-lexer';

// Noop module for core/unshimmable modules (CommonJS export format)
export const NOOP_MODULE = `Object.defineProperty(exports, '__esModule', { value: true });
  function noop() {}
  exports.default = noop;`;

// Node.js core modules that cannot be shimmed in a browser environment
// These return noop module when requested
// https://github.com/calvinmetcalf/rollup-plugin-node-builtins
// License: MIT except ES6 ports of browserify modules
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

// Combined set of all Node.js core modules for quick lookup
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

// lazy lexer initialization
let lexerInitialized = false;

// ensure es-module-lexer is initialized before parsing (safe to call multiple times - only initializes once)
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

// extract import specifiers from code using es-module-lexer (ESM-first)
// falls back to regex for CJS require() calls if parsing fails
export async function extractImports(code: string): Promise<string[]> {
  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);
    return imports
      .map((imp) => imp.n)
      .filter((name): name is string => name !== undefined && name !== null);
  } catch {
    // Fallback for code that can't be parsed (e.g., CJS) - extract require() calls
    const requireMatches = code.matchAll(
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    );
    return Array.from(requireMatches, (m) => m[1]);
  }
}

// build a noop result for core modules that can't be shimmed
export function buildNoopResult(normalizedRequest: string) {
  return {
    fsPath: `/externalModules/${normalizedRequest}`,
    code: NOOP_MODULE,
    dependencies: [],
  };
}
