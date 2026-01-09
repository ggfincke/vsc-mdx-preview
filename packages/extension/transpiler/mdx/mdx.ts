// packages/extension/transpiler/mdx/mdx.ts
// MDX transpilation w/ layout injection & React root wrapping

import { compile } from '@mdx-js/mdx';
import rehypeRaw from './rehype-raw';
import hasDefaultExport from './hasDefaultExport';
import matter from 'gray-matter';
import * as path from 'path';

import { Preview } from '../../preview/preview-manager';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';

// result type for MDX transpilation (includes frontmatter)
export interface MdxTranspileResult {
  code: string;
  frontmatter: Record<string, unknown>;
}

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

// wrap compiled MDX output (webview owns single React root & handle rendering)
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
): Promise<MdxTranspileResult> => {
  // extract frontmatter before compilation
  const { content, data: frontmatter } = matter(mdxText);

  let mdxTextToCompile: string;
  if (!hasDefaultExport(content)) {
    mdxTextToCompile = injectMDXStyles(content, preview);
  } else {
    mdxTextToCompile = content;
  }

  const compiled = await compile(mdxTextToCompile, {
    outputFormat: 'program',
    development: false,
    jsx: false,
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    // remark plugins: GFM, GitHub alerts, math (shared w/ Safe Mode)
    remarkPlugins: sharedRemarkPlugins,
    // rehype plugins: sourcepos, mermaid, math, raw HTML, syntax, anchors, lazy images
    rehypePlugins: [
      ...sharedRehypePluginsPreMath,
      rehypeKatex,
      // Trusted-only: convert raw HTML from KaTeX to JSX
      rehypeRaw,
      ...sharedRehypePluginsPostMath,
    ],
  });

  return {
    code: wrapCompiledMdx(compiled.toString()),
    frontmatter: frontmatter as Record<string, unknown>,
  };
};
