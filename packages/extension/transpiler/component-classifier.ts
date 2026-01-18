// packages/extension/transpiler/component-classifier.ts
// unified component classification utility for MDX pipelines
//
// This module provides a single source of truth for classifying component names,
// ensuring both Safe and Trusted modes use identical classification logic.

import {
  isGenericComponent,
  isFrameworkComponent,
  getCanonicalComponentName,
  getGenericComponentSet,
  type Framework,
} from '@mdx-preview/shared-types';

// component type classification
export type ComponentType = 'generic' | 'framework' | 'user' | 'unknown';

// result of classifying a component name
export interface ComponentClassification {
  // whether the component is recognized (not unknown)
  isKnown: boolean;
  // the type of component
  type: ComponentType;
  // primary name if an alias was used (e.g., 'Alert' -> 'Callout')
  canonicalName?: string;
  // which framework the component belongs to (if framework-specific)
  framework?: Framework;
}

// options for component classification
export interface ClassificationOptions {
  // user-defined component mappings from config
  userComponents?: Record<string, string>;
  // detected framework for the project
  framework?: Framework;
}

// cached generic component set for performance
let genericComponentSetCache: Set<string> | null = null;

function getGenericSet(): Set<string> {
  if (!genericComponentSetCache) {
    genericComponentSetCache = getGenericComponentSet();
  }
  return genericComponentSetCache;
}

// classify a component name to determine its type and source
// this is the primary entry point for component classification
export function classifyComponent(
  name: string,
  options: ClassificationOptions = {}
): ComponentClassification {
  const { userComponents, framework } = options;

  // 1. check if user-defined (highest priority)
  if (userComponents && name in userComponents) {
    return {
      isKnown: true,
      type: 'user',
    };
  }

  // 2. check if generic component (including aliases)
  if (isGenericComponent(name)) {
    const canonical = getCanonicalComponentName(name);
    return {
      isKnown: true,
      type: 'generic',
      canonicalName: canonical !== name ? canonical : undefined,
    };
  }

  // 3. check if framework-specific component
  if (framework && isFrameworkComponent(name, framework)) {
    return {
      isKnown: true,
      type: 'framework',
      framework,
    };
  }

  // 4. check all frameworks if no specific framework provided
  if (!framework && isFrameworkComponent(name)) {
    // determine which framework
    const detectedFramework = detectComponentFramework(name);
    return {
      isKnown: true,
      type: 'framework',
      framework: detectedFramework,
    };
  }

  // 5. unknown component
  return {
    isKnown: false,
    type: 'unknown',
  };
}

// determine which framework a component belongs to
function detectComponentFramework(name: string): Framework | undefined {
  const frameworks: Framework[] = [
    'docusaurus',
    'starlight',
    'nextjs',
    'nextra',
  ];
  for (const fw of frameworks) {
    if (isFrameworkComponent(name, fw)) {
      return fw;
    }
  }
  return undefined;
}

// check if a component should be transformed to HTML in Safe Mode
// returns true for generic components that have built-in transforms
export function shouldTransformInSafeMode(name: string): boolean {
  return getGenericSet().has(name);
}

// check if a component should be imported in Trusted Mode
export function shouldImportInTrustedMode(
  name: string,
  options: {
    builtinsEnabled: boolean;
    userComponents?: Record<string, string>;
  }
): boolean {
  const { builtinsEnabled, userComponents } = options;

  // user-defined components always imported
  if (userComponents && name in userComponents) {
    return true;
  }

  // generic components imported if builtins enabled
  if (builtinsEnabled && isGenericComponent(name)) {
    return true;
  }

  return false;
}

// check if a component is a known generic component
// this is a convenience wrapper around the shared-types function
export function isKnownGenericComponent(name: string): boolean {
  return getGenericSet().has(name);
}

// get the primary (canonical) name for a component
// returns the same name if it's already primary, or undefined if unknown
export function getCanonicalName(name: string): string | undefined {
  return getCanonicalComponentName(name);
}

// batch classify multiple components
export function classifyComponents(
  names: string[],
  options: ClassificationOptions = {}
): Map<string, ComponentClassification> {
  const results = new Map<string, ComponentClassification>();
  for (const name of names) {
    results.set(name, classifyComponent(name, options));
  }
  return results;
}

// filter components by type
export function filterByType(
  classifications: Map<string, ComponentClassification>,
  type: ComponentType
): string[] {
  const result: string[] = [];
  for (const [name, classification] of classifications) {
    if (classification.type === type) {
      result.push(name);
    }
  }
  return result;
}

// get summary of classified components
export interface ClassificationSummary {
  total: number;
  generic: number;
  framework: number;
  user: number;
  unknown: number;
  unknownNames: string[];
}

export function getClassificationSummary(
  classifications: Map<string, ComponentClassification>
): ClassificationSummary {
  const summary: ClassificationSummary = {
    total: classifications.size,
    generic: 0,
    framework: 0,
    user: 0,
    unknown: 0,
    unknownNames: [],
  };

  for (const [name, classification] of classifications) {
    switch (classification.type) {
      case 'generic':
        summary.generic++;
        break;
      case 'framework':
        summary.framework++;
        break;
      case 'user':
        summary.user++;
        break;
      case 'unknown':
        summary.unknown++;
        summary.unknownNames.push(name);
        break;
    }
  }

  return summary;
}
