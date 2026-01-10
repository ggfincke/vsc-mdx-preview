// packages/extension/transpiler/mdx/mdx.ts
// MDX transpilation w/ layout injection & React root wrapping

import { compile } from '@mdx-js/mdx';
import rehypeRaw from './rehype-raw';
import hasDefaultExport from './hasDefaultExport';
import matter from 'gray-matter';
import * as path from 'path';
import type { Pluggable } from 'unified';

import { Preview } from '../../preview/preview-manager';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';
import {
  loadPluginsFromConfig,
  mergePlugins,
  generateComponentImports,
} from '../plugin-loader';
import { warn } from '../../logging';

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
// when componentsObject is provided, wrap w/ MDXProvider for shortcode support
const wrapCompiledMdx = (
  compiledMDX: string,
  componentsObject?: string
): string => {
  if (componentsObject && componentsObject !== '{}') {
    // wrap with MDXProvider to make custom components available as shortcodes
    return `
// MDX 3 compiled output w/ custom components
import React from 'react';
import { MDXProvider } from '@mdx-js/react';
${compiledMDX}

const _MDXComponents = ${componentsObject};
const _OriginalDefault = MDXContent;
export default function MDXContentWithComponents(props) {
  return React.createElement(MDXProvider, { components: _MDXComponents },
    React.createElement(_OriginalDefault, props)
  );
}
`;
  }
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

  // load custom plugins from config (only in Trusted Mode)
  const customPlugins = await loadPluginsFromConfig(
    preview.mdxPreviewConfig,
    preview.fsPath
  );

  // log aggregated plugin loading errors
  if (customPlugins.errors.length > 0) {
    warn(
      `Failed to load ${customPlugins.errors.length} custom plugin(s). Check console for details.`
    );
  }

  // generate component imports from config (only in Trusted Mode)
  const documentDir = path.dirname(preview.fsPath);
  const componentImports = generateComponentImports(
    preview.mdxPreviewConfig,
    documentDir
  );

  // prepend component imports to MDX source (before compilation)
  if (componentImports.hasComponents) {
    mdxTextToCompile = componentImports.imports + '\n\n' + mdxTextToCompile;
  }

  // merge built-in and custom plugins
  const remarkPlugins: Pluggable[] = mergePlugins(
    sharedRemarkPlugins,
    customPlugins.remarkPlugins
  );

  const rehypePlugins: Pluggable[] = mergePlugins(
    [
      ...sharedRehypePluginsPreMath,
      rehypeKatex,
      // Trusted-only: convert raw HTML from KaTeX to JSX
      rehypeRaw,
      ...sharedRehypePluginsPostMath,
    ],
    customPlugins.rehypePlugins
  );

  const compiled = await compile(mdxTextToCompile, {
    outputFormat: 'program',
    development: false,
    jsx: false,
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    // remark plugins: GFM, GitHub alerts, math (shared w/ Safe Mode) + custom
    remarkPlugins,
    // rehype plugins: sourcepos, mermaid, math, raw HTML, syntax, anchors, lazy images + custom
    rehypePlugins,
  });

  return {
    code: wrapCompiledMdx(
      compiled.toString(),
      componentImports.hasComponents
        ? componentImports.componentsObject
        : undefined
    ),
    frontmatter: frontmatter as Record<string, unknown>,
  };
};
