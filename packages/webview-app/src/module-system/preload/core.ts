// packages/webview-app/src/module-system/preload/core.ts
// core module preloads & shim module helpers

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { MDXProvider, useMDXComponents } from '@mdx-js/react';
import { PRELOADED_MODULE_IDS } from '@mdx-preview/shared';
import type { ModuleRegistry } from '../registry/ModuleRegistry';

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
    module[name] = moduleExports[name];
  }

  return module;
}

// initialize core preloaded modules in the registry
export function preloadCoreModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  // React
  registry.preload(PRELOADED_MODULE_IDS.react, React);
  registry.preload(PRELOADED_MODULE_IDS.reactLatest, React);

  // ReactDOM (full API including createPortal, flushSync, etc.)
  registry.preload(PRELOADED_MODULE_IDS.reactDom, ReactDOM);
  registry.preload(PRELOADED_MODULE_IDS.reactDomLatest, ReactDOM);

  // ReactDOM/client (createRoot, hydrateRoot)
  registry.preload(PRELOADED_MODULE_IDS.reactDomClient, ReactDOMClient);

  // JSX Runtime
  registry.preload(PRELOADED_MODULE_IDS.jsxRuntime, jsxRuntime);

  // MDX React (must include useMDXComponents for MDX 3 compiled code to read context)
  const mdxModule = { __esModule: true as const, MDXProvider, useMDXComponents };
  registry.preload(PRELOADED_MODULE_IDS.mdxReact, mdxModule);
  registry.preload(PRELOADED_MODULE_IDS.mdxReactLatest, mdxModule);

  // VSCode Markdown Layout
  registry.preload(PRELOADED_MODULE_IDS.vscodeLayout, vscodeMarkdownLayout);
  registry.preload(
    PRELOADED_MODULE_IDS.vscodeLayoutLatest,
    vscodeMarkdownLayout
  );
}
