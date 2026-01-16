// packages/extension/diagnostics/ComponentDetector.ts
// detects JSX components in MDX files for diagnostics

import * as vscode from 'vscode';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import matter from 'gray-matter';
import { KNOWN_GENERIC_COMPONENTS } from '../transpiler/mdx/remark-generic-components';
import type {
  DetectedComponent,
  ComponentDetectionResult,
  ComponentDetectionOptions,
  ComponentSource,
} from './types';
import { debug, warn } from '../logging';

// Use shared component registry as single source of truth
import { isFrameworkComponent } from '@mdx-preview/shared-types';

// MDX JSX element node structure from mdast
interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: Array<{ name: string; value: unknown }>;
  children: unknown[];
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

// MDX ESM node (imports/exports)
interface MdxjsEsmNode {
  type: 'mdxjsEsm';
  value: string;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// Note: Using isFrameworkComponent() helper from shared-types instead of local Set

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

// determine component source based on name and imports
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
export async function detectComponents(
  mdxText: string,
  options: ComponentDetectionOptions = {},
  configComponents: Set<string> = new Set()
): Promise<ComponentDetectionResult> {
  const { includePositions = true, detectImports = true } = options;
  const components: DetectedComponent[] = [];
  const imports = new Map<string, string>();
  const errors: string[] = [];

  try {
    // strip frontmatter before parsing
    const { content } = matter(mdxText);

    // parse MDX to AST
    const processor = unified().use(remarkParse).use(remarkMdx);
    const tree = processor.parse(content) as Root;

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

      // skip fragments (<></>) and HTML elements
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
        // convert 1-based to 0-based line/column
        range = new vscode.Range(
          jsxNode.position.start.line - 1,
          jsxNode.position.start.column - 1,
          jsxNode.position.end.line - 1,
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

    debug(`[ComponentDetector] Found ${components.length} components`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`[ComponentDetector] Parse error: ${message}`);
    errors.push(message);
  }

  return { components, imports, errors };
}

// get unknown components from detection result
export function getUnknownComponents(
  result: ComponentDetectionResult
): DetectedComponent[] {
  return result.components.filter((c) => c.source === 'unknown');
}

// export for testing
export { isPascalCase, isHtmlElement, extractImports };
