// packages/extension/transpiler/types.ts
// consolidated type definitions for the transpiler subsystem

// how to handle unknown JSX components in Safe Mode (strip, placeholder, or raw)
export type UnknownBehavior = 'strip' | 'placeholder' | 'raw';

// plugin specification format (string name or tuple w/ options)
export type PluginSpec = string | [string, Record<string, unknown>];

// result of loading custom plugins from config
export interface LoadedPlugins {
  remarkPlugins: unknown[];
  rehypePlugins: unknown[];
  errors: Array<{ plugin: string; error: Error }>;
}

// plugin pipeline configuration (remark + rehype plugins)
export interface PluginPipeline {
  remarkPlugins: unknown[];
  rehypePlugins: unknown[];
}

// component mapping from MDX component name to relative file path
export type ComponentMapping = Record<string, string>;

// result of generating component imports
export interface ComponentImportsResult {
  imports: string;
  componentsObject: string;
  hasComponents: boolean;
}

// options for component import generation
export interface ComponentImportsOptions {
  builtinsEnabled?: boolean;
}

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

// available transpiler options
export type TranspilerType = 'babel' | 'sucrase';

// options for transpilation
export interface TranspileOptions {
  transpiler?: TranspilerType;
  isEntry?: boolean;
}
