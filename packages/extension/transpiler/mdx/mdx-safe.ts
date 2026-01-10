// packages/extension/transpiler/mdx/mdx-safe.ts
// * safe MDX parser w/ AST transformation only (no code execution)

import { unified } from 'unified';
import type { Pluggable } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Root, Parent, RootContent } from 'mdast';
import matter from 'gray-matter';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';
import { warn } from '../../logging';
import type { ResolvedConfig } from '../../preview/config';

// result type for Safe Mode HTML compilation (includes frontmatter)
export interface SafeHTMLResult {
  html: string;
  frontmatter: Record<string, unknown>;
}

// MDX JSX element node w/ name property
interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
}

// remark plugin to strip MDX-specific nodes (replaces JSX elements & expressions w/ placeholders)
function remarkStripMdx() {
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

      // replace JSX flow elements w/ placeholder
      if (node.type === 'mdxJsxFlowElement') {
        const jsxNode = node as unknown as MdxJsxElement;
        const name = jsxNode.name || 'Component';
        const placeholder: RootContent = {
          type: 'paragraph',
          children: [
            {
              type: 'html',
              value: `<span class="mdx-jsx-placeholder" title="JSX component (requires Trusted Mode)">&lt;${name} /&gt;</span>`,
            },
          ],
        };
        (parent as Parent).children[index] = placeholder;
        return;
      }

      // replace JSX text elements w/ placeholder
      if (node.type === 'mdxJsxTextElement') {
        const jsxNode = node as unknown as MdxJsxElement;
        const name = jsxNode.name || 'Component';
        const placeholder = {
          type: 'html' as const,
          value: `<span class="mdx-jsx-placeholder" title="JSX component (requires Trusted Mode)">&lt;${name} /&gt;</span>`,
        };
        (parent as Parent).children[index] = placeholder as RootContent;
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
        } as any;
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

// * compile MDX to safe static HTML (strips frontmatter, parses AST, removes dangerous nodes, converts to HTML)
export async function compileToSafeHTML(
  mdxText: string,
  config?: ResolvedConfig
): Promise<SafeHTMLResult> {
  // warn if custom plugins are configured but will be ignored in Safe Mode
  if (config) {
    const { remarkPlugins, rehypePlugins, components } = config.config;
    const hasCustomPlugins =
      (remarkPlugins && remarkPlugins.length > 0) ||
      (rehypePlugins && rehypePlugins.length > 0);
    const hasComponents = components && Object.keys(components).length > 0;

    if (hasCustomPlugins || hasComponents) {
      warn(
        'Custom plugins and components from .mdx-previewrc.json are ignored in Safe Mode. ' +
          'Enable Trusted Mode to use custom plugins.'
      );
    }
  }
  // extract frontmatter before compilation
  const { content, data: frontmatter } = matter(mdxText);

  // build unified pipeline w/ shared plugins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkStripMdx);

  // add shared remark plugins (GFM, GitHub alerts, math)
  processor = applyPlugins(processor, sharedRemarkPlugins);

  // convert to rehype
  processor = processor.use(remarkRehype, { allowDangerousHtml: true });

  // add pre-math rehype plugins (sourcepos, mermaid)
  processor = applyPlugins(processor, sharedRehypePluginsPreMath);

  // add KaTeX for math rendering
  processor = processor.use(rehypeKatex);

  // add post-math rehype plugins (shiki, slug, autolink, lazy images)
  processor = applyPlugins(processor, sharedRehypePluginsPostMath);

  // stringify to HTML
  processor = processor.use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.process(content);

  return {
    html: String(result),
    frontmatter: frontmatter as Record<string, unknown>,
  };
}
