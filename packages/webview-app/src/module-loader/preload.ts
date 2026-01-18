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
import * as NextraShims from '../components/shims/nextra';
import * as GenericShims from '../components/shims/generic';

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
// used for framework shim components
// __esModule: true is required for Babel's _interopRequireDefault to work correctly
function createComponentModule<T>(
  component: T,
  name: string
): { __esModule: true; default: T } & Record<string, T> {
  return { __esModule: true as const, default: component, [name]: component };
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
  const mdxModule = { __esModule: true as const, MDXProvider };
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
  initNextraShims();

  // Initialize generic shims (built-in, no framework dependency)
  initGenericShims();
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
  // __esModule: true is required for Babel's interop helpers
  const componentsModule = {
    __esModule: true as const,
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

// initialize Nextra component shims
function initNextraShims(): void {
  // All-in-one module for nextra/components
  // Note: Tabs.Tab and Cards.Card are compound components (accessed via parent)
  // __esModule: true is required for Babel's interop helpers
  const componentsModule = {
    __esModule: true as const,
    Callout: NextraShims.Callout,
    Tabs: NextraShims.Tabs, // Tabs.Tab is a static property on Tabs
    Cards: NextraShims.Cards, // Cards.Card is a static property on Cards
    FileTree: NextraShims.FileTree,
    Steps: NextraShims.Steps,
    Bleed: NextraShims.Bleed,
  };
  registry.preload(PRELOADED_IDS.nextraComponents, componentsModule);
  registry.preload('nextra/components', componentsModule);
  registry.preload('nextra-theme-docs', componentsModule);
  registry.preload('nextra-theme-docs/components', componentsModule);

  // Individual component modules (for granular imports)
  const calloutModule = createComponentModule(NextraShims.Callout, 'Callout');
  const tabsModule = createComponentModule(NextraShims.Tabs, 'Tabs');
  const cardsModule = createComponentModule(NextraShims.Cards, 'Cards');
  const fileTreeModule = createComponentModule(
    NextraShims.FileTree,
    'FileTree'
  );
  const stepsModule = createComponentModule(NextraShims.Steps, 'Steps');
  const bleedModule = createComponentModule(NextraShims.Bleed, 'Bleed');

  registry.preload(PRELOADED_IDS.nextraCallout, calloutModule);
  registry.preload(PRELOADED_IDS.nextraTabs, tabsModule);
  registry.preload(PRELOADED_IDS.nextraCards, cardsModule);
  registry.preload(PRELOADED_IDS.nextraFileTree, fileTreeModule);
  registry.preload(PRELOADED_IDS.nextraSteps, stepsModule);
  registry.preload(PRELOADED_IDS.nextraBleed, bleedModule);
}

// initialize generic component shims (built-in, no framework dependency)
// these provide common component patterns that work in any MDX context
function initGenericShims(): void {
  // Callout variants (Callout, Alert, Admonition all use the same base component)
  const calloutModule = createComponentModule(GenericShims.Callout, 'Callout');
  const alertModule = createComponentModule(GenericShims.Alert, 'Alert');
  const admonitionModule = createComponentModule(
    GenericShims.Admonition,
    'Admonition'
  );

  registry.preload(PRELOADED_IDS.genericCallout, calloutModule);
  registry.preload('Callout', calloutModule);
  registry.preload(PRELOADED_IDS.genericAlert, alertModule);
  registry.preload('Alert', alertModule);
  registry.preload(PRELOADED_IDS.genericAdmonition, admonitionModule);
  registry.preload('Admonition', admonitionModule);

  // Collapsible variants (Collapsible, Accordion, Details)
  const collapsibleModule = createComponentModule(
    GenericShims.Collapsible,
    'Collapsible'
  );
  const accordionModule = createComponentModule(
    GenericShims.Accordion,
    'Accordion'
  );
  const detailsModule = createComponentModule(
    GenericShims.Collapsible,
    'Details'
  );

  registry.preload(PRELOADED_IDS.genericCollapsible, collapsibleModule);
  registry.preload('Collapsible', collapsibleModule);
  registry.preload(PRELOADED_IDS.genericAccordion, accordionModule);
  registry.preload('Accordion', accordionModule);
  registry.preload(PRELOADED_IDS.genericDetails, detailsModule);
  registry.preload('Details', detailsModule);

  // Tab components
  const tabsModule = createComponentModule(GenericShims.Tabs, 'Tabs');
  const tabItemModule = createComponentModule(GenericShims.TabItem, 'TabItem');
  const tabModule = createComponentModule(GenericShims.Tab, 'Tab');

  registry.preload(PRELOADED_IDS.genericTabs, tabsModule);
  registry.preload('Tabs', tabsModule);
  registry.preload(PRELOADED_IDS.genericTabItem, tabItemModule);
  registry.preload('TabItem', tabItemModule);
  registry.preload(PRELOADED_IDS.genericTab, tabModule);
  registry.preload('Tab', tabModule);

  // CodeGroup
  const codeGroupModule = createComponentModule(
    GenericShims.CodeGroup,
    'CodeGroup'
  );

  registry.preload(PRELOADED_IDS.genericCodeGroup, codeGroupModule);
  registry.preload('CodeGroup', codeGroupModule);
}
