// packages/contracts/src/config/defaults.ts
// centralized default values for VS Code settings

import {
  STANDARD_DEBOUNCE_MS,
  STANDARD_WATCHER_DEBOUNCE_MS,
} from '../runtime/constants';
import { DEFAULT_PLANTUML_SERVER } from '../diagrams/constants';

// preview defaults
export const DEFAULT_PREVIEW_UPDATE_MODE = 'onType' as const;
export const DEFAULT_PREVIEW_DEBOUNCE_DELAY_MS = STANDARD_DEBOUNCE_MS;
export const DEFAULT_PREVIEW_ENABLE_SCRIPTS = false;
export const DEFAULT_PREVIEW_OPEN_MDX_LINKS_IN_PREVIEW = true;
export const DEFAULT_PREVIEW_SECURITY_POLICY = 'strict' as const;
export const DEFAULT_PREVIEW_USE_VSCODE_MARKDOWN_STYLES = true;
export const DEFAULT_PREVIEW_USE_WHITE_BACKGROUND = false;
export const DEFAULT_PREVIEW_CUSTOM_CSS = '';
export const DEFAULT_PREVIEW_CUSTOM_LAYOUT_PATH = '';
export const DEFAULT_PREVIEW_THEME = 'none' as const;
export const DEFAULT_CODE_BLOCK_THEME = 'auto' as const;
export const DEFAULT_MERMAID_THEME = 'default' as const;
export const DEFAULT_AUTO_THEME = true;
export const DEFAULT_SOURCE_LINE_HIGHLIGHT = true;
export const DEFAULT_SOURCE_LINE_HIGHLIGHT_COLOR = 'dependent' as const;
export const DEFAULT_SHIM_SIDE_RAIL = true;
export const DEFAULT_DIAGRAMS_PLANTUML_SERVER = DEFAULT_PLANTUML_SERVER;

// build defaults
export const DEFAULT_USE_SUCRASE_TRANSPILER = false;

// tailwind defaults
export const DEFAULT_TAILWIND_ENABLED = 'enabled' as const;
export const DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH = 500;
export const DEFAULT_TAILWIND_CACHE_MAX_ENTRIES = 50;
export const DEFAULT_TAILWIND_CACHE_TTL_SECONDS = 300;
export const DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS = 15000;

// framework defaults
export const DEFAULT_FRAMEWORK = 'auto' as const;
export const DEFAULT_FRAMEWORK_COMPONENT_SHIMS = true;

// components defaults
export const DEFAULT_COMPONENTS_BUILTINS = true;
export const DEFAULT_COMPONENTS_UNKNOWN_BEHAVIOR = 'placeholder' as const;

// advanced defaults
export const DEFAULT_WATCHER_DEBOUNCE_MS = STANDARD_WATCHER_DEBOUNCE_MS;
export const DEFAULT_DEBUG_OUTPUT = false;

// UX panel defaults
export const DEFAULT_SHOW_FRONTMATTER = false;
export const DEFAULT_SHOW_TOC = false;

// default map for all settings (keys match ConfigManager SettingKey)
export const SETTINGS_DEFAULTS = {
  'preview.updateMode': DEFAULT_PREVIEW_UPDATE_MODE,
  'preview.debounceDelay': DEFAULT_PREVIEW_DEBOUNCE_DELAY_MS,
  'preview.enableScripts': DEFAULT_PREVIEW_ENABLE_SCRIPTS,
  'preview.openMdxLinksInPreview': DEFAULT_PREVIEW_OPEN_MDX_LINKS_IN_PREVIEW,
  'preview.security': DEFAULT_PREVIEW_SECURITY_POLICY,
  'preview.useVscodeMarkdownStyles': DEFAULT_PREVIEW_USE_VSCODE_MARKDOWN_STYLES,
  'preview.useWhiteBackground': DEFAULT_PREVIEW_USE_WHITE_BACKGROUND,
  'preview.customCss': DEFAULT_PREVIEW_CUSTOM_CSS,
  'preview.mdx.customLayoutFilePath': DEFAULT_PREVIEW_CUSTOM_LAYOUT_PATH,
  'preview.previewTheme': DEFAULT_PREVIEW_THEME,
  'preview.codeBlockTheme': DEFAULT_CODE_BLOCK_THEME,
  'preview.mermaidTheme': DEFAULT_MERMAID_THEME,
  'preview.autoTheme': DEFAULT_AUTO_THEME,
  'preview.sourceLineHighlight': DEFAULT_SOURCE_LINE_HIGHLIGHT,
  'preview.sourceLineHighlightColor': DEFAULT_SOURCE_LINE_HIGHLIGHT_COLOR,
  'preview.shimSideRail': DEFAULT_SHIM_SIDE_RAIL,
  'diagrams.plantUmlServer': DEFAULT_DIAGRAMS_PLANTUML_SERVER,
  'build.useSucraseTranspiler': DEFAULT_USE_SUCRASE_TRANSPILER,
  'tailwind.enabled': DEFAULT_TAILWIND_ENABLED,
  'tailwind.maxFileSizeBytes': DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES,
  'tailwind.maxCssFilesToSearch': DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH,
  'tailwind.cacheMaxEntries': DEFAULT_TAILWIND_CACHE_MAX_ENTRIES,
  'tailwind.cacheTtlSeconds': DEFAULT_TAILWIND_CACHE_TTL_SECONDS,
  'tailwind.compilationTimeout': DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS,
  framework: DEFAULT_FRAMEWORK,
  'framework.componentShims': DEFAULT_FRAMEWORK_COMPONENT_SHIMS,
  'components.builtins': DEFAULT_COMPONENTS_BUILTINS,
  'components.unknownBehavior': DEFAULT_COMPONENTS_UNKNOWN_BEHAVIOR,
  'advanced.watcherDebounceMs': DEFAULT_WATCHER_DEBOUNCE_MS,
  'advanced.debugOutput': DEFAULT_DEBUG_OUTPUT,
  'preview.showFrontmatter': DEFAULT_SHOW_FRONTMATTER,
  'preview.showToc': DEFAULT_SHOW_TOC,
} as const;
