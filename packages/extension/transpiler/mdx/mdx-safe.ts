// packages/extension/transpiler/mdx/mdx-safe.ts
// * safe MDX parser w/ AST transformation only (no code execution)

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Root, Parent, RootContent } from 'mdast';
import matter from 'gray-matter';

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

// * compile MDX to safe static HTML (strips frontmatter, parses AST, removes dangerous nodes, converts to HTML)
export async function compileToSafeHTML(mdxText: string): Promise<string> {
  // strip frontmatter
  const { content } = matter(mdxText);

  // process through unified pipeline
  const result = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkStripMdx)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  return String(result);
}

// get CSS for Safe Mode placeholders (injected to make placeholders visible)
export function getSafeModePlaceholderStyles(): string {
  return `
    .mdx-jsx-placeholder,
    .mdx-expression-placeholder {
      display: inline-block;
      padding: 2px 6px;
      margin: 2px;
      background-color: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
      border: 1px dashed var(--vscode-textBlockQuote-border, rgba(127, 127, 127, 0.3));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground, #717171);
      cursor: help;
    }
    
    .mdx-jsx-placeholder::before {
      content: "JSX: ";
      opacity: 0.7;
    }
    
    .mdx-expression-placeholder::before {
      content: "Expression: ";
      opacity: 0.7;
    }
  `;
}
