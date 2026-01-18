// packages/extension/config/EffectivePreviewConfig.ts
// Unified config object merging VS Code settings + config file + frontmatter
// Precedence: frontmatter > config file > VS Code settings

import * as vscode from 'vscode';
import type { SettingTypes } from './ConfigManager';
import { getConfigManager, getThemeManager } from '../services';
import {
  resolveConfig,
  type ResolvedConfig,
  type MdxPreviewConfig,
} from '../preview/config/ConfigResolver';
import type { PreviewTheme, CodeBlockTheme } from '../themes/types';

// Tailwind configuration subset
export interface TailwindConfig {
  enabled: SettingTypes['tailwind.enabled'];
  maxFileSizeBytes: number;
  maxCssFilesToSearch: number;
  cacheMaxEntries: number;
  cacheTtlSeconds: number;
  compilationTimeout: number;
  configPath?: string; // From config file
}

// Unified effective preview configuration
// Combines VS Code settings, project config file, and frontmatter overrides
export interface EffectivePreviewConfig {
  // ─── VS Code Settings ───────────────────────────────────────────────
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

  // ─── Theme (frontmatter can override) ───────────────────────────────
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  autoTheme: boolean;

  // ─── Tailwind (consolidated) ────────────────────────────────────────
  tailwind: TailwindConfig;

  // ─── Framework ──────────────────────────────────────────────────────
  framework: SettingTypes['framework'];
  frameworkComponentShims: boolean;
  componentsBuiltins: boolean;
  componentsUnknownBehavior: SettingTypes['components.unknownBehavior'];

  // ─── Config File Additions ──────────────────────────────────────────
  remarkPlugins?: MdxPreviewConfig['remarkPlugins'];
  rehypePlugins?: MdxPreviewConfig['rehypePlugins'];
  components?: MdxPreviewConfig['components'];
  frameworkOverride?: MdxPreviewConfig['framework'];
  frameworkOptions?: MdxPreviewConfig['frameworkOptions'];

  // ─── Metadata ───────────────────────────────────────────────────────
  configFile: ResolvedConfig | null;
}

// Options for building effective config
export interface BuildEffectiveConfigOptions {
  docUri: vscode.Uri;
  docFsPath: string;
  frontmatter?: Record<string, unknown>;
}

/**
 * Build unified effective preview configuration.
 *
 * Merges configuration from multiple sources with clear precedence:
 * 1. Frontmatter (highest priority) - per-document overrides
 * 2. Config file (.mdx-previewrc.json) - per-project settings
 * 3. VS Code settings (lowest priority) - user/workspace defaults
 *
 * @param options - Document URI, file path, and optional frontmatter
 * @returns Unified configuration object
 */
export function buildEffectivePreviewConfig(
  options: BuildEffectiveConfigOptions
): EffectivePreviewConfig {
  const { docUri, docFsPath, frontmatter } = options;
  const configManager = getConfigManager();
  const themeManager = getThemeManager();

  // 1. Load VS Code settings (scoped to document)
  const settings = configManager.getAll(docUri);

  // 2. Load config file (if present)
  const configFile = resolveConfig(docFsPath);
  const fileConfig = configFile?.config;

  // 3. Extract frontmatter theme overrides
  const frontmatterTheme = frontmatter
    ? themeManager.extractThemeFromFrontmatter(frontmatter)
    : {};

  // 4. Merge with precedence: frontmatter > config file > VS Code settings
  return {
    // VS Code settings (no override from config file or frontmatter)
    updateMode: settings['preview.updateMode'],
    debounceDelay: settings['preview.debounceDelay'],
    enableScripts: settings['preview.enableScripts'],
    openMdxLinksInPreview: settings['preview.openMdxLinksInPreview'],
    securityPolicy: settings['preview.security'],
    useVscodeMarkdownStyles: settings['preview.useVscodeMarkdownStyles'],
    useWhiteBackground: settings['preview.useWhiteBackground'],
    customCss: settings['preview.customCss'],
    customLayoutFilePath: settings['preview.mdx.customLayoutFilePath'],
    useSucraseTranspiler: settings['build.useSucraseTranspiler'],

    // Themes with frontmatter override (frontmatter > VS Code settings)
    previewTheme: (frontmatterTheme.previewTheme ??
      settings['preview.previewTheme']) as PreviewTheme,
    codeBlockTheme: (frontmatterTheme.codeBlockTheme ??
      settings['preview.codeBlockTheme']) as CodeBlockTheme,
    autoTheme: settings['preview.autoTheme'],

    // Tailwind (config file can override enabled and provide configPath)
    tailwind: {
      enabled: fileConfig?.tailwind?.enabled ?? settings['tailwind.enabled'],
      maxFileSizeBytes: settings['tailwind.maxFileSizeBytes'],
      maxCssFilesToSearch: settings['tailwind.maxCssFilesToSearch'],
      cacheMaxEntries: settings['tailwind.cacheMaxEntries'],
      cacheTtlSeconds: settings['tailwind.cacheTtlSeconds'],
      compilationTimeout: settings['tailwind.compilationTimeout'],
      configPath: fileConfig?.tailwind?.configPath,
    },

    // Framework (config file can override detection)
    framework: fileConfig?.framework ?? settings['framework'],
    frameworkComponentShims: settings['framework.componentShims'],
    componentsBuiltins: settings['components.builtins'],
    componentsUnknownBehavior:
      fileConfig?.unknownBehavior ?? settings['components.unknownBehavior'],

    // Config file additions (plugins, components, etc.)
    remarkPlugins: fileConfig?.remarkPlugins,
    rehypePlugins: fileConfig?.rehypePlugins,
    components: fileConfig?.components,
    frameworkOverride: fileConfig?.framework,
    frameworkOptions: fileConfig?.frameworkOptions,

    // Metadata for debugging and cache invalidation
    configFile,
  };
}
