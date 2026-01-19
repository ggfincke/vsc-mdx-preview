// packages/extension/module-system/resolver/alias-resolver.ts
// resolve framework-specific import aliases (@theme/*, @astrojs/starlight/components, etc.)

import * as path from 'path';
import type { Framework } from '../../framework/FrameworkDetector';
import {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
  type FrameworkId,
} from '@mdx-preview/shared';


type AliasFrameworkKey = Exclude<FrameworkId, 'generic'>;

type FrameworkAliasMap = Map<string, string>;

const FRAMEWORK_ALIAS_MAPS = buildFrameworkAliasMaps();

function buildFrameworkAliasMaps(): Record<AliasFrameworkKey, FrameworkAliasMap> {
  const maps: Record<AliasFrameworkKey, FrameworkAliasMap> = {
    docusaurus: new Map(),
    starlight: new Map(),
    nextjs: new Map(),
    nextra: new Map(),
  };

  for (const entry of COMPONENT_REGISTRY) {
    if (entry.framework === 'generic') {
      continue;
    }

    const map = maps[entry.framework];
    for (const specifier of entry.importSpecifiers) {
      map.set(specifier, entry.shimPath);
    }
  }

  return maps;
}

function toAliasFrameworkKey(framework: Framework): AliasFrameworkKey | null {
  if (framework === 'astro-starlight') {
    return 'starlight';
  }
  if (framework === 'generic') {
    return null;
  }
  return framework;
}

function resolveFrameworkAlias(
  request: string,
  framework: AliasFrameworkKey
): string | null {
  return FRAMEWORK_ALIAS_MAPS[framework].get(request) ?? null;
}

// Check if resolved path is a built-in shim
export function isBuiltInShim(resolvedPath: string): boolean {
  return resolvedPath.startsWith(SHIM_PREFIX);
}

// Resolve import using framework aliases
export function resolveAlias(
  request: string,
  framework: Framework,
  workspaceRoot: string
): string | null {
  const frameworkKey = toAliasFrameworkKey(framework);
  if (!frameworkKey) {
    return null;
  }

  if (frameworkKey === 'docusaurus') {
    if (request.startsWith('@site/')) {
      return path.join(workspaceRoot, request.slice('@site/'.length));
    }
    if (request.startsWith('@docusaurus/')) {
      return null;
    }
  }

  return resolveFrameworkAlias(request, frameworkKey);
}
