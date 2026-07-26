// packages/extension-host/src/features/module-runtime/fetch/utils.ts
// shared utilities for module fetching & resolution

import { builtinModules } from 'node:module';
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

// node.js core modules served as noop stubs in browser runtime
const CORE_MODULES = new Set(builtinModules.map(normalizeNodePrefix));

// normalize module request by stripping `node:` prefix if present
export function normalizeNodePrefix(request: string): string {
  return request.startsWith('node:') ? request.slice(5) : request;
}

// check if module request is for a Node.js core module (handles both `node:fs` & `fs` forms)
export function isCoreModule(request: string): boolean {
  const normalized = normalizeNodePrefix(request);
  const rootModule = normalized.split('/', 1)[0];
  return CORE_MODULES.has(normalized) || CORE_MODULES.has(rootModule);
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
