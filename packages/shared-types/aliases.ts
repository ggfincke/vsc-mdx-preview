// packages/shared-types/aliases.ts
// Single source of truth for alias mappings between extension and webview
// Extension resolves imports to shim paths, webview maps shim paths to preloaded IDs

import {
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  SHIM_PREFIX,
} from './components';

// Canonical preloaded module IDs (npm:// prefixed)
export const PRELOADED_MODULE_IDS = {
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
} as const;

// Framework shim ID generators - generate canonical preloaded IDs for framework shims
export function getDocusaurusShimId(component: string): string {
  return `npm://@mdx-preview/shims-docusaurus/${component}`;
}

export function getStarlightShimId(component: string): string {
  return `npm://@mdx-preview/shims-starlight/${component}`;
}

export function getNextjsShimId(component: string): string {
  return `npm://@mdx-preview/shims-nextjs/${component}`;
}

export function getNextraShimId(component: string): string {
  return `npm://@mdx-preview/shims-nextra/${component}`;
}

export function getGenericShimId(component: string): string {
  return `npm://@mdx-preview/shims-generic/${component}`;
}

// Maps extension's resolved shim path to webview's preloaded ID
// Extension resolves: @theme/Tabs -> @mdx-preview/shims/docusaurus/Tabs
// Webview needs: @mdx-preview/shims/docusaurus/Tabs -> npm://@mdx-preview/shims-docusaurus/Tabs
export function shimPathToPreloadId(shimPath: string): string | null {
  if (!shimPath.startsWith(SHIM_PREFIX)) {
    return null;
  }

  const withoutPrefix = shimPath.slice(SHIM_PREFIX.length + 1); // +1 for '/'
  const [framework, ...rest] = withoutPrefix.split('/');
  const component = rest.join('/') || undefined;

  switch (framework) {
    case 'docusaurus':
      return component ? getDocusaurusShimId(component) : null;
    case 'starlight':
      return component
        ? getStarlightShimId(component)
        : 'npm://@mdx-preview/shims-starlight/components';
    case 'nextjs':
      return component ? getNextjsShimId(component) : null;
    case 'nextra':
      return component
        ? getNextraShimId(component)
        : 'npm://@mdx-preview/shims-nextra/components';
    case 'generic':
      return component ? getGenericShimId(component) : null;
    default:
      return null;
  }
}

// Generate all framework component preload IDs as a record
// Returns: { docusaurusTabs: 'npm://...', starlightCard: 'npm://...', ... }
export function generateFrameworkShimIds(): Record<string, string> {
  const ids: Record<string, string> = {};

  // Docusaurus components
  for (const component of FRAMEWORK_COMPONENTS.docusaurus) {
    ids[`docusaurus${component}`] = getDocusaurusShimId(component);
  }

  // Starlight components
  ids['starlightComponents'] = 'npm://@mdx-preview/shims-starlight/components';
  for (const component of FRAMEWORK_COMPONENTS.starlight) {
    ids[`starlight${component}`] = getStarlightShimId(component);
  }

  // Next.js components
  for (const component of FRAMEWORK_COMPONENTS.nextjs) {
    ids[`nextjs${component}`] = getNextjsShimId(component);
  }

  // Nextra components
  ids['nextraComponents'] = 'npm://@mdx-preview/shims-nextra/components';
  for (const component of FRAMEWORK_COMPONENTS.nextra) {
    ids[`nextra${component}`] = getNextraShimId(component);
  }

  return ids;
}

// Generate generic component preload IDs including aliases
export function generateGenericShimIds(): Record<string, string> {
  const ids: Record<string, string> = {};

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    ids[`generic${name}`] = getGenericShimId(name);
    for (const alias of config.aliases) {
      ids[`generic${alias}`] = getGenericShimId(alias);
    }
  }

  return ids;
}

