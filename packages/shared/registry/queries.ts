// packages/shared/registry/queries.ts
// query & lookup functions for the component registry

import {
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  type GenericComponentName,
} from './registry-data';
import { SHIM_PREFIX, type Framework } from './types';

// cached arrays/sets for O(1) lookups (COMPONENT_REGISTRY is immutable)
let _cachedAllGenericNames: string[] | null = null;
let _cachedGenericSet: Set<string> | null = null;

// get all generic component names including aliases (cached)
export function getAllGenericComponentNames(): string[] {
  if (_cachedAllGenericNames === null) {
    const names: string[] = [];
    for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
      names.push(name, ...config.aliases);
    }
    _cachedAllGenericNames = names;
  }
  return _cachedAllGenericNames;
}

// get Set of all generic component names for O(1) lookup (cached)
export function getGenericComponentSet(): Set<string> {
  if (_cachedGenericSet === null) {
    _cachedGenericSet = new Set(getAllGenericComponentNames());
  }
  return _cachedGenericSet;
}

// get primary generic component names only (no aliases)
export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

// get canonical component name for alias
export function getCanonicalComponentName(
  nameOrAlias: string
): string | undefined {
  if (nameOrAlias in GENERIC_COMPONENTS) {
    return nameOrAlias;
  }

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    if (config.aliases.includes(nameOrAlias)) {
      return name;
    }
  }

  return undefined;
}

// get component names for specific framework
export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly string[] {
  return FRAMEWORK_COMPONENTS[framework];
}

// check if component name is known generic component (including aliases)
export function isGenericComponent(name: string): boolean {
  return getGenericComponentSet().has(name);
}

// check if component name is framework-specific component
export function isFrameworkComponent(
  name: string,
  framework?: Framework
): boolean {
  if (framework) {
    return FRAMEWORK_COMPONENTS[framework].includes(name);
  }

  for (const components of Object.values(FRAMEWORK_COMPONENTS)) {
    if (components.includes(name)) {
      return true;
    }
  }
  return false;
}

// get shim path for generic component
export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

// get shim path for framework component
export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
