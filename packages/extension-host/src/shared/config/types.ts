// packages/extension-host/src/shared/config/types.ts
// type definitions for configuration management
// note: SettingKey & SettingTypes are defined in ConfigManager.ts (canonical source)
// & imported directly from there - they are NOT re-exported here to avoid duplication

import type * as vscode from 'vscode';
import type {
  CodeBlockTheme,
  FrameworkId,
  PreviewTheme,
  SecurityPolicyValue,
  SourceLineHighlightColorValue,
  TailwindEnabledValue,
  UnknownBehaviorValue,
  UpdateModeValue,
} from '@mdx-preview/contracts';
import type {
  PluginSpec,
  ComponentMapping,
  UnknownBehavior,
} from 'mdx-forge/compiler';

// Re-export shared types for convenience
export type {
  SecurityPolicyValue,
  TailwindEnabledValue,
  UnknownBehaviorValue,
  UpdateModeValue,
} from '@mdx-preview/contracts';

// Tailwind configuration subset
export interface TailwindConfig {
  enabled: TailwindEnabledValue;
  maxFileSizeBytes: number;
  maxCssFilesToSearch: number;
  cacheMaxEntries: number;
  cacheTtlSeconds: number;
  compilationTimeout: number;
  // from config file
  configPath?: string;
}

// framework-specific options
export interface FrameworkOptions {
  // enable/disable component shims for this project
  enableShims?: boolean;
  // custom import aliases (e.g., { "@components": "./src/components" })
  customAliases?: Record<string, string>;
}

// Tailwind CSS options from config file
export interface TailwindOptions {
  enabled?: TailwindEnabledValue;
  configPath?: string;
}

// MDX Preview configuration file schema (.mdx-previewrc.json)
export interface MdxPreviewConfig {
  // custom remark plugins to add after built-in plugins
  remarkPlugins?: PluginSpec[];
  // custom rehype plugins to add after built-in plugins
  rehypePlugins?: PluginSpec[];
  // custom component mappings for MDX
  components?: ComponentMapping;
  // framework override (overrides auto-detection)
  framework?: FrameworkId;
  // framework-specific options
  frameworkOptions?: FrameworkOptions;
  // Tailwind CSS options
  tailwind?: TailwindOptions;
  // how to handle unknown JSX components in Safe Mode
  unknownBehavior?: UnknownBehavior;
  // force Safe Mode for this project (cannot enable in untrusted workspace)
  enableScripts?: boolean;
}

// resolved configuration w/ metadata
export interface ResolvedConfig {
  // parsed config
  config: MdxPreviewConfig;
  // config file path
  configPath: string;
  // config directory
  configDir: string;
}

export interface PreviewRuntimeConfig {
  showFrontmatter: boolean;
  showToc: boolean;
  sourceLineHighlight: boolean;
  sourceLineHighlightColor: SourceLineHighlightColorValue;
  shimSideRail: boolean;
}

// unified effective preview configuration
// combine VS Code settings, project config file, & frontmatter overrides
export interface EffectivePreviewConfig {
  // VS Code settings
  updateMode: UpdateModeValue;
  debounceDelay: number;
  enableScripts: boolean;
  openMdxLinksInPreview: boolean;
  securityPolicy: SecurityPolicyValue;
  useVscodeMarkdownStyles: boolean;
  useWhiteBackground: boolean;
  customCss: string;
  customLayoutFilePath: string;
  useSucraseTranspiler: boolean;

  // theme (frontmatter can override)
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  autoTheme: boolean;
  plantUmlServer: string;

  // Tailwind (consolidated)
  tailwind: TailwindConfig;

  // framework
  // FrameworkSetting
  framework: string;
  frameworkComponentShims: boolean;
  componentsBuiltins: boolean;
  componentsUnknownBehavior: UnknownBehaviorValue;

  // config file additions
  remarkPlugins?: MdxPreviewConfig['remarkPlugins'];
  rehypePlugins?: MdxPreviewConfig['rehypePlugins'];
  components?: MdxPreviewConfig['components'];
  frameworkOverride?: MdxPreviewConfig['framework'];
  frameworkOptions?: MdxPreviewConfig['frameworkOptions'];

  // metadata
  configFile: ResolvedConfig | null;
}

// compiler-specific config projection from EffectivePreviewConfig
export interface CompilerConfig extends Pick<
  EffectivePreviewConfig,
  | 'customLayoutFilePath'
  | 'useVscodeMarkdownStyles'
  | 'useWhiteBackground'
  | 'componentsBuiltins'
  | 'componentsUnknownBehavior'
  | 'configFile'
> {
  // URI for trust checks & plugin/component loading
  docUri: vscode.Uri;
  // fs path for relative import generation
  docFsPath: string;
}

// options for building effective config
export interface BuildEffectiveConfigOptions {
  docUri: vscode.Uri;
  docFsPath: string;
  frontmatter?: Record<string, unknown>;
}
