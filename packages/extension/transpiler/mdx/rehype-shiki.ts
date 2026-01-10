// packages/extension/transpiler/mdx/rehype-shiki.ts
// * syntax highlighting w/ Shiki + meta parsing (line numbers, highlighting, title)

import { visit } from 'unist-util-visit';
import type { Root, Element, Text, ElementContent } from 'hast';
import { htmlToHastFragment } from './rehype-shiki-helpers';
import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from 'shiki';
import { createCssVariablesTheme } from 'shiki/core';

// common languages to pre-bundle (others fall back to plaintext)
const COMMON_LANGUAGES: BundledLanguage[] = [
  // Web fundamentals
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'json',
  'jsonc',
  'css',
  'scss',
  'less',
  'html',
  'vue',
  'svelte',

  // Shell & scripting
  'bash',
  'shell',
  'powershell',

  // Documentation & data
  'markdown',
  'mdx',
  'yaml',
  'toml',
  'xml',
  'graphql',
  'sql',
  'regex',

  // Systems programming
  'c',
  'cpp',
  'rust',
  'go',
  'zig',

  // JVM languages
  'java',
  'kotlin',
  'scala',

  // Apple ecosystem
  'swift',
  'objective-c',

  // Scripting languages
  'python',
  'ruby',
  'php',
  'lua',
  'perl',
  'r',

  // .NET
  'csharp',
  'fsharp',

  // Functional
  'haskell',
  'elixir',
  'clojure',

  // DevOps & config
  'dockerfile',
  'nginx',
  'ini',

  // Other
  'diff',
  'latex',
];

// Create CSS variables theme for dynamic theming
// This theme outputs CSS variables instead of hardcoded colors
const cssVariablesTheme = createCssVariablesTheme({
  name: 'css-variables',
  variablePrefix: '--shiki-',
  variableDefaults: {},
  fontStyle: true,
});

// cached highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [cssVariablesTheme],
      langs: COMMON_LANGUAGES,
    });
  }
  return highlighterPromise;
}

// code meta parsed from fence info: ```ts showLineNumbers {1,3-5} title="example.ts"
interface CodeMeta {
  showLineNumbers: boolean;
  highlightLines: Set<number>;
  title?: string;
}

// parse meta string from code fence
function parseMeta(meta: string | undefined): CodeMeta {
  const result: CodeMeta = {
    showLineNumbers: false,
    highlightLines: new Set(),
    title: undefined,
  };

  if (!meta) {
    return result;
  }

  // showLineNumbers flag
  result.showLineNumbers = /\bshowLineNumbers\b/i.test(meta);

  // {1,3-5} line highlighting
  const lineMatch = meta.match(/\{([^}]+)\}/);
  if (lineMatch) {
    result.highlightLines = parseLineRanges(lineMatch[1]);
  }

  // title="..." or title='...'
  const titleMatch = meta.match(/title=["']([^"']+)["']/);
  if (titleMatch) {
    result.title = titleMatch[1];
  }

  return result;
}

// parse line ranges like "1,3-5,8" into Set of line numbers
function parseLineRanges(rangeStr: string): Set<number> {
  const lines = new Set<number>();
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          lines.add(i);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        lines.add(num);
      }
    }
  }
  return lines;
}

// extract language from class name (e.g., "language-typescript" -> "typescript")
function extractLanguage(className: unknown): string | null {
  if (!className) {
    return null;
  }
  const classes = Array.isArray(className) ? className : [className];
  for (const cls of classes) {
    const str = String(cls);
    if (str.startsWith('language-')) {
      return str.replace('language-', '');
    }
  }
  return null;
}

// check if language is supported
function isLanguageSupported(lang: string): lang is BundledLanguage {
  return COMMON_LANGUAGES.includes(lang as BundledLanguage);
}

// * rehype plugin for Shiki syntax highlighting
export default function rehypeShiki() {
  return async (tree: Root) => {
    const highlighter = await getHighlighter();
    const nodesToProcess: Array<{
      node: Element;
      parent: Element;
      index: number;
      lang: string;
      code: string;
      meta: CodeMeta;
    }> = [];

    // first pass: collect code blocks
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre') {
        return;
      }
      if (typeof index !== 'number' || !parent) {
        return;
      }

      const codeChild = node.children[0];
      if (
        !codeChild ||
        codeChild.type !== 'element' ||
        codeChild.tagName !== 'code'
      ) {
        return;
      }

      // skip mermaid blocks (handled by rehype-mermaid-placeholder)
      const className = codeChild.properties?.className;
      const classNames = Array.isArray(className) ? className : [];
      if (classNames.some((c) => String(c) === 'language-mermaid')) {
        return;
      }

      // extract language & code content
      const lang = extractLanguage(className);
      const textNode = codeChild.children[0] as Text | undefined;
      const code = textNode?.type === 'text' ? textNode.value : '';

      if (!code.trim()) {
        return;
      }

      // parse meta from data attribute (set by MDX/remark)
      const metaStr =
        (codeChild.properties?.['data-meta'] as string) ||
        (node.properties?.['data-meta'] as string) ||
        '';
      const meta = parseMeta(metaStr);

      nodesToProcess.push({
        node,
        parent: parent as Element,
        index,
        lang: lang || 'plaintext',
        code,
        meta,
      });
    });

    // second pass: apply highlighting
    for (const { parent, index, lang, code, meta } of nodesToProcess) {
      try {
        // use supported language or fall back to plaintext
        const highlightLang = isLanguageSupported(lang) ? lang : 'text';

        // generate HTML w/ CSS variables (themeable via external CSS)
        const html = highlighter.codeToHtml(code, {
          lang: highlightLang,
          theme: 'css-variables',
        });

        // create wrapper w/ code block
        const wrapper = createCodeBlockWrapper({
          html,
          lang,
          meta,
          code,
        });

        parent.children[index] = wrapper;
      } catch {
        // on error, leave original code block
      }
    }
  };
}

// create wrapper element w/ code block, title bar, etc.
function createCodeBlockWrapper(options: {
  html: string;
  lang: string;
  meta: CodeMeta;
  code: string;
}): Element {
  const { html, lang, meta, code } = options;

  const children: ElementContent[] = [];

  // optional title bar
  if (meta.title) {
    children.push({
      type: 'element',
      tagName: 'div',
      properties: { className: ['code-title'] },
      children: [{ type: 'text', value: meta.title }],
    });
  }

  // code container w/ CSS variable-based highlighting
  const codeContainer: Element = {
    type: 'element',
    tagName: 'div',
    properties: {
      className: [
        'shiki-container',
        meta.showLineNumbers ? 'with-line-numbers' : '',
      ].filter(Boolean),
      'data-language': lang,
      // for copy button
      'data-code': code,
    },
    children: [
      // single themed version using CSS variables
      ...htmlToHastFragment(html),
    ],
  };

  // apply line highlighting classes if specified
  if (meta.highlightLines.size > 0) {
    codeContainer.properties!['data-highlight-lines'] = Array.from(
      meta.highlightLines
    ).join(',');
  }

  children.push(codeContainer);

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-block-wrapper'] },
    children,
  };
}
