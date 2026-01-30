// packages/extension/types/core/config.ts
// type definitions for configuration management

import type * as vscode from 'vscode';
import type {
  FrameworkId,
  FrameworkSetting,
  PreviewTheme,
  CodeBlockTheme,
} from '@mdx-preview/shared';
import { SecurityPolicy } from '../vscode/csp';
import type { PluginSpec, ComponentMapping, UnknownBehavior } from './compiler';

// re-export SecurityPolicy for convenience
export { SecurityPolicy };

// VS Code setting keys (relative to 'mdx-preview' namespace)
export type SettingKey =
  | 'preview.updateMode'
  | 'preview.debounceDelay'
  | 'preview.enableScripts'
  | 'preview.openMdxLinksInPreview'
  | 'preview.security'
  | 'preview.useVscodeMarkdownStyles'
  | 'preview.useWhiteBackground'
  | 'preview.customCss'
  | 'preview.mdx.customLayoutFilePath'
  | 'preview.previewTheme'
  | 'preview.codeBlockTheme'
  | 'preview.mermaidTheme'
  | 'preview.autoTheme'
  | 'build.useSucraseTranspiler'
  | 'tailwind.enabled'
  | 'tailwind.maxFileSizeBytes'
  | 'tailwind.maxCssFilesToSearch'
  | 'tailwind.cacheMaxEntries'
  | 'tailwind.cacheTtlSeconds'
  | 'tailwind.compilationTimeout'
  | 'framework'
  | 'framework.componentShims'
  | 'components.builtins'
  | 'components.unknownBehavior'
  | 'advanced.watcherDebounceMs';

// type mapping for settings
export interface SettingTypes {
  'preview.updateMode': 'onType' | 'onSave' | 'manual';
  'preview.debounceDelay': number;
  'preview.enableScripts': boolean;
  'preview.openMdxLinksInPreview': boolean;
  'preview.security': SecurityPolicy;
  'preview.useVscodeMarkdownStyles': boolean;
  'preview.useWhiteBackground': boolean;
  'preview.customCss': string;
  'preview.mdx.customLayoutFilePath': string;
  'preview.previewTheme': string;
  'preview.codeBlockTheme': string;
  'preview.mermaidTheme': string;
  'preview.autoTheme': boolean;
  'build.useSucraseTranspiler': boolean;
  'tailwind.enabled': 'auto' | 'enabled' | 'disabled';
  'tailwind.maxFileSizeBytes': number;
  'tailwind.maxCssFilesToSearch': number;
  'tailwind.cacheMaxEntries': number;
  'tailwind.cacheTtlSeconds': number;
  'tailwind.compilationTimeout': number;
  framework: FrameworkSetting;
  'framework.componentShims': boolean;
  'components.builtins': boolean;
  'components.unknownBehavior': 'strip' | 'placeholder' | 'raw';
  'advanced.watcherDebounceMs': number;
}

// controls when the preview updates: on typing, on save, or manually
export type UpdateMode = SettingTypes['preview.updateMode'];

// controls Tailwind CSS processing: auto-detect, always enabled, or disabled
export type TailwindEnabledSetting = SettingTypes['tailwind.enabled'];

// controls how unknown components are rendered
export type UnknownBehaviorSetting = SettingTypes['components.unknownBehavior'];

// Tailwind configuration subset
export interface TailwindConfig {
  enabled: SettingTypes['tailwind.enabled'];
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

// Tailwind CSS options
export interface TailwindOptions {
  enabled?: 'auto' | 'enabled' | 'disabled';
  configPath?: string;
}

// MDX Preview configuration file schema
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
  // the parsed configuration
  config: MdxPreviewConfig;
  // absolute path to the config file
  configPath: string;
  // directory containing the config file (for resolving relative paths)
  configDir: string;
}

// unified effective preview configuration
// combines VS Code settings, project config file, & frontmatter overrides
export interface EffectivePreviewConfig {
  // VS Code settings
  updateMode: SettingTypes['preview.updateMode'];
  debounceDelay: number;
  enableScripts: boolean;
  openMdxLinksInPreview: boolean;
  securityPolicy: SettingTypes['preview.security'];
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
  framework: SettingTypes['framework'];
  frameworkComponentShims: boolean;
  componentsBuiltins: boolean;
  componentsUnknownBehavior: SettingTypes['components.unknownBehavior'];

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
