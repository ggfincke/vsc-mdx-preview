// packages/extension/compiler/types.ts
// consolidated type definitions for the compiler subsystem

import type { Pluggable } from 'unified';

// how to handle unknown JSX components in Safe Mode (strip, placeholder, or raw)
export type UnknownBehavior = 'strip' | 'placeholder' | 'raw';

// plugin specification format (string name or tuple w/ options)
export type PluginSpec = string | [string, Record<string, unknown>];

// plugin pipeline configuration (remark + rehype plugins)
export interface PluginPipeline {
  remarkPlugins: Pluggable[];
  rehypePlugins: Pluggable[];
}

// component mapping from MDX component name to relative file path
export type ComponentMapping = Record<string, string>;

// result of extracting frontmatter from MDX text
export interface FrontmatterResult {
  // MDX content w/ frontmatter removed
  content: string;
  // parsed frontmatter data
  frontmatter: Record<string, unknown>;
}

// result of MDX transpilation (Trusted Mode)
export interface MdxTranspileResult {
  code: string;
  frontmatter: Record<string, unknown>;
}

// result of Safe Mode HTML compilation
export interface SafeHTMLResult {
  html: string;
  frontmatter: Record<string, unknown>;
}
