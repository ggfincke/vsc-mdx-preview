// packages/extension/transpiler/mdx/mdx.ts
// MDX transpilation w/ layout injection & React root wrapping

import { compile } from '@mdx-js/mdx';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSourcepos from './rehype-sourcepos';
import hasDefaultExport from './hasDefaultExport';
import * as path from 'path';

import { Preview } from '../../preview/preview-manager';

// inject MDX layout styles based on configuration
const injectMDXStyles = (mdxText: string, preview: Preview): string => {
  const { customLayoutFilePath, useVscodeMarkdownStyles, useWhiteBackground } =
    preview.configuration;

  if (customLayoutFilePath) {
    try {
      const currentPreviewDirname = path.dirname(preview.doc.uri.fsPath);
      const relativeCustomLayoutPath = path.relative(
        currentPreviewDirname,
        customLayoutFilePath
      );
      return `import Layout from '.${path.sep}${relativeCustomLayoutPath}';

export default Layout;

${mdxText}`;
    } catch {
      return mdxText;
    }
  } else if (useVscodeMarkdownStyles) {
    const layoutOptions = useWhiteBackground
      ? '{ forceLightTheme: true }'
      : '{}';
    return `import { createLayout } from 'vscode-markdown-layout';

export default createLayout(${layoutOptions});

${mdxText}`;
  } else {
    return mdxText;
  }
};

// wrap compiled MDX output (webview owns single React root & handles rendering)
// MDX w/ outputFormat: 'program' generates ES module w/ default export
const wrapCompiledMdx = (compiledMDX: string): string => {
  return `
// MDX 3 compiled output
import React from 'react';
${compiledMDX}
`;
};

// transpile MDX to JavaScript (w/ layout injection if no default export)
export const mdxTranspileAsync = async (
  mdxText: string,
  _isEntry: boolean,
  preview: Preview
): Promise<string> => {
  let mdxTextToCompile: string;
  if (!hasDefaultExport(mdxText)) {
    mdxTextToCompile = injectMDXStyles(mdxText, preview);
  } else {
    mdxTextToCompile = mdxText;
  }

  const compiled = await compile(mdxTextToCompile, {
    outputFormat: 'program',
    development: false,
    jsx: false,
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    // Phase 2.2: Add sourcepos for scroll sync (must be before slug)
    // Phase 2.4: Add heading anchors for TOC support
    rehypePlugins: [
      rehypeSourcepos,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: {
            className: ['anchor-link'],
            ariaLabel: 'Link to this section',
          },
        },
      ],
    ],
  });

  return wrapCompiledMdx(compiled.toString());
};
