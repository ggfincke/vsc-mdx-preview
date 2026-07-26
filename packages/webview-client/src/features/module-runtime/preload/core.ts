// packages/webview-client/src/features/module-runtime/preload/core.ts
// core module preloads & shim module helpers

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { MDXProvider, useMDXComponents } from '@mdx-js/react';
import {
  PRELOADED_MODULE_IDS,
  registerPreloadEntries,
  type PreloadEntry,
} from 'mdx-forge/browser';
import type { ModuleRegistry } from 'mdx-forge/browser/registry';

export type PreloadedModuleId =
  | (typeof PRELOADED_MODULE_IDS)[keyof typeof PRELOADED_MODULE_IDS]
  | typeof JSX_DEV_RUNTIME_MODULE_ID;

const JSX_DEV_RUNTIME_MODULE_ID = 'npm://react/jsx-dev-runtime@18';

// production React leaves jsxDEV undefined, so reuse its production element factory
const jsxDevRuntime = {
  Fragment: jsxRuntime.Fragment,
  jsxDEV: jsxRuntime.jsx,
};

const registeredPreloadAliases = new Map<string, string>();

export interface LayoutOptions {
  forceLightTheme?: boolean;
}

// fallback layout module for when vscode-markdown-layout is not available
// provide basic markdown-body wrapper for MDX content
export const fallbackLayoutModule = {
  createLayout: (options: LayoutOptions = {}) => {
    const className = options.forceLightTheme
      ? 'markdown-body mdx-force-light'
      : 'markdown-body';
    return ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { className }, children);
  },
};

// create a module wrapper w/ both default & named exports
// __esModule: true is required for Babel's _interopRequireDefault
export function createComponentModule<T>(
  component: T,
  exportNames: string[]
): { __esModule: true; default: T } & Record<string, T> {
  const module = {
    __esModule: true as const,
    default: component,
  } as { __esModule: true; default: T } & Record<string, T>;

  for (const name of exportNames) {
    module[name] = component;
  }

  return module;
}

// create a module wrapper for barrel exports
// __esModule: true is required for Babel's _interopRequireDefault
export function createBarrelModule(
  moduleExports: Record<string, unknown>,
  exportNames: string[]
): { __esModule: true } & Record<string, unknown> {
  const module: { __esModule: true } & Record<string, unknown> = {
    __esModule: true as const,
  };

  for (const name of exportNames) {
    let exported = moduleExports[name];

    // unwrap if it's a nested module wrapper w/ a default export
    // this can happen w/ certain bundler configurations where dynamic imports
    // return nested module objects instead of direct function references
    if (exported && typeof exported === 'object' && !Array.isArray(exported)) {
      const obj = exported as Record<string, unknown>;
      if ('__esModule' in obj && 'default' in obj) {
        exported = obj.default;
      }
    }

    module[name] = exported;
  }

  return module;
}

export function preloadEntry(
  registry: ModuleRegistry,
  entry: PreloadEntry
): void {
  registerPreloadEntries(registry, [entry]);
  for (const alias of entry.aliases ?? []) {
    registeredPreloadAliases.set(alias, entry.id);
  }
}

export function resolveRegisteredPreloadAlias(
  registry: ModuleRegistry,
  specifier: string
): string | undefined {
  const moduleId = registeredPreloadAliases.get(specifier);
  return moduleId !== undefined && registry.isPreloaded(moduleId)
    ? moduleId
    : undefined;
}

// initialize core preloaded modules in the registry
export function preloadCoreModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  // React
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.react,
    exports: React,
    aliases: ['react', 'npm://react'],
  });

  // ReactDOM (full API including createPortal, flushSync, etc.)
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.reactDom,
    exports: ReactDOM,
    aliases: ['react-dom', 'npm://react-dom'],
  });

  // ReactDOM/client (createRoot, hydrateRoot)
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.reactDomClient,
    exports: ReactDOMClient,
    aliases: ['react-dom/client', 'npm://react-dom/client'],
  });

  // JSX Runtime
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.jsxRuntime,
    exports: jsxRuntime,
    aliases: ['react/jsx-runtime', 'npm://react/jsx-runtime'],
  });

  preloadEntry(registry, {
    id: JSX_DEV_RUNTIME_MODULE_ID,
    exports: jsxDevRuntime,
    aliases: ['react/jsx-dev-runtime', 'npm://react/jsx-dev-runtime'],
  });

  // MDX React (must include useMDXComponents for MDX 3 compiled code to read context)
  const mdxModule = {
    __esModule: true as const,
    MDXProvider,
    useMDXComponents,
  };
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.mdxReact,
    exports: mdxModule,
    aliases: ['@mdx-js/react', 'npm://@mdx-js/react'],
  });

  // VSCode Markdown Layout
  preloadEntry(registry, {
    id: PRELOADED_MODULE_IDS.vscodeLayout,
    exports: vscodeMarkdownLayout,
    aliases: ['vscode-markdown-layout', 'npm://vscode-markdown-layout'],
  });
}
