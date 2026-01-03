// packages/webview-app/src/module-loader/index.ts
// * custom ESM/CJS module loader for Trusted Mode (async fetching, caching, circular deps, CSS injection)

import React, { ComponentType } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';
import { registry } from './ModuleRegistry';
import { evaluateModule } from './evaluateModule';
import { injectStyles, clearInjectedStyles } from './injectStyles';
import type { FetchResult, Module, ModuleRuntime } from './types';
import { ExtensionHandle } from '../rpc-webview';

// re-export for external use
export { registry } from './ModuleRegistry';
export { clearInjectedStyles } from './injectStyles';
export type { FetchResult, Module, ModuleRuntime } from './types';

// module IDs for preloaded modules
const PRELOADED_IDS = {
  react: 'npm://react@18',
  reactLatest: 'npm://react@latest',
  reactDom: 'npm://react-dom@18',
  reactDomLatest: 'npm://react-dom@latest',
  reactDomClient: 'npm://react-dom/client@18',
  jsxRuntime: 'npm://react/jsx-runtime@18',
  mdxReact: 'npm://@mdx-js/react@3',
  mdxReactLatest: 'npm://@mdx-js/react@latest',
  vscodeLayout: 'npm://vscode-markdown-layout@0.1.0',
  vscodeLayoutLatest: 'npm://vscode-markdown-layout@latest',
};

// mapping from request strings to preloaded module IDs
const PRELOAD_ALIASES: Record<string, string> = {
  react: PRELOADED_IDS.react,
  'npm://react': PRELOADED_IDS.react,
  'react-dom': PRELOADED_IDS.reactDom,
  'npm://react-dom': PRELOADED_IDS.reactDom,
  'react-dom/client': PRELOADED_IDS.reactDomClient,
  'npm://react-dom/client': PRELOADED_IDS.reactDomClient,
  'react/jsx-runtime': PRELOADED_IDS.jsxRuntime,
  'npm://react/jsx-runtime': PRELOADED_IDS.jsxRuntime,
  '@mdx-js/react': PRELOADED_IDS.mdxReact,
  'npm://@mdx-js/react': PRELOADED_IDS.mdxReact,
  'vscode-markdown-layout': PRELOADED_IDS.vscodeLayout,
  'npm://vscode-markdown-layout': PRELOADED_IDS.vscodeLayout,
};

// initialize preloaded modules (must be called before module loading)
export function initPreloadedModules(vscodeMarkdownLayout: any): void {
  // React
  registry.preload(PRELOADED_IDS.react, React);
  registry.preload(PRELOADED_IDS.reactLatest, React);
  registry.preload('react', React);

  // ReactDOM (full API including createPortal, flushSync, etc.)
  registry.preload(PRELOADED_IDS.reactDom, ReactDOM);
  registry.preload(PRELOADED_IDS.reactDomLatest, ReactDOM);
  registry.preload('react-dom', ReactDOM);

  // ReactDOM/client (createRoot, hydrateRoot)
  registry.preload(PRELOADED_IDS.reactDomClient, ReactDOMClient);
  registry.preload('react-dom/client', ReactDOMClient);

  // JSX Runtime
  registry.preload(PRELOADED_IDS.jsxRuntime, jsxRuntime);
  registry.preload('react/jsx-runtime', jsxRuntime);

  // MDX React
  registry.preload(PRELOADED_IDS.mdxReact, { MDXProvider });
  registry.preload(PRELOADED_IDS.mdxReactLatest, { MDXProvider });
  registry.preload('@mdx-js/react', { MDXProvider });

  // VSCode Markdown Layout
  registry.preload(PRELOADED_IDS.vscodeLayout, vscodeMarkdownLayout);
  registry.preload(PRELOADED_IDS.vscodeLayoutLatest, vscodeMarkdownLayout);
  registry.preload('vscode-markdown-layout', vscodeMarkdownLayout);
}

// create synchronous require function (used for already-loaded modules)
function createSyncRequire(parentId: string): (request: string) => any {
  return (request: string): any => {
    // check direct cache hit
    const cached = registry.get(request);
    if (cached) {
      return cached.exports;
    }

    // check resolution map for relative imports resolved from this parent
    const resolvedPath = registry.getResolution(parentId, request);
    if (resolvedPath) {
      const resolvedModule = registry.get(resolvedPath);
      if (resolvedModule) {
        return resolvedModule.exports;
      }
    }

    // check alias
    const aliasId = PRELOAD_ALIASES[request];
    if (aliasId) {
      const aliased = registry.get(aliasId);
      if (aliased) {
        return aliased.exports;
      }
    }

    // check npm:// prefixed versions
    const npmId = `npm://${request}@latest`;
    const npmCached = registry.get(npmId);
    if (npmCached) {
      return npmCached.exports;
    }

    // module not found (should have been pre-fetched)
    throw new Error(
      `Module not found: "${request}" (required by "${parentId}"). ` +
        `Make sure all dependencies are fetched before evaluation.`
    );
  };
}

