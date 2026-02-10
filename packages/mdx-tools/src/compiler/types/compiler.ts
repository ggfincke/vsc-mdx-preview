import type { Pluggable } from 'unified';

// how to handle unknown JSX components in Safe Mode
export type UnknownBehavior = 'strip' | 'placeholder' | 'raw';

// plugin specification format
export type PluginSpec = string | [string, Record<string, unknown>];

// plugin pipeline configuration
export interface PluginPipeline {
  remarkPlugins: Pluggable[];
  rehypePlugins: Pluggable[];
}

// component mapping from MDX component name to import path
export type ComponentMapping = Record<string, string>;

// config file schema subset used by the compiler
export interface MdxPreviewConfig {
  remarkPlugins?: PluginSpec[];
  rehypePlugins?: PluginSpec[];
  components?: ComponentMapping;
}

// resolved config metadata
export interface ResolvedConfig {
  config: MdxPreviewConfig;
  configPath: string;
  configDir: string;
}

// lightweight logger contract injected by consumers
export interface CompilerLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// trust validation contract injected by consumers
export interface TrustValidator {
  isTrusted(params: {
    documentPath: string;
    documentUri?: string;
    operation: string;
  }): { canExecute: boolean; reason?: string };
}

// module resolution/loading contract for custom plugins
export interface PluginLoader {
  resolve(specifier: string, fromDir: string): string;
  load(resolvedPath: string): Promise<unknown> | unknown;
}

// plugin loading error payload for consumers
export interface PluginLoadError {
  message: string;
  code: 'PLUGIN_LOAD_ERROR' | 'PLUGIN_INVALID_EXPORT';
  pluginName: string;
  cause?: Error;
}

// error reporting contract injected by consumers
export interface ErrorReporter {
  reportPluginError(error: PluginLoadError): void;
}

// compiler configuration
export interface CompilerConfig {
  // canonical document path used for relative import generation
  documentPath: string;
  // optional explicit document directory (defaults to dirname(documentPath))
  documentDir?: string;
  // optional document URI for host-specific trust policies
  documentUri?: string;

  // backwards-compatible aliases (used by existing extension code during migration)
  docFsPath?: string;
  docUri?: string;

  customLayoutFilePath?: string;
  useVscodeMarkdownStyles?: boolean;
  useWhiteBackground?: boolean;
  componentsBuiltins?: boolean;
  componentsUnknownBehavior?: UnknownBehavior;
  configFile?: ResolvedConfig | null;

  // injected host services
  logger?: CompilerLogger;
  trustValidator?: TrustValidator;
  pluginLoader?: PluginLoader;
  errorReporter?: ErrorReporter;

  // optional resolver for safe-mode component labels
  componentNameResolver?: (name: string) => string | undefined;
}

// result of extracting frontmatter from MDX text
export interface FrontmatterResult {
  content: string;
  frontmatter: Record<string, unknown>;
}

// result of Trusted Mode transpilation
export interface MdxTranspileResult {
  code: string;
  frontmatter: Record<string, unknown>;
}

// result of Safe Mode HTML compilation
export interface SafeHTMLResult {
  html: string;
  frontmatter: Record<string, unknown>;
}

// Nextra page metadata extracted from frontmatter
export interface NextraPageMeta {
  title?: string;
  layout?: 'default' | 'full' | 'raw';
  description?: string;
  toc?: boolean;
}
