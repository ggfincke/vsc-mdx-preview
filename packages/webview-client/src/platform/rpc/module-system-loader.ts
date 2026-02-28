// packages/webview-client/src/platform/rpc/module-system-loader.ts
// canonical lazy loader for webview module runtime import

import {
  createLazyValueLoader,
  type LazyValueLoader,
} from '@mdx-preview/runtime-utils';

export type ModuleSystem = typeof import('../../features/module-runtime');

export function createModuleSystemLoader(
  loadFn: () => Promise<ModuleSystem> = () =>
    import('../../features/module-runtime')
): LazyValueLoader<ModuleSystem> {
  return createLazyValueLoader(loadFn, {
    allowRetry: true,
  });
}

const moduleSystemLoader = createModuleSystemLoader();

export function loadModuleSystem(): Promise<ModuleSystem> {
  return moduleSystemLoader.load();
}

export function resetModuleSystemLoader(): void {
  moduleSystemLoader.reset();
}
