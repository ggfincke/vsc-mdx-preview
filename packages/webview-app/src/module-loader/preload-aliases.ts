// packages/webview-app/src/module-loader/preload-aliases.ts
// Webview preload alias mappings - uses shared source of truth for parity with extension

import {
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  SHIM_PREFIX,
  PRELOADED_MODULE_IDS,
  generateFrameworkShimIds,
  generateGenericShimIds,
  generateAllPreloadAliases,
} from '@mdx-preview/shared-types';

// module IDs for preloaded modules (npm:// prefixed canonical IDs)
// combines core modules with generated framework/generic shim IDs
export const PRELOADED_IDS = {
  // Core modules from shared-types
  ...PRELOADED_MODULE_IDS,
  // Generated framework shim IDs
  ...generateFrameworkShimIds(),
  // Generated generic shim IDs
  ...generateGenericShimIds(),
} as const;

// alias mappings: request string -> canonical preloaded ID
// generated from shared-types to ensure parity with extension
export const PRELOAD_ALIASES: Record<string, string> =
  generateAllPreloadAliases();

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
    ...Object.keys(GENERIC_COMPONENTS),
    ...Object.values(GENERIC_COMPONENTS).flatMap((config) => [
      ...config.aliases,
    ]),
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
    const idKey = `generic${name}`;
    if (!(idKey in PRELOADED_IDS)) {
      missing.push(`generic/${name}`);
    }
    for (const alias of config.aliases) {
      const aliasKey = `generic${alias}`;
      if (!(aliasKey in PRELOADED_IDS)) {
        missing.push(`generic/${alias}`);
      }
    }
  }

  // Check framework components
  for (const component of FRAMEWORK_COMPONENTS.docusaurus) {
    const key = `docusaurus${component}`;
    if (!(key in PRELOADED_IDS)) {
      missing.push(`docusaurus/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.starlight) {
    const key = `starlight${component}`;
    if (!(key in PRELOADED_IDS)) {
      missing.push(`starlight/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.nextjs) {
    const key = `nextjs${component}`;
    if (!(key in PRELOADED_IDS)) {
      missing.push(`nextjs/${component}`);
    }
  }

  for (const component of FRAMEWORK_COMPONENTS.nextra) {
    const key = `nextra${component}`;
    if (!(key in PRELOADED_IDS)) {
      missing.push(`nextra/${component}`);
    }
  }

  return { valid: missing.length === 0, missing };
}
