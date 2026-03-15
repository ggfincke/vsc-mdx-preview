// packages/extension-host/src/features/diagnostics/ComponentDetector.ts
// detect JSX components in MDX files for diagnostics

import * as vscode from 'vscode';
import { visit } from 'unist-util-visit';
import { analyzeMdxDocument } from '../language/mdx-document-analysis';
import { KNOWN_GENERIC_COMPONENTS } from 'mdx-forge/compiler';
import { LogTags, STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import {
  ContentHashCache,
  extractErrorMessage,
} from '@mdx-preview/runtime-utils';
import type {
  DetectedComponent,
  ComponentDetectionResult,
  ComponentDetectionOptions,
  ComponentSource,
  MdxJsxElement,
} from '../types';
import { createTaggedLogger } from '../../shared/logging/logger';
import { COMPONENT_CACHE_MAX_ENTRIES } from '../../shared/constants/runtime';

// use shared component registry as single source of truth
import {
  getCanonicalComponentName,
  getGenericComponentSet,
  isFrameworkComponent,
} from 'mdx-forge/components/registry';

const log = createTaggedLogger(LogTags.COMPONENT_DETECTOR);

// caching for parse results

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

// types

// MDX ESM node (imports/exports)
interface MdxjsEsmNode {
  type: 'mdxjsEsm';
  value: string;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// using isFrameworkComponent() helper from shared instead of local Set

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

// extract component imports from ESM node
function extractImports(esmValue: string): Map<string, string> {
  const imports = new Map<string, string>();

  // match import statements
  // import Foo from 'path'
  // import { Foo, Bar } from 'path'
  // import { Foo as Baz } from 'path'
  // import * as Foo from 'path'
  const importRegex =
    /import\s+(?:(\w+)|(?:\{([^}]+)\})|(?:\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(esmValue)) !== null) {
    const defaultImport = match[1];
    const namedImports = match[2];
    const namespaceImport = match[3];
    const importPath = match[4];

    if (defaultImport && isPascalCase(defaultImport)) {
      imports.set(defaultImport, importPath);
    }

    if (namespaceImport && isPascalCase(namespaceImport)) {
      imports.set(namespaceImport, importPath);
    }

    if (namedImports) {
      // parse named imports: { Foo, Bar as Baz }
      const namedParts = namedImports.split(',').map((s) => s.trim());
      for (const part of namedParts) {
        const asMatch = part.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch) {
          const localName = asMatch[2];
          if (isPascalCase(localName)) {
            imports.set(localName, importPath);
          }
        } else {
          const name = part.trim();
          if (isPascalCase(name)) {
            imports.set(name, importPath);
          }
        }
      }
    }
  }

  return imports;
}

// determine component source based on name & imports
function determineComponentSource(
  name: string,
  imports: Map<string, string>,
  configComponents: Set<string>
): ComponentSource {
  // check if explicitly imported
  if (imports.has(name)) {
    return 'import';
  }

  // check if defined in config
  if (configComponents.has(name)) {
    return 'config';
  }

  // check if builtin generic component
  if (KNOWN_GENERIC_COMPONENTS.has(name)) {
    return 'builtin';
  }

  // check if framework shim
  if (isFrameworkComponent(name)) {
    return 'framework';
  }

  return 'unknown';
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

  // check cache if URI is provided
  if (uri) {
    const hash = contentHash(mdxText);
    const cached = parseCache.getIfHashMatches(uri, hash);
    if (cached) {
      log.debug(`Cache hit for ${uri}`);
      return cached;
    }
  }

  const components: DetectedComponent[] = [];
  const imports = new Map<string, string>();
  const errors: string[] = [];

  try {
    // parse MDX w/ shared helper (handles frontmatter stripping & offset)
    const { ast: tree, frontmatterLineOffset } = analyzeMdxDocument(mdxText);

    // first pass: collect imports
    if (detectImports) {
      visit(tree, 'mdxjsEsm', (node) => {
        const esmNode = node as unknown as MdxjsEsmNode;
        const nodeImports = extractImports(esmNode.value);
        for (const [name, path] of nodeImports) {
          imports.set(name, path);
        }
      });
    }

    // second pass: detect JSX components
    visit(tree, (node) => {
      if (
        node.type !== 'mdxJsxFlowElement' &&
        node.type !== 'mdxJsxTextElement'
      ) {
        return;
      }

      const jsxNode = node as unknown as MdxJsxElement;
      const name = jsxNode.name;

      // skip fragments (<></>) & HTML elements
      if (!name || isHtmlElement(name)) {
        return;
      }

      // only track PascalCase components (React convention)
      if (!isPascalCase(name)) {
        return;
      }

      const source = determineComponentSource(name, imports, configComponents);

      let range: vscode.Range;
      if (includePositions && jsxNode.position) {
        // convert 1-based to 0-based & adjust for frontmatter offset
        range = new vscode.Range(
          jsxNode.position.start.line - 1 + frontmatterLineOffset,
          jsxNode.position.start.column - 1,
          jsxNode.position.end.line - 1 + frontmatterLineOffset,
          jsxNode.position.end.column - 1
        );
      } else {
        // fallback to start of file
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
  if (uri) {
    parseCache.setWithHash(uri, contentHash(mdxText), result);
    log.debug(`Cached result for ${uri}`);
  }

  return result;
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
