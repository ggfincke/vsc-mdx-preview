// packages/webview-app/src/module-loader/preload.ts
// initialization & preload setup for built-in modules

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { MDXProvider } from '@mdx-js/react';
import { registry } from './ModuleRegistry';
import { PRELOADED_IDS } from './preload-aliases';

// Framework component shims
import * as DocusaurusShims from '../components/shims/docusaurus';
import * as StarlightShims from '../components/shims/starlight';
import * as NextjsShims from '../components/shims/nextjs';

export interface LayoutOptions {
  forceLightTheme?: boolean;
}

// fallback layout module for when vscode-markdown-layout is not available
// provides a basic markdown-body wrapper for MDX content
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
// used for framework shim components
function createComponentModule<T>(
  component: T,
  name: string
): { default: T } & Record<string, T> {
  return { default: component, [name]: component };
}

// initialize all preloaded modules in the registry
// must be called before any module loading operations
// vscodeMarkdownLayout: the layout module to use (or fallbackLayoutModule)
export function initPreloadedModules(vscodeMarkdownLayout: unknown): void {
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
  const mdxModule = { MDXProvider };
  registry.preload(PRELOADED_IDS.mdxReact, mdxModule);
  registry.preload(PRELOADED_IDS.mdxReactLatest, mdxModule);
  registry.preload('@mdx-js/react', mdxModule);

  // VSCode Markdown Layout
  registry.preload(PRELOADED_IDS.vscodeLayout, vscodeMarkdownLayout);
  registry.preload(PRELOADED_IDS.vscodeLayoutLatest, vscodeMarkdownLayout);
  registry.preload('vscode-markdown-layout', vscodeMarkdownLayout);

  // Initialize framework shims
  initDocusaurusShims();
  initStarlightShims();
  initNextjsShims();
}

// initialize Docusaurus component shims
function initDocusaurusShims(): void {
  const tabsModule = createComponentModule(DocusaurusShims.Tabs, 'Tabs');
  const tabItemModule = createComponentModule(
    DocusaurusShims.TabItem,
    'TabItem'
  );
  const codeBlockModule = createComponentModule(
    DocusaurusShims.CodeBlock,
    'CodeBlock'
  );
  const detailsModule = createComponentModule(
    DocusaurusShims.Details,
    'Details'
  );

  registry.preload(PRELOADED_IDS.docusaurusTabs, tabsModule);
  registry.preload('@theme/Tabs', tabsModule);
  registry.preload(PRELOADED_IDS.docusaurusTabItem, tabItemModule);
  registry.preload('@theme/TabItem', tabItemModule);
  registry.preload(PRELOADED_IDS.docusaurusCodeBlock, codeBlockModule);
  registry.preload('@theme/CodeBlock', codeBlockModule);
  registry.preload(PRELOADED_IDS.docusaurusDetails, detailsModule);
  registry.preload('@theme/Details', detailsModule);
}

// initialize Starlight component shims
function initStarlightShims(): void {
  // All-in-one module for import { Card, Steps, ... } from '@astrojs/starlight/components'
  const componentsModule = {
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
  registry.preload(PRELOADED_IDS.starlightComponents, componentsModule);
  registry.preload('@astrojs/starlight/components', componentsModule);

  // Individual component modules
  const cardModule = createComponentModule(StarlightShims.Card, 'Card');
  const cardGridModule = createComponentModule(
    StarlightShims.CardGrid,
    'CardGrid'
  );
  const linkCardModule = createComponentModule(
    StarlightShims.LinkCard,
    'LinkCard'
  );
  const stepsModule = createComponentModule(StarlightShims.Steps, 'Steps');
  const badgeModule = createComponentModule(StarlightShims.Badge, 'Badge');
  const asideModule = createComponentModule(StarlightShims.Aside, 'Aside');
  const tabsModule = createComponentModule(StarlightShims.Tabs, 'Tabs');
  const tabItemModule = createComponentModule(
    StarlightShims.TabItem,
    'TabItem'
  );
  const fileTreeModule = createComponentModule(
    StarlightShims.FileTree,
    'FileTree'
  );
  const codeModule = createComponentModule(StarlightShims.Code, 'Code');

  registry.preload(PRELOADED_IDS.starlightCard, cardModule);
  registry.preload(PRELOADED_IDS.starlightCardGrid, cardGridModule);
  registry.preload(PRELOADED_IDS.starlightLinkCard, linkCardModule);
  registry.preload(PRELOADED_IDS.starlightSteps, stepsModule);
  registry.preload(PRELOADED_IDS.starlightBadge, badgeModule);
  registry.preload(PRELOADED_IDS.starlightAside, asideModule);
  registry.preload(PRELOADED_IDS.starlightTabs, tabsModule);
  registry.preload(PRELOADED_IDS.starlightTabItem, tabItemModule);
  registry.preload(PRELOADED_IDS.starlightFileTree, fileTreeModule);
  registry.preload(PRELOADED_IDS.starlightCode, codeModule);
}

// initialize Next.js component shims
function initNextjsShims(): void {
  const imageModule = createComponentModule(NextjsShims.Image, 'Image');
  const linkModule = createComponentModule(NextjsShims.Link, 'Link');

  registry.preload(PRELOADED_IDS.nextjsImage, imageModule);
  registry.preload('next/image', imageModule);
  registry.preload(PRELOADED_IDS.nextjsLink, linkModule);
  registry.preload('next/link', linkModule);
}
