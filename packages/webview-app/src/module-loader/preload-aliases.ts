// packages/webview-app/src/module-loader/preload-aliases.ts
// single source of truth for preloaded module IDs & aliases

// ! import shared component registry for validation & ensure parity w/ shared registry
// run parity tests to verify alignment: npm run test -- preload-parity
import {
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  SHIM_PREFIX,
} from '@mdx-preview/shared-types';

// module IDs for preloaded modules (npm:// prefixed canonical IDs & internal identifiers)
export const PRELOADED_IDS = {
  // React core
  react: 'npm://react@18',
  reactLatest: 'npm://react@latest',
  reactDom: 'npm://react-dom@18',
  reactDomLatest: 'npm://react-dom@latest',
  reactDomClient: 'npm://react-dom/client@18',
  jsxRuntime: 'npm://react/jsx-runtime@18',
  // MDX
  mdxReact: 'npm://@mdx-js/react@3',
  mdxReactLatest: 'npm://@mdx-js/react@latest',
  // Layout
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
  // Generic shims (built-in, no framework dependency)
  genericCallout: 'npm://@mdx-preview/shims-generic/Callout',
  genericAlert: 'npm://@mdx-preview/shims-generic/Alert',
  genericAdmonition: 'npm://@mdx-preview/shims-generic/Admonition',
  genericCollapsible: 'npm://@mdx-preview/shims-generic/Collapsible',
  genericAccordion: 'npm://@mdx-preview/shims-generic/Accordion',
  genericDetails: 'npm://@mdx-preview/shims-generic/Details',
  genericTabs: 'npm://@mdx-preview/shims-generic/Tabs',
  genericTabItem: 'npm://@mdx-preview/shims-generic/TabItem',
  genericTab: 'npm://@mdx-preview/shims-generic/Tab',
  genericCodeGroup: 'npm://@mdx-preview/shims-generic/CodeGroup',
  // Nextra shims (compound components: Tabs.Tab, Cards.Card accessed via parent)
  nextraComponents: 'npm://@mdx-preview/shims-nextra/components',
  nextraCallout: 'npm://@mdx-preview/shims-nextra/Callout',
  nextraTabs: 'npm://@mdx-preview/shims-nextra/Tabs',
  nextraCards: 'npm://@mdx-preview/shims-nextra/Cards',
  nextraFileTree: 'npm://@mdx-preview/shims-nextra/FileTree',
  nextraSteps: 'npm://@mdx-preview/shims-nextra/Steps',
  nextraBleed: 'npm://@mdx-preview/shims-nextra/Bleed',
} as const;

