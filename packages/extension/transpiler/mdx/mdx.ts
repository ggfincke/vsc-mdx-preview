// packages/extension/transpiler/mdx/mdx.ts
// MDX transpilation w/ layout injection & React root wrapping

import { compile } from '@mdx-js/mdx';
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
const wrapCompiledMdx = (compiledMDX: string): string => {
  // all MDX exports component (webview's single React root handles rendering)
  return `
// MDX 3 function-body compiled output
import React from 'react';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
${compiledMDX}
export default MDXContent;
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
    outputFormat: 'function-body',
    development: false,
    jsx: false,
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
  });

  return wrapCompiledMdx(compiled.toString());
};
