// packages/extension-host/src/features/diagnostics/ComponentDetector.ts
// detect JSX components in MDX files for diagnostics

import * as vscode from 'vscode';
import { visit } from 'unist-util-visit';
import {
  analyzeMdxDocument,
  astPositionToRange,
} from '../language/mdx-document-analysis';
import { parseEsmImports } from '../language/esm-imports';
import { classifyComponentSource } from 'mdx-forge/diagnostics/analyze';
import { LogTags, STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import {
  ContentHashCache,
  extractErrorMessage,
} from '@mdx-preview/runtime-utils';
import type {
  ComponentDetectionResult,
  ComponentDetectionOptions,
  ComponentSource,
  DetectedComponent,
  MdxJsxElement,
  MdxjsEsmNode,
} from '../types';
import { createTaggedLogger } from '../../shared/logging/logger';
import { COMPONENT_CACHE_MAX_ENTRIES } from '../../shared/constants/runtime';

// use shared component registry as single source of truth
import {
  getCanonicalComponentName,
  getGenericComponentSet,
  type FrameworkId,
} from 'mdx-forge/components/registry';

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

// HTML element names (lowercase) - not components
const HTML_ELEMENTS = new Set([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
]);

// check if name is PascalCase (React component convention)
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

// check if name is an HTML element
function isHtmlElement(name: string): boolean {
  return HTML_ELEMENTS.has(name.toLowerCase());
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

    visit(tree, (node) => {
      if (
        node.type !== 'mdxJsxFlowElement' &&
        node.type !== 'mdxJsxTextElement'
      ) {
        return;
      }

      const jsxNode = node as unknown as MdxJsxElement;
      const name = jsxNode.name;

      if (!name || isHtmlElement(name)) {
        return;
      }

      if (!isPascalCase(name)) {
        return;
      }

      const source = classifyComponent(
        name,
        importNames,
        configComponents,
        framework
      );

      let range: vscode.Range;
      if (includePositions && jsxNode.position) {
        range = astPositionToRange(
          jsxNode.position,
          frontmatterLineOffset,
          frontmatterColumnOffset
        );
      } else {
        range = new vscode.Range(0, 0, 0, 0);
      }

      components.push({
        name,
        range,
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
      component.name,
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

// isPascalCase, isHtmlElement, extractImports are internal helpers
