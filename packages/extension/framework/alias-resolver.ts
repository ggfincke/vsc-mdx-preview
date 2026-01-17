// packages/extension/framework/alias-resolver.ts
// resolve framework-specific import aliases (@theme/*, @astrojs/starlight/components, etc.)

import * as path from 'path';
import type { Framework } from './FrameworkDetector';

// Get shared component registry for supported components
import { FRAMEWORK_COMPONENTS, SHIM_PREFIX } from '@mdx-preview/shared-types';

// alias configuration for a framework
export interface AliasConfig {
  // regex pattern to match import request
  pattern: RegExp;
  // resolve function: returns resolved path or null if not matched
  // - match: regex match result
  // - workspaceRoot: workspace root path for @site/* resolution
  resolve: (match: RegExpMatchArray, workspaceRoot: string) => string | null;
}

// Re-export SHIM_PREFIX for backwards compatibility
export { SHIM_PREFIX };

// Get alias configurations for framework
export function getAliasesForFramework(framework: Framework): AliasConfig[] {
  switch (framework) {
    case 'docusaurus':
      return getDocusaurusAliases();
    case 'astro-starlight':
      return getStarlightAliases();
    case 'nextjs':
      return getNextjsAliases();
    case 'nextra':
      return getNextraAliases();
    case 'generic':
    default:
      return [];
  }
}

// Docusaurus aliases
function getDocusaurusAliases(): AliasConfig[] {
  // Get shared registry for supported components
  const supportedShims = FRAMEWORK_COMPONENTS.docusaurus;

  return [
    // @theme/* -> built-in shims
    {
      pattern: /^@theme\/(.+)$/,
      resolve: (match) => {
        const componentName = match[1];
        if ((supportedShims as readonly string[]).includes(componentName)) {
          return `${SHIM_PREFIX}/docusaurus/${componentName}`;
        }
        // Unsupported components return null (will fail import)
        return null;
      },
    },
    // @site/* -> workspace root
    {
      pattern: /^@site\/(.+)$/,
      resolve: (match, workspaceRoot) => {
        const relativePath = match[1];
        return path.join(workspaceRoot, relativePath);
      },
    },
    // @docusaurus/* -> ignore (internal Docusaurus modules)
    {
      pattern: /^@docusaurus\//,
      resolve: () => null,
    },
  ];
}

// Astro Starlight aliases
function getStarlightAliases(): AliasConfig[] {
  // Get shared registry for supported components
  const supportedShims = FRAMEWORK_COMPONENTS.starlight;

  return [
    // @astrojs/starlight/components -> all components from single import
    {
      pattern: /^@astrojs\/starlight\/components$/,
      resolve: () => `${SHIM_PREFIX}/starlight`,
    },
    // individual component imports (if someone destructures)
    {
      pattern: /^@astrojs\/starlight\/components\/(.+)$/,
      resolve: (match) => {
        const componentName = match[1];
        if ((supportedShims as readonly string[]).includes(componentName)) {
          return `${SHIM_PREFIX}/starlight/${componentName}`;
        }
        return null;
      },
    },
  ];
}

// Next.js aliases (minimal - mostly uses mdx-components.tsx)
function getNextjsAliases(): AliasConfig[] {
  return [
    {
      // next/image -> placeholder (images work differently in preview)
      pattern: /^next\/image$/,
      resolve: () => `${SHIM_PREFIX}/nextjs/Image`,
    },
    {
      // next/link -> simple anchor wrapper
      pattern: /^next\/link$/,
      resolve: () => `${SHIM_PREFIX}/nextjs/Link`,
    },
  ];
}

// Nextra aliases (supports both Nextra 3.x & 2.x import patterns)
function getNextraAliases(): AliasConfig[] {
  // Get shared registry for supported components
  const supportedShims = FRAMEWORK_COMPONENTS.nextra;

  return [
    {
      // nextra/components -> all components (Nextra 3.x barrel import)
      pattern: /^nextra\/components$/,
      resolve: () => `${SHIM_PREFIX}/nextra`,
    },
    {
      // nextra-theme-docs -> all components (Nextra 2.x)
      pattern: /^nextra-theme-docs$/,
      resolve: () => `${SHIM_PREFIX}/nextra`,
    },
    {
      // nextra-theme-docs/components -> all components
      pattern: /^nextra-theme-docs\/components$/,
      resolve: () => `${SHIM_PREFIX}/nextra`,
    },
    {
      // Individual component imports (nextra/components/Callout)
      pattern: /^nextra\/components\/(.+)$/,
      resolve: (match) => {
        const componentName = match[1];
        if ((supportedShims as readonly string[]).includes(componentName)) {
          return `${SHIM_PREFIX}/nextra/${componentName}`;
        }
        return null;
      },
    },
  ];
}

// Check if resolved path is a built-in shim
export function isBuiltInShim(resolvedPath: string): boolean {
  return resolvedPath.startsWith(SHIM_PREFIX);
}

// Extract shim info from resolved path
export function parseShimPath(
  resolvedPath: string
): { framework: string; component: string } | null {
  if (!isBuiltInShim(resolvedPath)) {
    return null;
  }

  const withoutPrefix = resolvedPath.slice(SHIM_PREFIX.length + 1);
  const parts = withoutPrefix.split('/');

  if (parts.length === 1) {
    // E.g. @mdx-preview/shims/starlight (all components)
    return { framework: parts[0], component: '*' };
  } else if (parts.length === 2) {
    // E.g. @mdx-preview/shims/docusaurus/Tabs
    return { framework: parts[0], component: parts[1] };
  }

  return null;
}

// Resolve import using framework aliases
export function resolveAlias(
  request: string,
  framework: Framework,
  workspaceRoot: string
): string | null {
  const aliases = getAliasesForFramework(framework);

  for (const alias of aliases) {
    const match = request.match(alias.pattern);
    if (match) {
      return alias.resolve(match, workspaceRoot);
    }
  }

  return null;
}
