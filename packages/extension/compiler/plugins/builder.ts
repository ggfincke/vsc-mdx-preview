// packages/extension/compiler/plugins/builder.ts
// shared MDX plugin pipeline construction
//
// extracts plugin pipeline building from trusted/safe compilers
// for better testability & single source of truth

import type { Pluggable } from 'unified';
import rehypeRawPkg from 'rehype-raw';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';
import type { LoadedPlugins } from './loader';
import type { PluginPipeline } from '../../types';

// rehype-raw configuration w/ MDX-specific passThrough nodes
// these nodes must not be parsed as raw HTML to preserve MDX semantics
export const REHYPE_RAW_CONFIG = {
  passThrough: [
    'mdxJsxFlowElement',
    'mdxJsxTextElement',
    'mdxFlowExpression',
    'mdxTextExpression',
    // ESM import/export statements
    'mdxjsEsm',
  ],
} as const;

// build the remark plugin array for Trusted Mode
// merges shared plugins w/ custom plugins from config
export function buildTrustedRemarkPlugins(
  customPlugins: LoadedPlugins
): Pluggable[] {
  if (customPlugins.remarkPlugins.length === 0) {
    return sharedRemarkPlugins;
  }
  return [...sharedRemarkPlugins, ...customPlugins.remarkPlugins];
}

// build the rehype plugin array for Trusted Mode
// includes rehype-raw w/ MDX passThrough, math plugins, & custom plugins
// plugin order
// 1. rehype-raw (parse raw HTML, preserve MDX nodes)
// 2. pre-math plugins (mermaid placeholder)
// 3. rehype-katex (math rendering)
// 4. post-math plugins (shiki, slug, autolink, lazy images)
// 5. custom plugins from config
export function buildTrustedRehypePlugins(
  customPlugins: LoadedPlugins
): Pluggable[] {
  const basePlugins: Pluggable[] = [
    [rehypeRawPkg, REHYPE_RAW_CONFIG],
    ...sharedRehypePluginsPreMath,
    rehypeKatex,
    ...sharedRehypePluginsPostMath,
  ];

  if (customPlugins.rehypePlugins.length === 0) {
    return basePlugins;
  }
  return [...basePlugins, ...customPlugins.rehypePlugins];
}

// build the complete plugin pipeline for Trusted Mode
// return arrays suitable for @mdx-js/mdx compile() options
export function buildTrustedPluginPipeline(
  customPlugins: LoadedPlugins
): PluginPipeline {
  return {
    remarkPlugins: buildTrustedRemarkPlugins(customPlugins),
    rehypePlugins: buildTrustedRehypePlugins(customPlugins),
  };
}

// get shared remark plugins for Safe Mode (does not support custom plugins)
export function getSafeRemarkPlugins(): Pluggable[] {
  return sharedRemarkPlugins;
}

// get shared rehype plugins for Safe Mode
// return separate arrays for use w/ unified processor
// Safe Mode uses unified() w/ .use() calls instead of compile() options
// so plugins need to be applied separately rather than as a single array
export function getSafeRehypePluginSets(): {
  preMath: Pluggable[];
  math: Pluggable;
  postMath: Pluggable[];
} {
  return {
    preMath: sharedRehypePluginsPreMath,
    math: rehypeKatex,
    postMath: sharedRehypePluginsPostMath,
  };
}
