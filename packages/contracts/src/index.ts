// packages/contracts/src/index.ts
// contract types, interfaces & constants for extension & webview packages

// framework type aliases
export type { Framework, FrameworkId, FrameworkSetting } from './frameworks';

// shared timing & limit constants
export {
  STANDARD_DEBOUNCE_MS,
  STANDARD_CACHE_TTL_MS,
  STANDARD_WATCHER_DEBOUNCE_MS,
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from './runtime';

// core preloaded module IDs
export { PRELOADED_MODULE_IDS, type PreloadedModuleId } from './runtime';

// diagram constants
export { DEFAULT_PLANTUML_SERVER } from './diagrams';

// preview types
export {
  type FetchResult,
  type TrustState,
  type PreviewError,
  isPreviewError,
  formatTrustStateForDebug,
  type NextraPageMeta,
} from './preview';

// module error types
export {
  type ModuleErrorCode,
  type ModuleErrorData,
  MODULE_ERROR_LABELS,
  isModuleErrorData,
  formatModuleErrorDisplay,
  MODULE_ERROR_SUGGESTIONS,
  getSuggestionsForCode,
  ModuleError,
  type ModuleErrorOptions,
  type ExtensionModuleErrorCode,
  type WebviewModuleErrorCode,
  createModuleNotFoundError,
  createOutsideWorkspaceError,
  createParseError,
  createTransformError,
  createCircularDependencyError,
  createFetchFailedError,
  createEvaluationFailedError,
  createModuleDepthExceededError,
} from './errors';

// theme types, constants & functions
export {
  type PreviewTheme,
  type MermaidTheme,
  type CodeBlockTheme,
  type WebviewThemeState,
  MERMAID_THEMES,
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
} from './themes';

// RPC interface contracts
export type { ExtensionRPC, WebviewRPC } from './rpc';

// logging types & tags
export {
  LogLevel,
  type LogFn,
  type LogFnVariadic,
  type Logger,
  type LoggerVariadic,
  type TaggedLogger,
  type TaggedLoggerFactory,
  LogTags,
  type LogTag,
  createTaggedLoggerFactory,
  type BaseLoggerVariadic,
} from './logging';

// config enums, defaults & schema
export {
  FRAMEWORK_IDS,
  FRAMEWORK_SETTINGS,
  TAILWIND_ENABLED_VALUES,
  UNKNOWN_BEHAVIOR_VALUES,
  UPDATE_MODE_VALUES,
  SECURITY_POLICY_VALUES,
  DEFAULT_PREVIEW_UPDATE_MODE,
  DEFAULT_PREVIEW_DEBOUNCE_DELAY_MS,
  DEFAULT_PREVIEW_ENABLE_SCRIPTS,
  DEFAULT_PREVIEW_OPEN_MDX_LINKS_IN_PREVIEW,
  DEFAULT_PREVIEW_SECURITY_POLICY,
  DEFAULT_PREVIEW_USE_VSCODE_MARKDOWN_STYLES,
  DEFAULT_PREVIEW_USE_WHITE_BACKGROUND,
  DEFAULT_PREVIEW_CUSTOM_CSS,
  DEFAULT_PREVIEW_CUSTOM_LAYOUT_PATH,
  DEFAULT_PREVIEW_THEME,
  DEFAULT_CODE_BLOCK_THEME,
  DEFAULT_MERMAID_THEME,
  DEFAULT_AUTO_THEME,
  DEFAULT_DIAGRAMS_PLANTUML_SERVER,
  DEFAULT_USE_SUCRASE_TRANSPILER,
  DEFAULT_TAILWIND_ENABLED,
  DEFAULT_TAILWIND_MAX_FILE_SIZE_BYTES,
  DEFAULT_TAILWIND_MAX_CSS_FILES_TO_SEARCH,
  DEFAULT_TAILWIND_CACHE_MAX_ENTRIES,
  DEFAULT_TAILWIND_CACHE_TTL_SECONDS,
  DEFAULT_TAILWIND_COMPILATION_TIMEOUT_MS,
  DEFAULT_FRAMEWORK,
  DEFAULT_FRAMEWORK_COMPONENT_SHIMS,
  DEFAULT_COMPONENTS_BUILTINS,
  DEFAULT_COMPONENTS_UNKNOWN_BEHAVIOR,
  DEFAULT_WATCHER_DEBOUNCE_MS,
  SETTINGS_DEFAULTS,
  MDX_PREVIEW_CONFIG_SCHEMA,
  type TailwindEnabledValue,
  type UnknownBehaviorValue,
  type UpdateModeValue,
  type SecurityPolicyValue,
} from './config';
