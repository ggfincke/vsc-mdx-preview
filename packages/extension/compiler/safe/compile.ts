// packages/extension/compiler/safe/compile.ts
// * safe MDX parser w/ AST transformation only (no code execution)

import { unified } from 'unified';
import type { Pluggable } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Root, Parent, RootContent } from 'mdast';
import { extractFrontmatter } from '../shared/mdx-common';
import {
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
} from '../plugins/builder';
import { warnIgnoredSafeModeConfig } from '../shared/pipeline-warnings';
import type { ResolvedConfig } from '../../preview/config';
import remarkGenericComponents, {
  KNOWN_GENERIC_COMPONENTS,
} from '../shared/remark/generic-components';
import { getConfigManager } from '../../services';

// import & re-export types from consolidated types file
export type { UnknownBehavior, SafeHTMLResult } from '../types';
import type { UnknownBehavior, SafeHTMLResult } from '../types';

// options for remarkStripMdx plugin
interface RemarkStripMdxOptions {
  unknownBehavior?: UnknownBehavior;
  builtinsEnabled?: boolean;
}

// MDX JSX element node w/ name & children properties
interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  children: RootContent[];
}

// escape HTML special characters for safe output
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// remark plugin to strip MDX-specific nodes (replaces JSX elements & expressions based on behavior)
function remarkStripMdx(options: RemarkStripMdxOptions = {}) {
  const { unknownBehavior = 'placeholder', builtinsEnabled = true } = options;

  return (tree: Root) => {
    const nodesToRemove: Array<{ parent: Parent; index: number }> = [];

    visit(tree, (node, index, parent) => {
      if (index === undefined || parent === undefined) {
        return;
      }

      // remove import/export declarations (mdxjsEsm nodes)
      if (node.type === 'mdxjsEsm') {
        nodesToRemove.push({ parent: parent as Parent, index });
        return;
      }

      // handle JSX flow elements (block-level components)
      if (node.type === 'mdxJsxFlowElement') {
        const jsxNode = node as unknown as MdxJsxElement;
        const name = jsxNode.name || 'Component';

        // check if this is a known generic component (already transformed by remarkGenericComponents)
        // if builtins are enabled & this is a known component, it should have been transformed
        // if we still see it here, it means transformation failed or builtins are disabled
        const isKnownComponent =
          builtinsEnabled && KNOWN_GENERIC_COMPONENTS.has(name);

        const replacement = createJsxReplacement(
          jsxNode,
          name,
          unknownBehavior,
          isKnownComponent,
          true // isFlowElement
        );

        if (replacement === null) {
          // strip: remove entirely
          nodesToRemove.push({ parent: parent as Parent, index });
        } else if (Array.isArray(replacement)) {
          // raw: replace w/ children (splice multiple nodes)
          (parent as Parent).children.splice(index, 1, ...replacement);
        } else {
          // placeholder: replace w/ placeholder node
          (parent as Parent).children[index] = replacement;
        }
        return;
      }

      // handle JSX text elements (inline components)
      if (node.type === 'mdxJsxTextElement') {
        const jsxNode = node as unknown as MdxJsxElement;
        const name = jsxNode.name || 'Component';

        const isKnownComponent =
          builtinsEnabled && KNOWN_GENERIC_COMPONENTS.has(name);

        const replacement = createJsxReplacement(
          jsxNode,
          name,
          unknownBehavior,
          isKnownComponent,
          false // isFlowElement
        );

        if (replacement === null) {
          nodesToRemove.push({ parent: parent as Parent, index });
        } else if (Array.isArray(replacement)) {
          (parent as Parent).children.splice(index, 1, ...replacement);
        } else {
          (parent as Parent).children[index] = replacement;
        }
        return;
      }

      // replace flow expressions {expression} w/ placeholder
      if (node.type === 'mdxFlowExpression') {
        const placeholder: RootContent = {
          type: 'paragraph',
          children: [
            {
              type: 'html',
              value: `<span class="mdx-expression-placeholder" title="JavaScript expression (requires Trusted Mode)">{...}</span>`,
            },
          ],
        };
        (parent as Parent).children[index] = placeholder;
        return;
      }

      // replace text expressions w/ placeholder
      if (node.type === 'mdxTextExpression') {
        const placeholder: RootContent = {
          type: 'html',
          value: `<span class="mdx-expression-placeholder" title="JavaScript expression (requires Trusted Mode)">{...}</span>`,
        } as RootContent;
        (parent as Parent).children[index] = placeholder;
        return;
      }
    });

    // remove collected nodes (in reverse order to preserve indices)
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
      const { parent, index } = nodesToRemove[i];
      parent.children.splice(index, 1);
    }
  };
}