// recursively load module & all dependencies
export async function loadModule(
  id: string,
  code: string,
  dependencies: string[],
  fetcher: (
    request: string,
    isBare: boolean,
    parentId: string
  ) => Promise<FetchResult | undefined>
): Promise<Module> {
  // check cache
  const cached = registry.get(id);
  if (cached) {
    return cached;
  }

  // check for circular dependency (pending fetch)
  const pending = registry.getPending(id);
  if (pending) {
    return pending;
  }

  // create promise for this module (handles circular deps)
  const modulePromise = (async (): Promise<Module> => {
    // load all dependencies
    for (const dep of dependencies) {
      if (!dep) {
        continue;
      }

      // skip if already loaded
      if (registry.has(dep)) {
        continue;
      }

      // check aliases
      if (PRELOAD_ALIASES[dep] && registry.has(PRELOAD_ALIASES[dep])) {
        continue;
      }

      // determine if this is bare import
      const isBare =
        !dep.startsWith('/') &&
        !dep.startsWith('./') &&
        !dep.startsWith('../') &&
        !dep.startsWith('npm://');

      // fetch dependency
      const result = await fetcher(dep, isBare, id);
      if (!result) {
        console.warn(`Failed to fetch dependency: ${dep}`);
        continue;
      }

      // register resolution mapping: (parentId, request) -> fsPath
      // this allows require() to find the module by request string
      if (result.fsPath !== dep) {
        registry.setResolution(id, dep, result.fsPath);
      }

      // handle CSS
      if (result.css) {
        injectStyles(result.fsPath, result.css);
        // CSS modules don't have exports
        registry.set(result.fsPath, {
          id: result.fsPath,
          exports: {},
          loaded: true,
        });
        continue;
      }

      // recursively load dependency
      await loadModule(
        result.fsPath,
        result.code,
        result.dependencies,
        fetcher
      );
    }

    // create runtime for module evaluation
    const runtime: ModuleRuntime = {
      Fragment: jsxRuntime.Fragment,
      jsx: jsxRuntime.jsx,
      jsxs: jsxRuntime.jsxs,
      require: createSyncRequire(id),
    };

    // evaluate module
    const exports = evaluateModule(code, id, runtime);

    // cache module
    const module: Module = {
      id,
      exports,
      loaded: true,
    };
    registry.set(id, module);

    return module;
  })();

  // track pending promise for circular deps
  registry.setPending(id, modulePromise);

  try {
    const module = await modulePromise;
    return module;
  } finally {
    registry.clearPending(id);
  }
}

// clear all modules except preloaded ones
export function resetModules(): void {
  const preloadedIds = [
    ...Object.values(PRELOADED_IDS),
    'react',
    'react-dom',
    'react-dom/client',
    'react/jsx-runtime',
    '@mdx-js/react',
    'vscode-markdown-layout',
  ];
  registry.clearNonPreloaded(preloadedIds);
  clearInjectedStyles();
}

// invalidate specific module (for hot reload)
export function invalidateModule(id: string): void {
  registry.invalidate(id);
}

// track if preloaded modules have been initialized
let preloadedModulesInitialized = false;

// import vscodeMarkdownLayout dynamically to avoid circular deps
let vscodeMarkdownLayoutModule: any = null;

type LayoutOptions = {
  forceLightTheme?: boolean;
};

const fallbackLayoutModule = {
  createLayout: (options: LayoutOptions = {}) => {
    const className = options.forceLightTheme
      ? 'markdown-body mdx-force-light'
      : 'markdown-body';
    return ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { className }, children);
  },
};

// set vscodeMarkdownLayout module (called from App.tsx if needed)
export function setVscodeMarkdownLayout(module: any): void {
  vscodeMarkdownLayoutModule = module;
}

// ensure preloaded modules are initialized
function ensurePreloadedModules(): void {
  if (preloadedModulesInitialized) {
    return;
  }

  // initialize w/ layout module if available
  if (vscodeMarkdownLayoutModule) {
    initPreloadedModules(vscodeMarkdownLayoutModule);
  } else {
    // initialize w/ local markdown layout wrapper
    initPreloadedModules(fallbackLayoutModule);
  }
  preloadedModulesInitialized = true;
}

// RPC fetcher that delegates to extension via RPC
async function rpcFetcher(
  request: string,
  isBare: boolean,
  parentId: string
): Promise<FetchResult | undefined> {
  return ExtensionHandle.fetch(request, isBare, parentId);
}

// * evaluate MDX code & return React component (main entry point for Trusted Mode rendering)
export async function evaluateModuleToComponent(
  code: string,
  entryFilePath: string,
  dependencies: string[]
): Promise<ComponentType> {
  // Ensure preloaded modules are ready
  ensurePreloadedModules();

  // Reset non-preloaded modules for fresh evaluation
  resetModules();

  // Load the entry module and all dependencies
  const module = await loadModule(
    entryFilePath,
    code,
    dependencies,
    rpcFetcher
  );

  // Get the default export (MDX component)
  const component = module.exports?.default || module.exports;

  if (typeof component !== 'function') {
    throw new Error(
      `MDX module did not export a valid component. ` +
        `Got: ${typeof component}. ` +
        `Make sure the MDX file has valid content.`
    );
  }

  return component as ComponentType;
}
