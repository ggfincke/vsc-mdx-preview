// packages/extension-host/src/features/diagnostics/ComponentDetector.ts
// detect JSX components in MDX files for diagnostics

import * as vscode from 'vscode';
import { visit } from 'unist-util-visit';
import { classifyComponentSource } from 'mdx-forge/diagnostics/analyze';
import { LogTags, STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import {
  ContentHashCache,
  extractErrorMessage,
} from '@mdx-preview/runtime-utils';
import {
  getCanonicalComponentName,
  getGenericComponentSet,
  type FrameworkId,
} from 'mdx-forge/components/registry';
import type { MdxJsxElement } from 'mdx-forge/compiler';
import {
  analyzeMdxDocument,
  astPositionToRange,
} from '../../shared/mdx-analysis/document-analysis';
import { parseEsmImports } from '../../shared/mdx-analysis/esm-imports';
import type { MdxjsEsmNode } from '../../shared/mdx-analysis/types';
import type {
  ComponentDetectionResult,
  ComponentDetectionOptions,
  ComponentSource,
  DetectedComponent,
} from './types';
import { createTaggedLogger } from '../../shared/logging/logger';
import { COMPONENT_CACHE_MAX_ENTRIES } from '../../shared/constants/runtime';

const log = createTaggedLogger(LogTags.COMPONENT_DETECTOR);

// cache for component detection results w/ content-hash validation
const parseCache = new ContentHashCache<ComponentDetectionResult>({
  maxEntries: COMPONENT_CACHE_MAX_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// fast djb2 hash for content-based cache invalidation
// return hex string for ContentHashCache compatibility
function contentHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// check if name is PascalCase (React component convention)
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

// classify member expressions by the identifier JSX resolves at runtime
function getComponentRoot(name: string): string {
  return name.split('.')[0] ?? name;
}

// lowercase roots are JSX intrinsics regardless of the HTML registry
function isIntrinsic(name: string): boolean {
  return /^[a-z]/.test(getComponentRoot(name));
}

// narrow an element position to its opening & optional closing name tokens
function getTagNameRanges(
  documentLines: readonly string[],
  elementRange: vscode.Range,
  name: string
): vscode.Range[] {
  const openingRange = new vscode.Range(
    elementRange.start.line,
    elementRange.start.character + 1,
    elementRange.start.line,
    elementRange.start.character + 1 + name.length
  );
  const ranges = [openingRange];
  const endLine = documentLines[elementRange.end.line] ?? '';
  const beforeElementEnd = endLine.slice(0, elementRange.end.character);
  const closingStart = beforeElementEnd.lastIndexOf(`</${name}`);

  if (closingStart >= 0) {
    const closingSuffix = beforeElementEnd.slice(
      closingStart + name.length + 2
    );
    if (/^\s*>$/.test(closingSuffix)) {
      ranges.push(
        new vscode.Range(
          elementRange.end.line,
          closingStart + 2,
          elementRange.end.line,
          closingStart + 2 + name.length
        )
      );
    }
  }

  return ranges;
}

// extract component imports from ESM node (PascalCase local names only)
function extractImports(esmNode: MdxjsEsmNode): Map<string, string> {
  const imports = new Map<string, string>();

  for (const parsed of parseEsmImports(
    esmNode.value,
    esmNode.data?.estree ?? undefined
  )) {
    if (parsed.defaultImport && isPascalCase(parsed.defaultImport)) {
      imports.set(parsed.defaultImport, parsed.path);
    }

    if (parsed.namespaceImport && isPascalCase(parsed.namespaceImport)) {
      imports.set(parsed.namespaceImport, parsed.path);
    }

    for (const binding of parsed.named) {
      if (isPascalCase(binding.local)) {
        imports.set(binding.local, parsed.path);
      }
    }
  }

  return imports;
}

function classifyComponent(
  name: string,
  importNames: ReadonlySet<string>,
  configComponents: ReadonlySet<string>,
  framework: FrameworkId
): ComponentSource {
  return classifyComponentSource(name, {
    imports: importNames,
    configComponents,
    framework,
  });
}

// detect JSX components in MDX text
// pass uri parameter to enable caching of parse results
export async function detectComponents(
  mdxText: string,
  options: ComponentDetectionOptions = {},
  configComponents: Set<string> = new Set(),
  // optional: document URI for caching
  uri?: string
): Promise<ComponentDetectionResult> {
  const { includePositions = true, detectImports = true } = options;
  const framework = options.framework ?? 'generic';

  // hoist hash so cache lookup & store share one full-text pass
  const hash = uri ? contentHash(mdxText) : undefined;

  // check cache if URI is provided
  if (uri && hash !== undefined) {
    const cached = parseCache.getIfHashMatches(uri, hash);
    if (cached) {
      log.debug(`Cache hit for ${uri}`);
      return {
        ...cached,
        components: classifyComponents(
          cached.components,
          cached.imports,
          configComponents,
          framework
        ),
      };
    }
  }

  const components: DetectedComponent[] = [];
  const imports = new Map<string, string>();
  const errors: string[] = [];

  try {
    const {
      ast: tree,
      frontmatterLineOffset,
      frontmatterColumnOffset,
    } = analyzeMdxDocument(mdxText);

    if (detectImports) {
      visit(tree, 'mdxjsEsm', (node) => {
        const esmNode = node as unknown as MdxjsEsmNode;
        const nodeImports = extractImports(esmNode);
        for (const [name, path] of nodeImports) {
          imports.set(name, path);
        }
      });
    }

    const importNames = new Set(imports.keys());
    const documentLines = includePositions ? mdxText.split(/\r?\n/) : [];

    visit(tree, (node) => {
      if (
        node.type !== 'mdxJsxFlowElement' &&
        node.type !== 'mdxJsxTextElement'
      ) {
        return;
      }

      const jsxNode = node as unknown as MdxJsxElement;
      const name = jsxNode.name;

      if (!name || isIntrinsic(name)) {
        return;
      }

      const root = getComponentRoot(name);
      if (!isPascalCase(root)) {
        return;
      }

      const source = classifyComponent(
        root,
        importNames,
        configComponents,
        framework
      );

      let range: vscode.Range;
      let tagNameRanges: vscode.Range[];
      if (includePositions && jsxNode.position) {
        const elementRange = astPositionToRange(
          jsxNode.position,
          frontmatterLineOffset,
          frontmatterColumnOffset
        );
        tagNameRanges = getTagNameRanges(documentLines, elementRange, name);
        range = tagNameRanges[0];
      } else {
        range = new vscode.Range(0, 0, 0, 0);
        tagNameRanges = [range];
      }

      components.push({
        name,
        range,
        tagNameRanges,
        source,
        hasChildren: jsxNode.children && jsxNode.children.length > 0,
      });
    });

    log.debug(`Found ${components.length} components`);
  } catch (err) {
    const message = extractErrorMessage(err);
    log.warn(`Parse error: ${message}`);
    errors.push(message);
  }

  const result = { components, imports, errors };

  // store in cache if URI is provided
  if (uri && hash !== undefined) {
    parseCache.setWithHash(uri, hash, result);
    log.debug(`Cached result for ${uri}`);
  }

  return result;
}

function classifyComponents(
  components: readonly DetectedComponent[],
  imports: ReadonlyMap<string, string>,
  configComponents: ReadonlySet<string>,
  framework: FrameworkId
): DetectedComponent[] {
  const importNames = new Set(imports.keys());
  return components.map((component) => ({
    ...component,
    source: classifyComponent(
      getComponentRoot(component.name),
      importNames,
      configComponents,
      framework
    ),
  }));
}

// get unknown components from detection result
export function getUnknownComponents(
  result: ComponentDetectionResult
): DetectedComponent[] {
  return result.components.filter((c) => c.source === 'unknown');
}

// extract list of generic component names used in the MDX
// return canonical names (e.g., Alert -> Callout) for conditional shim preloading
export function getUsedGenericComponents(
  result: ComponentDetectionResult
): string[] {
  const genericNames = getGenericComponentSet();
  const used = new Set<string>();

  for (const component of result.components) {
    // check if this component name is a generic component (including aliases)
    if (genericNames.has(component.name)) {
      // resolve to canonical name (e.g., Alert -> Callout, Accordion -> Collapsible)
      const canonical = getCanonicalComponentName(component.name);
      if (canonical) {
        used.add(canonical);
      }
    }
  }

  return Array.from(used);
}

// invalidate cached component detection for a specific document
// call this when a document is closed or externally modified
export function invalidateComponentCache(uri: string): void {
  if (parseCache.delete(uri)) {
    log.debug(`Invalidated cache for ${uri}`);
  }
}

// clear all cached component detections
// useful for testing or extension reset scenarios
export function clearComponentCache(): void {
  parseCache.clear();
  log.debug('Cache cleared');
}
