// packages/extension/compiler/shared/pipeline-config.ts
// unified pipeline configuration for Safe & Trusted MDX modes

import type { Pluggable } from 'unified';
import type { UnknownBehavior, PluginPipeline } from '../../types/compiler';
import type { LoadedPlugins } from '../../types';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from '../../plugins/shared-plugins';
import rehypeRawPkg from 'rehype-raw';

// MDX node types to preserve when parsing raw HTML (Trusted Mode only)
// these nodes must not be converted to HTML by rehype-raw
export const MDX_PASSTHROUGH_NODES = [
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
] as const;

// rehype-raw configuration w/ MDX passthrough
export const REHYPE_RAW_CONFIG = {
  passThrough: [...MDX_PASSTHROUGH_NODES],
} as const;

// pipeline mode determines which plugins are included
export type PipelineMode = 'trusted' | 'safe';

// phase annotations for plugin ordering
// pre: runs before MDX-specific processing (e.g., directive parsing)
// mdx: MDX-specific transforms (Safe Mode only: generic components, strip)
// shared: shared plugins that run in both modes
// custom: user-defined plugins from config (Trusted Mode only)
export type RemarkPhase = 'pre' | 'mdx' | 'shared' | 'custom';

// phase annotations for rehype plugins
// raw: rehype-raw for HTML passthrough (Trusted Mode only)
// preMath: plugins that run before KaTeX
// math: KaTeX for math rendering
// postMath: plugins that run after KaTeX (shiki, slug, autolink, lazy)
// custom: user-defined plugins from config (Trusted Mode only)
export type RehypePhase = 'raw' | 'preMath' | 'math' | 'postMath' | 'custom';

// pipeline configuration input
export interface PipelineConfig {
  mode: PipelineMode;
  builtinsEnabled: boolean;
  unknownBehavior: UnknownBehavior;
  customPlugins?: LoadedPlugins;
}

// annotated plugin entry for documentation & filtering
export interface AnnotatedPlugin {
  plugin: Pluggable;
  phase: RemarkPhase | RehypePhase;
  trustedOnly?: boolean;
  safeOnly?: boolean;
  description?: string;
}

// full pipeline description w/ annotated plugins
export interface PipelineDescription {
  mode: PipelineMode;
  remarkPlugins: AnnotatedPlugin[];
  rehypePlugins: AnnotatedPlugin[];
}

// Safe Mode pipeline output - split for unified().use() pattern
export interface SafePipelineConfig {
  // shared remark plugins (GFM, alerts, math)
  sharedRemarkPlugins: Pluggable[];
  // rehype plugins before math
  rehypePreMath: Pluggable[];
  // KaTeX plugin
  rehypeMath: Pluggable;
  // rehype plugins after math
  rehypePostMath: Pluggable[];
}

// create annotated pipeline description for the given mode
// this is the canonical source of truth for plugin ordering
export function describePipeline(config: PipelineConfig): PipelineDescription {
  const { mode, customPlugins } = config;

  // build remark plugin list w/ annotations
  const remarkPlugins: AnnotatedPlugin[] = [
    // shared plugins run in both modes (order critical!)
    ...sharedRemarkPlugins.map((plugin, index) => ({
      plugin,
      phase: 'shared' as const,
      description: getRemarkPluginDescription(index),
    })),
  ];

  // add custom remark plugins in Trusted Mode
  if (mode === 'trusted' && customPlugins?.remarkPlugins?.length) {
    for (const plugin of customPlugins.remarkPlugins) {
      remarkPlugins.push({
        plugin: plugin as Pluggable,
        phase: 'custom' as const,
        trustedOnly: true,
        description: 'custom plugin from config',
      });
    }
  }

  // build rehype plugin list w/ annotations
  const rehypePlugins: AnnotatedPlugin[] = [];

  // Trusted Mode needs rehype-raw first to handle raw HTML
  if (mode === 'trusted') {
    rehypePlugins.push({
      plugin: [rehypeRawPkg, REHYPE_RAW_CONFIG] as Pluggable,
      phase: 'raw' as const,
      trustedOnly: true,
      description: 'parse raw HTML, preserve MDX nodes',
    });
  }

  // pre-math plugins (diagram placeholders)
  for (const plugin of sharedRehypePluginsPreMath) {
    rehypePlugins.push({
      plugin,
      phase: 'preMath' as const,
      description: 'diagram placeholder',
    });
  }

  // math plugin (KaTeX)
  rehypePlugins.push({
    plugin: rehypeKatex,
    phase: 'math' as const,
    description: 'KaTeX math rendering',
  });

  // post-math plugins (shiki, slug, autolink, lazy images)
  for (const plugin of sharedRehypePluginsPostMath) {
    rehypePlugins.push({
      plugin,
      phase: 'postMath' as const,
      description: 'syntax highlighting, headings, images',
    });
  }

  // add custom rehype plugins in Trusted Mode
  if (mode === 'trusted' && customPlugins?.rehypePlugins?.length) {
    for (const plugin of customPlugins.rehypePlugins) {
      rehypePlugins.push({
        plugin: plugin as Pluggable,
        phase: 'custom' as const,
        trustedOnly: true,
        description: 'custom plugin from config',
      });
    }
  }

  return {
    mode,
    remarkPlugins,
    rehypePlugins,
  };
}