// Generate framework alias mappings for webview PRELOAD_ALIASES
// Maps import specifiers to preloaded module IDs
export function generateFrameworkPreloadAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};

  // Docusaurus @theme/* aliases
  for (const component of FRAMEWORK_COMPONENTS.docusaurus) {
    const themeAlias = `@theme/${component}`;
    const shimPath = `${SHIM_PREFIX}/docusaurus/${component}`;
    const preloadId = getDocusaurusShimId(component);

    aliases[themeAlias] = preloadId;
    aliases[shimPath] = preloadId;
  }

  // Starlight aliases
  aliases['@astrojs/starlight/components'] =
    'npm://@mdx-preview/shims-starlight/components';
  for (const component of FRAMEWORK_COMPONENTS.starlight) {
    const shimPath = `${SHIM_PREFIX}/starlight/${component}`;
    aliases[shimPath] = getStarlightShimId(component);
  }

  // Next.js aliases
  aliases['next/image'] = getNextjsShimId('Image');
  aliases['next/link'] = getNextjsShimId('Link');
  aliases[`${SHIM_PREFIX}/nextjs/Image`] = getNextjsShimId('Image');
  aliases[`${SHIM_PREFIX}/nextjs/Link`] = getNextjsShimId('Link');

  // Nextra aliases
  aliases['nextra/components'] = 'npm://@mdx-preview/shims-nextra/components';
  aliases['nextra-theme-docs'] = 'npm://@mdx-preview/shims-nextra/components';
  aliases['nextra-theme-docs/components'] =
    'npm://@mdx-preview/shims-nextra/components';
  aliases[`${SHIM_PREFIX}/nextra`] =
    'npm://@mdx-preview/shims-nextra/components';
  for (const component of FRAMEWORK_COMPONENTS.nextra) {
    const shimPath = `${SHIM_PREFIX}/nextra/${component}`;
    aliases[shimPath] = getNextraShimId(component);
  }

  return aliases;
}

// Generate generic component aliases for webview PRELOAD_ALIASES
// Maps component names and shim paths to preloaded module IDs
export function generateGenericPreloadAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    // Primary name alias
    aliases[name] = getGenericShimId(name);
    aliases[`${SHIM_PREFIX}/generic/${name}`] = getGenericShimId(name);

    // Alias mappings
    for (const alias of config.aliases) {
      aliases[alias] = getGenericShimId(alias);
      aliases[`${SHIM_PREFIX}/generic/${alias}`] = getGenericShimId(alias);
    }
  }

  return aliases;
}

// Generate core module aliases (React, MDX, etc.)
export function generateCorePreloadAliases(): Record<string, string> {
  return {
    // React core aliases
    react: PRELOADED_MODULE_IDS.react,
    'npm://react': PRELOADED_MODULE_IDS.react,
    'react-dom': PRELOADED_MODULE_IDS.reactDom,
    'npm://react-dom': PRELOADED_MODULE_IDS.reactDom,
    'react-dom/client': PRELOADED_MODULE_IDS.reactDomClient,
    'npm://react-dom/client': PRELOADED_MODULE_IDS.reactDomClient,
    'react/jsx-runtime': PRELOADED_MODULE_IDS.jsxRuntime,
    'npm://react/jsx-runtime': PRELOADED_MODULE_IDS.jsxRuntime,
    // MDX aliases
    '@mdx-js/react': PRELOADED_MODULE_IDS.mdxReact,
    'npm://@mdx-js/react': PRELOADED_MODULE_IDS.mdxReact,
    // Layout aliases
    'vscode-markdown-layout': PRELOADED_MODULE_IDS.vscodeLayout,
    'npm://vscode-markdown-layout': PRELOADED_MODULE_IDS.vscodeLayout,
  };
}

// Generate all preload aliases - combine core, framework, and generic aliases
export function generateAllPreloadAliases(): Record<string, string> {
  return {
    ...generateCorePreloadAliases(),
    ...generateFrameworkPreloadAliases(),
    ...generateGenericPreloadAliases(),
  };
}

// Types
export type PreloadedModuleId =
  (typeof PRELOADED_MODULE_IDS)[keyof typeof PRELOADED_MODULE_IDS];