// create replacement for JSX element based on unknownBehavior
function createJsxReplacement(
  node: MdxJsxElement,
  name: string,
  behavior: UnknownBehavior,
  isKnownComponent: boolean,
  isFlowElement: boolean
): RootContent | RootContent[] | null {
  const escapedName = escapeHtml(name);

  switch (behavior) {
    case 'strip':
      // remove entirely
      return null;

    case 'raw':
      // keep children, remove wrapper
      if (node.children && node.children.length > 0) {
        return node.children;
      }
      return null;

    case 'placeholder':
    default: {
      // show placeholder w/ component name & children
      const hint = isKnownComponent
        ? '(builtin component - transform failed)'
        : '(unknown component)';

      if (isFlowElement) {
        // block-level placeholder w/ children
        const hasChildren = node.children && node.children.length > 0;

        if (hasChildren) {
          // create placeholder wrapper w/ children inside
          return {
            type: 'unknownComponent' as RootContent['type'],
            data: {
              hName: 'div',
              hProperties: {
                className: ['mdx-unknown-component-placeholder'],
              },
            },
            children: [
              {
                type: 'html',
                value: `<div class="mdx-unknown-component-header"><span class="mdx-unknown-icon">⚠</span><code>&lt;${escapedName}&gt;</code><span class="mdx-unknown-hint">${hint}</span></div>`,
              },
              {
                type: 'unknownComponentContent' as RootContent['type'],
                data: {
                  hName: 'div',
                  hProperties: {
                    className: ['mdx-unknown-component-content'],
                  },
                },
                children: node.children,
              } as RootContent,
            ],
          } as RootContent;
        } else {
          // self-closing component placeholder
          return {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: `<div class="mdx-unknown-component-placeholder mdx-unknown-component-empty"><div class="mdx-unknown-component-header"><span class="mdx-unknown-icon">⚠</span><code>&lt;${escapedName} /&gt;</code><span class="mdx-unknown-hint">${hint}</span></div></div>`,
              },
            ],
          };
        }
      } else {
        // inline placeholder
        return {
          type: 'html',
          value: `<span class="mdx-jsx-placeholder" title="JSX component ${hint}">&lt;${escapedName} /&gt;</span>`,
        } as RootContent;
      }
    }
  }
}

// apply plugins from array to unified processor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPlugins(processor: any, plugins: Pluggable[]): any {
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      // plugin w/ options: [pluginFn, options]
      processor.use(plugin[0], plugin[1]);
    } else {
      processor.use(plugin);
    }
  }
  return processor;
}

// * compile MDX to safe static HTML (strips frontmatter, parses AST, removes dangerous nodes, & converts to HTML)
export async function compileSafe(
  mdxText: string,
  config?: ResolvedConfig
): Promise<SafeHTMLResult> {
  // warn if custom plugins are configured but will be ignored in Safe Mode
  if (config) {
    warnIgnoredSafeModeConfig(config.config);
  }
  // extract frontmatter before compilation
  const { content, frontmatter } = extractFrontmatter(mdxText);

  // get configuration for builtins & unknown behavior settings
  const configManager = getConfigManager();
  const builtinsEnabled = configManager.get('components.builtins');

  // get unknownBehavior from config file first, then fall back to vscode setting
  const unknownBehavior: UnknownBehavior =
    (config?.config.unknownBehavior as UnknownBehavior) ||
    configManager.get('components.unknownBehavior');

  // build unified pipeline w/ shared plugins via plugin-builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkMdx)
    // transform known generic components to semantic HTML (before stripping)
    .use(remarkGenericComponents, { enabled: builtinsEnabled })
    // strip unknown JSX elements based on configured behavior
    .use(remarkStripMdx, { unknownBehavior, builtinsEnabled });

  // add shared remark plugins (GFM, GitHub alerts, math)
  processor = applyPlugins(processor, getSafeRemarkPlugins());

  // convert to rehype
  processor = processor.use(remarkRehype, { allowDangerousHtml: true });

  // get rehype plugin sets from plugin-builder
  const { preMath, math, postMath } = getSafeRehypePluginSets();

  // add pre-math rehype plugins (mermaid placeholder)
  processor = applyPlugins(processor, preMath);

  // add KaTeX for math rendering
  processor = processor.use(math);

  // add post-math rehype plugins (shiki, slug, autolink, lazy images)
  processor = applyPlugins(processor, postMath);

  // stringify to HTML
  processor = processor.use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.process(content);

  return {
    html: String(result),
    frontmatter: frontmatter as Record<string, unknown>,
  };
}

// Backward-compatible export name
export const compileToSafeHTML = compileSafe;
