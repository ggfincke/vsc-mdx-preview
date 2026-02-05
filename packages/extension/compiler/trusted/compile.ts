// packages/extension/compiler/trusted/compile.ts
// MDX transpilation w/ layout injection & React root wrapping for Trusted Mode

import { compile } from '@mdx-js/mdx';
import hasDefaultExport from './hasDefaultExport';
import * as path from 'path';

import { Preview } from '../../preview/preview-manager';
import { extractFrontmatter } from '../shared/mdx-common';
import { buildTrustedPluginPipeline } from '../plugins/builder';
import { loadPluginsFromConfig } from '../plugins/loader';
import { generateComponentImports } from './component-mapper';
import { createTaggedLogger } from '../../logging';
import { getConfigManager } from '../../services';
import { LogTags } from '@mdx-preview/shared';

const log = createTaggedLogger(LogTags.COMPILE);

import type { MdxTranspileResult } from '../../types';

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
    } catch (err) {
      log.warn(
        `Failed to load custom layout from ${customLayoutFilePath}: ${err}`
      );
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

// wrap compiled MDX output (webview owns React root & handles rendering, wrap w/ MDXProvider if components provided)
const wrapCompiledMdx = (
  compiledMDX: string,
  componentsObject?: string
): string => {
  if (componentsObject && componentsObject !== '{}') {
    // remove original "export default" to avoid duplicate exports (MDX 3 output)
    const strippedMDX = compiledMDX
      .replace(/export default function MDXContent/g, 'function MDXContent')
      .replace(/export default MDXContent/g, '');

    // wrap w/ MDXProvider to make custom components available as shortcodes
    return `
// MDX 3 compiled output w/ custom components
import React from 'react';
import { MDXProvider } from '@mdx-js/react';
${strippedMDX}

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

// transpile MDX to JavaScript & inject layout if no default export
export async function compileTrusted(
  mdxText: string,
  _isEntry: boolean,
  preview: Preview
): Promise<MdxTranspileResult> {
  // extract frontmatter before compilation
  const { content, frontmatter } = extractFrontmatter(mdxText);

  let mdxTextToCompile: string;
  if (!hasDefaultExport(content)) {
    mdxTextToCompile = injectMDXStyles(content, preview);
  } else {
    mdxTextToCompile = content;
  }

  // load custom plugins from config
  const customPlugins = await loadPluginsFromConfig(
    preview.mdxPreviewConfig,
    preview.doc.uri
  );

  // log aggregated plugin loading errors (individual errors logged via ErrorReporter)
  if (customPlugins.errorCount > 0) {
    log.warn(
      `Failed to load ${customPlugins.errorCount} custom plugin(s). Check console for details.`
    );
  }

  // generate component imports from config & built-in shims
  const documentDir = path.dirname(preview.fsPath);
  const builtinsEnabled = getConfigManager().get('components.builtins');

  log.debug(
    `mdxPreviewConfig: ${preview.mdxPreviewConfig ? JSON.stringify(preview.mdxPreviewConfig.config) : 'undefined'}`
  );
  log.debug(`documentDir: ${documentDir}`);
  log.debug(`builtinsEnabled: ${builtinsEnabled}`);

  const componentImports = generateComponentImports(
    preview.mdxPreviewConfig,
    documentDir,
    preview.doc.uri,
    { builtinsEnabled }
  );

  log.debug(
    `componentImports.hasComponents: ${componentImports.hasComponents}`
  );

  // prepend component imports to MDX source (before compilation)
  if (componentImports.hasComponents) {
    log.debug('Prepending component imports to MDX source');
    mdxTextToCompile = componentImports.imports + '\n\n' + mdxTextToCompile;
  }

  // build plugin pipeline (merges built-in & custom plugins)
  const { remarkPlugins, rehypePlugins } =
    buildTrustedPluginPipeline(customPlugins);

  const compiled = await compile(mdxTextToCompile, {
    outputFormat: 'program',
    development: false,
    jsx: false,
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    // enable MDXProvider context reading (MDX will call useMDXComponents() to get components)
    providerImportSource: '@mdx-js/react',
    // remark plugins: GFM, GitHub alerts, math (shared w/ Safe Mode) & custom
    remarkPlugins,
    // rehype plugins: raw HTML (via rehype-raw), mermaid, math, syntax, anchors, lazy images & custom
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
}
