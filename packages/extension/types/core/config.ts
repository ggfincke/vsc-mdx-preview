// packages/extension/types/core/config.ts
// type definitions for configuration management
// note: SettingKey & SettingTypes are defined in ConfigManager.ts (canonical source)
// & imported directly from there - they are NOT re-exported here to avoid duplication

import type * as vscode from 'vscode';
import type {
  FrameworkId,
  PreviewTheme,
  CodeBlockTheme,
  TailwindEnabledValue,
  UnknownBehaviorValue,
  UpdateModeValue,
  SecurityPolicyValue,
} from '@mdx-preview/shared';
import type { PluginSpec, ComponentMapping, UnknownBehavior } from './compiler';

// Re-export shared types for convenience
export type {
  TailwindEnabledValue,
  UnknownBehaviorValue,
  UpdateModeValue,
  SecurityPolicyValue,
} from '@mdx-preview/shared';

// controls when the preview updates: on typing, on save, or manually
export type UpdateMode = UpdateModeValue;

// controls Tailwind CSS processing: auto-detect, always enabled, or disabled
export type TailwindEnabledSetting = TailwindEnabledValue;

// controls how unknown components are rendered
export type UnknownBehaviorSetting = UnknownBehaviorValue;

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

// unified effective preview configuration
// combines VS Code settings, project config file, & frontmatter overrides
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

// options for building effective config
export interface BuildEffectiveConfigOptions {
  docUri: vscode.Uri;
  docFsPath: string;
  frontmatter?: Record<string, unknown>;
}