// alias mappings: request string -> canonical preloaded ID
// these allow various import formats to resolve to the same preloaded module
export const PRELOAD_ALIASES: Record<string, string> = {
  // React core aliases
  react: PRELOADED_IDS.react,
  'npm://react': PRELOADED_IDS.react,
  'react-dom': PRELOADED_IDS.reactDom,
  'npm://react-dom': PRELOADED_IDS.reactDom,
  'react-dom/client': PRELOADED_IDS.reactDomClient,
  'npm://react-dom/client': PRELOADED_IDS.reactDomClient,
  'react/jsx-runtime': PRELOADED_IDS.jsxRuntime,
  'npm://react/jsx-runtime': PRELOADED_IDS.jsxRuntime,
  // MDX aliases
  '@mdx-js/react': PRELOADED_IDS.mdxReact,
  'npm://@mdx-js/react': PRELOADED_IDS.mdxReact,
  // Layout aliases
  'vscode-markdown-layout': PRELOADED_IDS.vscodeLayout,
  'npm://vscode-markdown-layout': PRELOADED_IDS.vscodeLayout,
  // Docusaurus @theme/* aliases
  '@theme/Tabs': PRELOADED_IDS.docusaurusTabs,
  '@theme/TabItem': PRELOADED_IDS.docusaurusTabItem,
  '@theme/CodeBlock': PRELOADED_IDS.docusaurusCodeBlock,
  '@theme/Details': PRELOADED_IDS.docusaurusDetails,
  // Direct shim paths
  '@mdx-preview/shims/docusaurus/Tabs': PRELOADED_IDS.docusaurusTabs,
  '@mdx-preview/shims/docusaurus/TabItem': PRELOADED_IDS.docusaurusTabItem,
  '@mdx-preview/shims/docusaurus/CodeBlock': PRELOADED_IDS.docusaurusCodeBlock,
  '@mdx-preview/shims/docusaurus/Details': PRELOADED_IDS.docusaurusDetails,
  // Starlight all-in-one import
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
  // Next.js aliases
  'next/image': PRELOADED_IDS.nextjsImage,
  'next/link': PRELOADED_IDS.nextjsLink,
  '@mdx-preview/shims/nextjs/Image': PRELOADED_IDS.nextjsImage,
  '@mdx-preview/shims/nextjs/Link': PRELOADED_IDS.nextjsLink,
  // Generic shim aliases (direct component names for Trusted Mode)
  Callout: PRELOADED_IDS.genericCallout,
  Alert: PRELOADED_IDS.genericAlert,
  Admonition: PRELOADED_IDS.genericAdmonition,
  Collapsible: PRELOADED_IDS.genericCollapsible,
  Accordion: PRELOADED_IDS.genericAccordion,
  Details: PRELOADED_IDS.genericDetails,
  Tabs: PRELOADED_IDS.genericTabs,
  TabItem: PRELOADED_IDS.genericTabItem,
  Tab: PRELOADED_IDS.genericTab,
  '@mdx-preview/shims/generic/Callout': PRELOADED_IDS.genericCallout,
  '@mdx-preview/shims/generic/Alert': PRELOADED_IDS.genericAlert,
  '@mdx-preview/shims/generic/Admonition': PRELOADED_IDS.genericAdmonition,
  '@mdx-preview/shims/generic/Collapsible': PRELOADED_IDS.genericCollapsible,
  '@mdx-preview/shims/generic/Accordion': PRELOADED_IDS.genericAccordion,
  '@mdx-preview/shims/generic/Details': PRELOADED_IDS.genericDetails,
  '@mdx-preview/shims/generic/Tabs': PRELOADED_IDS.genericTabs,
  '@mdx-preview/shims/generic/TabItem': PRELOADED_IDS.genericTabItem,
  '@mdx-preview/shims/generic/Tab': PRELOADED_IDS.genericTab,
  '@mdx-preview/shims/generic/CodeGroup': PRELOADED_IDS.genericCodeGroup,
  CodeGroup: PRELOADED_IDS.genericCodeGroup,
  // Nextra aliases (barrel imports for all components)
  'nextra/components': PRELOADED_IDS.nextraComponents,
  'nextra-theme-docs': PRELOADED_IDS.nextraComponents,
  'nextra-theme-docs/components': PRELOADED_IDS.nextraComponents,
  '@mdx-preview/shims/nextra': PRELOADED_IDS.nextraComponents,
  // Individual Nextra component shim paths
  '@mdx-preview/shims/nextra/Callout': PRELOADED_IDS.nextraCallout,
  '@mdx-preview/shims/nextra/Tabs': PRELOADED_IDS.nextraTabs,
  '@mdx-preview/shims/nextra/Cards': PRELOADED_IDS.nextraCards,
  '@mdx-preview/shims/nextra/FileTree': PRELOADED_IDS.nextraFileTree,
  '@mdx-preview/shims/nextra/Steps': PRELOADED_IDS.nextraSteps,
  '@mdx-preview/shims/nextra/Bleed': PRELOADED_IDS.nextraBleed,
};

// get list of all IDs that should be preserved during module reset
// this includes both canonical IDs & short-form aliases
export function getPreservedIds(): string[] {
  return [
    ...Object.values(PRELOADED_IDS),
    // Short-form aliases that are also registered directly
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
    // Nextra shims
    'nextra/components',
    'nextra-theme-docs',
    'nextra-theme-docs/components',
    // Generic shims (direct component names)
    'Callout',
    'Alert',
    'Admonition',
    'Collapsible',
    'Accordion',
    'Details',
    'Tabs',
    'TabItem',
    'Tab',
    'CodeGroup',
  ];
}

// Re-export for parity testing
export { GENERIC_COMPONENTS, FRAMEWORK_COMPONENTS, SHIM_PREFIX };

// Validate that preloaded IDs cover all components from the shared registry
// This is used by parity tests to ensure the webview stays in sync
export function validateRegistryParity(): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  // Check generic components
  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    const idKey = `generic${name}` as keyof typeof PRELOADED_IDS;
    if (!PRELOADED_IDS[idKey]) {
      missing.push(`generic/${name}`);
    }
    for (const alias of config.aliases) {
      const aliasKey = `generic${alias}` as keyof typeof PRELOADED_IDS;
      if (!PRELOADED_IDS[aliasKey]) {
        missing.push(`generic/${alias}`);
      }
    }
  }

  // Check framework components
  for (const component of FRAMEWORK_COMPONENTS.docusaurus) {
    const key = `docusaurus${component}` as keyof typeof PRELOADED_IDS;
    if (!PRELOADED_IDS[key]) {
      missing.push(`docusaurus/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.starlight) {
    const key = `starlight${component}` as keyof typeof PRELOADED_IDS;
    if (!PRELOADED_IDS[key]) {
      missing.push(`starlight/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.nextjs) {
    const key = `nextjs${component}` as keyof typeof PRELOADED_IDS;
    if (!PRELOADED_IDS[key]) {
      missing.push(`nextjs/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.nextra) {
    const key = `nextra${component}` as keyof typeof PRELOADED_IDS;
    if (!PRELOADED_IDS[key]) {
      missing.push(`nextra/${component}`);
    }
  }

  return { valid: missing.length === 0, missing };
}
