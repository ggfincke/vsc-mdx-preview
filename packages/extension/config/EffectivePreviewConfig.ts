// packages/extension/config/EffectivePreviewConfig.ts
// unified config object merging VS Code settings + config file + frontmatter
// precedence: frontmatter > config file > VS Code settings
//
// Config Architecture
// 1. ConfigManager: low-level VS Code settings access (no caching, VS Code caches internally)
// 2. PreviewConfiguration: per-preview state snapshot for change detection
// 3. EffectivePreviewConfig: stateless builder merging settings + config file + frontmatter
// 4. ConfigCache: file-based .mdx-previewrc.json caching w/ file watchers

import { getConfigManager, getThemeManager } from '../services';
import { resolveConfig } from '../preview/config/ConfigResolver';
import type { PreviewTheme, CodeBlockTheme } from '../themes/types';

// import consolidated types from centralized types
import type {
  EffectivePreviewConfig,
  BuildEffectiveConfigOptions,
  CompilerConfig,
} from '../types';

// build unified effective preview configuration
export function buildEffectivePreviewConfig(
  options: BuildEffectiveConfigOptions
): EffectivePreviewConfig {
  const { docUri, docFsPath, frontmatter } = options;
  const configManager = getConfigManager();
  const themeManager = getThemeManager();

  // load VS Code settings (scoped to document)
  const settings = configManager.getAll(docUri);

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
    updateMode: settings['preview.updateMode'],
    debounceDelay: settings['preview.debounceDelay'],
    // config file can force Safe Mode (false), but cannot force Trusted Mode
    enableScripts:
      fileConfig?.enableScripts === false
        ? false
        : settings['preview.enableScripts'],
    openMdxLinksInPreview: settings['preview.openMdxLinksInPreview'],
    securityPolicy: settings['preview.security'],
    useVscodeMarkdownStyles: settings['preview.useVscodeMarkdownStyles'],
    useWhiteBackground: settings['preview.useWhiteBackground'],
    customCss: settings['preview.customCss'],
    customLayoutFilePath: settings['preview.mdx.customLayoutFilePath'],
    useSucraseTranspiler: settings['build.useSucraseTranspiler'],

    // themes w/ frontmatter override (frontmatter > VS Code settings)
    previewTheme: (frontmatterTheme.previewTheme ??
      settings['preview.previewTheme']) as PreviewTheme,
    codeBlockTheme: (frontmatterTheme.codeBlockTheme ??
      settings['preview.codeBlockTheme']) as CodeBlockTheme,
    autoTheme: settings['preview.autoTheme'],

    // Tailwind (config file can override enabled & provide configPath)
    tailwind: {
      enabled: fileConfig?.tailwind?.enabled ?? settings['tailwind.enabled'],
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
