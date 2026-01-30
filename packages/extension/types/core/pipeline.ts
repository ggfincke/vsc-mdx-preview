// packages/extension/types/core/pipeline.ts
// type definitions for MDX pipeline configuration

import type { Pluggable } from 'unified';
import type { UnknownBehavior } from './compiler';

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

// warning codes for MDX pipeline operations
export enum PipelineWarningCode {
  // Safe Mode warnings
  CUSTOM_PLUGINS_IGNORED = 'MDX001',
  CUSTOM_COMPONENTS_IGNORED = 'MDX002',

  // plugin loading warnings
  PLUGIN_LOAD_FAILED = 'MDX003',
  PLUGIN_INVALID_EXPORT = 'MDX004',

  // component handling warnings
  BUILTIN_TRANSFORM_FAILED = 'MDX005',
  UNKNOWN_COMPONENT_DETECTED = 'MDX006',

  // configuration warnings
  INVALID_CONFIG_VALUE = 'MDX007',
  CONFIG_FILE_NOT_FOUND = 'MDX008',
}

// structured warning object
export interface PipelineWarning {
  code: PipelineWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

// result of loading plugins from config
export interface LoadedPlugins {
  // custom remark plugins to add after built-in plugins
  remarkPlugins: Pluggable[];
  // custom rehype plugins to add after built-in plugins
  rehypePlugins: Pluggable[];
  // count of plugins that failed to load (errors logged via ErrorReporter)
  errorCount: number;
}

// parsed plugin specification w/ separated name & options
export interface ParsedPluginSpec {
  // plugin name (npm package or relative path)
  name: string;
  // plugin options object, undefined if none specified
  options: Record<string, unknown> | undefined;
}