// emit Trusted Mode plugin arrays suitable for @mdx-js/mdx compile()
export function emitTrustedPipeline(desc: PipelineDescription): PluginPipeline {
  if (desc.mode !== 'trusted') {
    throw new Error('emitTrustedPipeline requires mode: trusted');
  }

  return {
    remarkPlugins: desc.remarkPlugins
      .filter((p) => !p.safeOnly)
      .map((p) => p.plugin),
    rehypePlugins: desc.rehypePlugins
      .filter((p) => !p.safeOnly)
      .map((p) => p.plugin),
  };
}

// emit Safe Mode plugin sets suitable for unified().use() pattern
export function emitSafePipeline(
  desc: PipelineDescription
): SafePipelineConfig {
  if (desc.mode !== 'safe') {
    throw new Error('emitSafePipeline requires mode: safe');
  }

  // filter out trusted-only plugins & extract by phase
  const safeRehype = desc.rehypePlugins.filter((p) => !p.trustedOnly);

  return {
    sharedRemarkPlugins: desc.remarkPlugins
      .filter((p) => !p.trustedOnly && p.phase === 'shared')
      .map((p) => p.plugin),
    rehypePreMath: safeRehype
      .filter((p) => p.phase === 'preMath')
      .map((p) => p.plugin),
    rehypeMath: safeRehype.find((p) => p.phase === 'math')!.plugin,
    rehypePostMath: safeRehype
      .filter((p) => p.phase === 'postMath')
      .map((p) => p.plugin),
  };
}

// get description for shared remark plugin by index
function getRemarkPluginDescription(index: number): string {
  const descriptions = [
    'parse ::: directive syntax',
    'transform directives to admonitions',
    'handle [!NOTE] GitHub alerts',
    'GitHub Flavored Markdown',
    'math expression syntax',
  ];
  return descriptions[index] ?? 'shared plugin';
}

// validate pipeline configuration
export function validatePipelineConfig(config: PipelineConfig): string[] {
  const errors: string[] = [];

  if (!['trusted', 'safe'].includes(config.mode)) {
    errors.push(`Invalid mode: ${config.mode}. Must be 'trusted' or 'safe'`);
  }

  if (!['strip', 'placeholder', 'raw'].includes(config.unknownBehavior)) {
    errors.push(
      `Invalid unknownBehavior: ${config.unknownBehavior}. ` +
        "Must be 'strip', 'placeholder', or 'raw'"
    );
  }

  if (config.mode === 'safe' && config.customPlugins) {
    const customCount =
      (config.customPlugins.remarkPlugins?.length ?? 0) +
      (config.customPlugins.rehypePlugins?.length ?? 0);
    if (customCount > 0) {
      errors.push(
        `Custom plugins not allowed in Safe Mode. ${customCount} plugin(s) will be ignored.`
      );
    }
  }

  return errors;
}

// create a default pipeline config for the given mode
export function createDefaultConfig(mode: PipelineMode): PipelineConfig {
  return {
    mode,
    builtinsEnabled: true,
    unknownBehavior: mode === 'safe' ? 'placeholder' : 'raw',
  };
}
