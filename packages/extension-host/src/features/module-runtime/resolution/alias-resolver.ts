// packages/extension/module-system/resolver/alias-resolver.ts
// resolve framework-specific import aliases (@theme/*, @astrojs/starlight/components, etc.)

import * as path from 'path';
import type { FrameworkId } from '@mdx-preview/contracts';
import {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
  getCanonicalComponentName,
  isGenericComponent,
} from 'mdx-tools/components/registry';
import { normalizePathSeparators } from '../../../shared/utils/path-utils';

type AliasFrameworkKey = Exclude<FrameworkId, 'generic'>;

type FrameworkAliasMap = Map<string, string>;

const FRAMEWORK_ALIAS_MAPS = buildFrameworkAliasMaps();

function buildFrameworkAliasMaps(): Record<
  AliasFrameworkKey,
  FrameworkAliasMap
> {
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

function toAliasFrameworkKey(framework: FrameworkId): AliasFrameworkKey | null {
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

// check if resolved path is a built-in shim
export function isBuiltInShim(resolvedPath: string): boolean {
  return resolvedPath.startsWith(SHIM_PREFIX);
}

// resolve import using framework aliases
export function resolveAlias(
  request: string,
  framework: FrameworkId,
  workspaceRoot: string
): string | null {
  // handle bare imports of generic component names (Callout, Accordion, Alert, etc.)
  // these are auto-injected by component-mapper.ts & need to resolve to shims
  if (isGenericComponent(request)) {
    const canonical = getCanonicalComponentName(request);
    if (canonical) {
      return `${SHIM_PREFIX}generic/${canonical}`;
    }
  }

  const frameworkKey = toAliasFrameworkKey(framework);
  if (!frameworkKey) {
    return null;
  }

  if (frameworkKey === 'docusaurus') {
    if (request.startsWith('@site/')) {
      return normalizePathSeparators(
        path.join(workspaceRoot, request.slice('@site/'.length))
      );
    }
    if (request.startsWith('@docusaurus/')) {
      return null;
    }
  }

  return resolveFrameworkAlias(request, frameworkKey);
}
