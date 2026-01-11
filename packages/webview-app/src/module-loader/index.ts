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
import { debugWarn } from '../utils/debug';

// Docusaurus component shims
import * as DocusaurusShims from '../components/shims/docusaurus';
// Starlight component shims
import * as StarlightShims from '../components/shims/starlight';
// Next.js component shims
import * as NextjsShims from '../components/shims/nextjs';

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
  // Docusaurus shims
  docusaurusTabs: 'npm://@mdx-preview/shims-docusaurus/Tabs',
  docusaurusTabItem: 'npm://@mdx-preview/shims-docusaurus/TabItem',
  docusaurusCodeBlock: 'npm://@mdx-preview/shims-docusaurus/CodeBlock',
  docusaurusDetails: 'npm://@mdx-preview/shims-docusaurus/Details',
  // Starlight shims
  starlightComponents: 'npm://@mdx-preview/shims-starlight/components',
  starlightCard: 'npm://@mdx-preview/shims-starlight/Card',
  starlightCardGrid: 'npm://@mdx-preview/shims-starlight/CardGrid',
  starlightLinkCard: 'npm://@mdx-preview/shims-starlight/LinkCard',
  starlightSteps: 'npm://@mdx-preview/shims-starlight/Steps',
  starlightBadge: 'npm://@mdx-preview/shims-starlight/Badge',
  starlightAside: 'npm://@mdx-preview/shims-starlight/Aside',
  starlightTabs: 'npm://@mdx-preview/shims-starlight/Tabs',
  starlightTabItem: 'npm://@mdx-preview/shims-starlight/TabItem',
  starlightFileTree: 'npm://@mdx-preview/shims-starlight/FileTree',
  starlightCode: 'npm://@mdx-preview/shims-starlight/Code',
  // Next.js shims
  nextjsImage: 'npm://@mdx-preview/shims-nextjs/Image',
  nextjsLink: 'npm://@mdx-preview/shims-nextjs/Link',
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
  // Docusaurus @theme/* aliases
  '@theme/Tabs': PRELOADED_IDS.docusaurusTabs,
  '@theme/TabItem': PRELOADED_IDS.docusaurusTabItem,
  '@theme/CodeBlock': PRELOADED_IDS.docusaurusCodeBlock,
  '@theme/Details': PRELOADED_IDS.docusaurusDetails,
  // Also support direct shim paths
  '@mdx-preview/shims/docusaurus/Tabs': PRELOADED_IDS.docusaurusTabs,
  '@mdx-preview/shims/docusaurus/TabItem': PRELOADED_IDS.docusaurusTabItem,
  '@mdx-preview/shims/docusaurus/CodeBlock': PRELOADED_IDS.docusaurusCodeBlock,
  '@mdx-preview/shims/docusaurus/Details': PRELOADED_IDS.docusaurusDetails,
  // Starlight @astrojs/starlight/components alias (all-in-one import)
  '@astrojs/starlight/components': PRELOADED_IDS.starlightComponents,
  // Individual Starlight component aliases
  '@mdx-preview/shims/starlight/Card': PRELOADED_IDS.starlightCard,
  '@mdx-preview/shims/starlight/CardGrid': PRELOADED_IDS.starlightCardGrid,
  '@mdx-preview/shims/starlight/LinkCard': PRELOADED_IDS.starlightLinkCard,
  '@mdx-preview/shims/starlight/Steps': PRELOADED_IDS.starlightSteps,
  '@mdx-preview/shims/starlight/Badge': PRELOADED_IDS.starlightBadge,
  '@mdx-preview/shims/starlight/Aside': PRELOADED_IDS.starlightAside,
  '@mdx-preview/shims/starlight/Tabs': PRELOADED_IDS.starlightTabs,
  '@mdx-preview/shims/starlight/TabItem': PRELOADED_IDS.starlightTabItem,
  '@mdx-preview/shims/starlight/FileTree': PRELOADED_IDS.starlightFileTree,
  '@mdx-preview/shims/starlight/Code': PRELOADED_IDS.starlightCode,
  // Next.js next/image & next/link aliases
  'next/image': PRELOADED_IDS.nextjsImage,
  'next/link': PRELOADED_IDS.nextjsLink,
  '@mdx-preview/shims/nextjs/Image': PRELOADED_IDS.nextjsImage,
  '@mdx-preview/shims/nextjs/Link': PRELOADED_IDS.nextjsLink,
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

  // Docusaurus component shims
  const docusaurusTabsModule = {
    default: DocusaurusShims.Tabs,
    Tabs: DocusaurusShims.Tabs,
  };
  const docusaurusTabItemModule = {
    default: DocusaurusShims.TabItem,
    TabItem: DocusaurusShims.TabItem,
  };
  const docusaurusCodeBlockModule = {
    default: DocusaurusShims.CodeBlock,
    CodeBlock: DocusaurusShims.CodeBlock,
  };
  const docusaurusDetailsModule = {
    default: DocusaurusShims.Details,
    Details: DocusaurusShims.Details,
  };

  registry.preload(PRELOADED_IDS.docusaurusTabs, docusaurusTabsModule);
  registry.preload('@theme/Tabs', docusaurusTabsModule);
  registry.preload(PRELOADED_IDS.docusaurusTabItem, docusaurusTabItemModule);
  registry.preload('@theme/TabItem', docusaurusTabItemModule);
  registry.preload(
    PRELOADED_IDS.docusaurusCodeBlock,
    docusaurusCodeBlockModule
  );
  registry.preload('@theme/CodeBlock', docusaurusCodeBlockModule);
  registry.preload(PRELOADED_IDS.docusaurusDetails, docusaurusDetailsModule);
  registry.preload('@theme/Details', docusaurusDetailsModule);

  // Starlight component shims
  // All-in-one module for import { Card, Steps, ... } from '@astrojs/starlight/components'
  const starlightComponentsModule = {
    Card: StarlightShims.Card,
    CardGrid: StarlightShims.CardGrid,
    LinkCard: StarlightShims.LinkCard,
    Steps: StarlightShims.Steps,
    Badge: StarlightShims.Badge,
    Aside: StarlightShims.Aside,
    Tabs: StarlightShims.Tabs,
    TabItem: StarlightShims.TabItem,
    FileTree: StarlightShims.FileTree,
    Code: StarlightShims.Code,
  };
  registry.preload(
    PRELOADED_IDS.starlightComponents,
    starlightComponentsModule
  );
  registry.preload('@astrojs/starlight/components', starlightComponentsModule);

  // Individual Starlight component modules
  const starlightCardModule = {
    default: StarlightShims.Card,
    Card: StarlightShims.Card,
  };
  const starlightCardGridModule = {
    default: StarlightShims.CardGrid,
    CardGrid: StarlightShims.CardGrid,
  };
  const starlightLinkCardModule = {
    default: StarlightShims.LinkCard,
    LinkCard: StarlightShims.LinkCard,
  };
  const starlightStepsModule = {
    default: StarlightShims.Steps,
    Steps: StarlightShims.Steps,
  };
  const starlightBadgeModule = {
    default: StarlightShims.Badge,
    Badge: StarlightShims.Badge,
  };
  const starlightAsideModule = {
    default: StarlightShims.Aside,
    Aside: StarlightShims.Aside,
  };
  const starlightTabsModule = {
    default: StarlightShims.Tabs,
    Tabs: StarlightShims.Tabs,
  };
  const starlightTabItemModule = {
    default: StarlightShims.TabItem,
    TabItem: StarlightShims.TabItem,
  };
  const starlightFileTreeModule = {
    default: StarlightShims.FileTree,
    FileTree: StarlightShims.FileTree,
  };
  const starlightCodeModule = {
    default: StarlightShims.Code,
    Code: StarlightShims.Code,
  };

  registry.preload(PRELOADED_IDS.starlightCard, starlightCardModule);
  registry.preload(PRELOADED_IDS.starlightCardGrid, starlightCardGridModule);
  registry.preload(PRELOADED_IDS.starlightLinkCard, starlightLinkCardModule);
  registry.preload(PRELOADED_IDS.starlightSteps, starlightStepsModule);
  registry.preload(PRELOADED_IDS.starlightBadge, starlightBadgeModule);
  registry.preload(PRELOADED_IDS.starlightAside, starlightAsideModule);
  registry.preload(PRELOADED_IDS.starlightTabs, starlightTabsModule);
  registry.preload(PRELOADED_IDS.starlightTabItem, starlightTabItemModule);
  registry.preload(PRELOADED_IDS.starlightFileTree, starlightFileTreeModule);
  registry.preload(PRELOADED_IDS.starlightCode, starlightCodeModule);

  // Next.js component shims
  const nextjsImageModule = {
    default: NextjsShims.Image,
    Image: NextjsShims.Image,
  };
  const nextjsLinkModule = {
    default: NextjsShims.Link,
    Link: NextjsShims.Link,
  };

  registry.preload(PRELOADED_IDS.nextjsImage, nextjsImageModule);
  registry.preload('next/image', nextjsImageModule);
  registry.preload(PRELOADED_IDS.nextjsLink, nextjsLinkModule);
  registry.preload('next/link', nextjsLinkModule);
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
        debugWarn(`[MODULE-LOADER] Failed to fetch dependency: ${dep}`);
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
    // Docusaurus shims
    '@theme/Tabs',
    '@theme/TabItem',
    '@theme/CodeBlock',
    '@theme/Details',
    // Starlight shims
    '@astrojs/starlight/components',
    // Next.js shims
    'next/image',
    'next/link',
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

  // load the entry module & all deps
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
