// packages/extension/config/EffectivePreviewConfig.ts
// unified config object merging VS Code settings + config file + frontmatter
// precedence: frontmatter > config file > VS Code settings
//
// config architecture
// 1. ConfigManager: low-level VS Code settings access (no caching, VS Code caches internally)
// 2. PreviewConfiguration: per-preview state snapshot for change detection
// 3. EffectivePreviewConfig: stateless builder merging settings + config file + frontmatter
// 4. ConfigCache: file-based .mdx-previewrc.json caching w/ file watchers

import { getConfigManager, getThemeManager } from '../../app/services';
import { resolveConfig } from '../../features/preview/configuration/ConfigResolver';
import { mapSettingsToPreviewConfiguration } from './preview-settings';
import type { PreviewTheme, CodeBlockTheme } from '../../features/themes/types';

// import consolidated types from centralized types
import type {
  EffectivePreviewConfig,
  BuildEffectiveConfigOptions,
  CompilerConfig,
} from '../types';
import type { CompilerConfig as MdxToolsCompilerConfig } from 'mdx-tools/compiler';

// build unified effective preview configuration
export function buildEffectivePreviewConfig(
  options: BuildEffectiveConfigOptions
): EffectivePreviewConfig {
  const { docUri, docFsPath, frontmatter } = options;
  const configManager = getConfigManager();
  const themeManager = getThemeManager();

  // load VS Code settings (scoped to document)
  const settings = configManager.getAll(docUri);
  const previewConfig = mapSettingsToPreviewConfiguration(settings);

  // load config file (if present)
  const configFile = resolveConfig(docFsPath);
  const fileConfig = configFile?.config;

  // extract frontmatter theme overrides
  const frontmatterTheme = frontmatter
    ? themeManager.extractThemeFromFrontmatter(frontmatter)
    : {};

  // merge w/ precedence: frontmatter > config file > VS Code settings
  return {
    // VS Code settings (config file can only disable, not enable)
    updateMode: previewConfig.updateMode,
    debounceDelay: previewConfig.debounceDelay,
    // config file can force Safe Mode (false), but cannot force Trusted Mode
    enableScripts:
      fileConfig?.enableScripts === false
        ? false
        : settings['preview.enableScripts'],
    openMdxLinksInPreview: settings['preview.openMdxLinksInPreview'],
    securityPolicy: previewConfig.securityPolicy,
    useVscodeMarkdownStyles: previewConfig.useVscodeMarkdownStyles,
    useWhiteBackground: previewConfig.useWhiteBackground,
    customCss: previewConfig.customCss,
    customLayoutFilePath: previewConfig.customLayoutFilePath,
    useSucraseTranspiler: previewConfig.useSucraseTranspiler,

    // themes w/ frontmatter override (frontmatter > VS Code settings)
    previewTheme: (frontmatterTheme.previewTheme ??
      settings['preview.previewTheme']) as PreviewTheme,
    codeBlockTheme: (frontmatterTheme.codeBlockTheme ??
      settings['preview.codeBlockTheme']) as CodeBlockTheme,
    autoTheme: settings['preview.autoTheme'],
    plantUmlServer: previewConfig.plantUmlServer,

    // Tailwind (config file can override enabled & provide configPath)
    tailwind: {
      enabled: fileConfig?.tailwind?.enabled ?? previewConfig.tailwindEnabled,
      maxFileSizeBytes: settings['tailwind.maxFileSizeBytes'],
      maxCssFilesToSearch: settings['tailwind.maxCssFilesToSearch'],
      cacheMaxEntries: settings['tailwind.cacheMaxEntries'],
      cacheTtlSeconds: settings['tailwind.cacheTtlSeconds'],
      compilationTimeout: settings['tailwind.compilationTimeout'],
      configPath: fileConfig?.tailwind?.configPath,
    },

    // framework (config file can override detection)
    framework: fileConfig?.framework ?? settings['framework'],
    frameworkComponentShims: settings['framework.componentShims'],
    componentsBuiltins: settings['components.builtins'],
    componentsUnknownBehavior:
      fileConfig?.unknownBehavior ?? settings['components.unknownBehavior'],

    // config file additions (plugins, components, etc)
    remarkPlugins: fileConfig?.remarkPlugins,
    rehypePlugins: fileConfig?.rehypePlugins,
    components: fileConfig?.components,
    frameworkOverride: fileConfig?.framework,
    frameworkOptions: fileConfig?.frameworkOptions,

    // metadata for debugging & cache invalidation
    configFile,
  };
}

// project effective config to compiler-specific fields
export function toCompilerConfig(
  effectiveConfig: EffectivePreviewConfig,
  options: Pick<BuildEffectiveConfigOptions, 'docUri' | 'docFsPath'>
): CompilerConfig {
  return {
    docUri: options.docUri,
    docFsPath: options.docFsPath,
    customLayoutFilePath: effectiveConfig.customLayoutFilePath,
    useVscodeMarkdownStyles: effectiveConfig.useVscodeMarkdownStyles,
    useWhiteBackground: effectiveConfig.useWhiteBackground,
    componentsBuiltins: effectiveConfig.componentsBuiltins,
    componentsUnknownBehavior: effectiveConfig.componentsUnknownBehavior,
    configFile: effectiveConfig.configFile,
  };
}

// build compiler config from merged settings + file config
export function buildCompilerConfig(
  options: BuildEffectiveConfigOptions
): CompilerConfig {
  const effectiveConfig = buildEffectivePreviewConfig(options);
  return toCompilerConfig(effectiveConfig, options);
}

// project extension compiler config to mdx-tools/compiler contract
export function toMdxToolsCompilerConfig(
  config: CompilerConfig
): MdxToolsCompilerConfig {
  const docUri = config.docUri.toString();
  return {
    documentPath: config.docFsPath,
    documentUri: docUri,
    // keep legacy aliases populated for compatibility paths during migration
    docFsPath: config.docFsPath,
    docUri,
    customLayoutFilePath: config.customLayoutFilePath,
    useVscodeMarkdownStyles: config.useVscodeMarkdownStyles,
    useWhiteBackground: config.useWhiteBackground,
    componentsBuiltins: config.componentsBuiltins,
    componentsUnknownBehavior: config.componentsUnknownBehavior,
    configFile: config.configFile,
  };
}
