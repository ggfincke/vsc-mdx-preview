// packages/extension/compiler/plugins/builder.ts
// shared MDX plugin pipeline construction for trusted & safe compilers

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

// rehype-raw configuration w/ MDX-specific passThrough nodes to preserve MDX semantics
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

// build the remark plugin array for Trusted Mode (merge shared & custom plugins)
export function buildTrustedRemarkPlugins(
  customPlugins: LoadedPlugins
): Pluggable[] {
  if (customPlugins.remarkPlugins.length === 0) {
    return sharedRemarkPlugins;
  }
  return [...sharedRemarkPlugins, ...customPlugins.remarkPlugins];
}

// build the rehype plugin array for Trusted Mode (rehype-raw, math, shiki, custom)
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

// get shared rehype plugins for Safe Mode (separate arrays for unified().use() pattern)
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
