// packages/shared/index.ts
// re-export facade for backward compatibility
// moved modules re-exported from @mdx-preview/contracts, @mdx-preview/registry, & @mdx-preview/runtime-utils

// framework type aliases (from contracts)
export type {
  Framework,
  FrameworkId,
  FrameworkSetting,
} from '@mdx-preview/contracts';

// shared timing & limit constants (from contracts)
export {
  STANDARD_DEBOUNCE_MS,
  STANDARD_CACHE_TTL_MS,
  STANDARD_WATCHER_DEBOUNCE_MS,
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
} from '@mdx-preview/contracts';

// diagram constants (from contracts)
export { DEFAULT_PLANTUML_SERVER } from '@mdx-preview/contracts';

// diagram runtime helpers (from runtime-utils)
export {
  normalizePlantUmlServerUrl,
  getPlantUmlServerOrigin,
  getPlantUmlRenderEndpoints,
} from '@mdx-preview/runtime-utils';

// component shim registry metadata (source of truth in doc-components)
export {
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type ComponentDefinition,
  type ComponentBarrelDefinition,
  type ComponentRegistryEntryType,
  type GenericComponentName,
  type GenericComponentAlias,
  type DocusaurusComponent,
  type StarlightComponent,
  type NextjsComponent,
  type NextraComponent,
  COMPONENT_REGISTRY,
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  getAllGenericComponentNames,
  getGenericComponentSet,
  getPrimaryGenericComponentNames,
  getCanonicalComponentName,
  getFrameworkComponents,
  isGenericComponent,
  isFrameworkComponent,
  getGenericShimPath,
  getFrameworkShimPath,
} from 'mdx-tools/components/registry';

// core preloaded module IDs (from contracts)
export {
  PRELOADED_MODULE_IDS,
  type PreloadedModuleId,
} from '@mdx-preview/contracts';

// preview types (from contracts)
export {
  type FetchResult,
  type TrustState,
  type PreviewError,
  isPreviewError,
  formatTrustStateForDebug,
  type NextraPageMeta,
} from '@mdx-preview/contracts';

// error handling utilities (from runtime-utils)
export {
  isError,
  extractErrorMessage,
  extractErrorStack,
  normalizeError,
  extractErrorInfo,
  extractErrorChain,
  formatErrorWithCause,
  type ErrorInfo,
} from '@mdx-preview/runtime-utils';

// module error types (from contracts)
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
} from '@mdx-preview/contracts';

// module ID utilities (from runtime-utils)
export {
  NPM_MODULE_PREFIX,
  isNpmModuleId,
  isBareImport,
  parseNpmModuleId,
  createNpmModuleId,
  hasUrlScheme,
  isValidModuleRequest,
  URL_SCHEME_PATTERN,
  type ParsedNpmModuleId,
} from '@mdx-preview/runtime-utils';

// LRU cache utilities (from runtime-utils)
export {
  LRUCache,
  type LRUCacheOptions,
  ContentHashCache,
  type ContentHashCacheOptions,
} from '@mdx-preview/runtime-utils';

// concurrency utilities (from runtime-utils)
export { Semaphore } from '@mdx-preview/runtime-utils';

// validation utilities (from runtime-utils)
export {
  isString,
  isNonEmptyString,
  isBoolean,
  isNumber,
  isFiniteNumber,
  isFunction,
  isObject,
  isArray,
  isArrayOf,
  isOneOf,
  isOptional,
  asString,
  asNonEmptyString,
  asBoolean,
  asNumber,
} from '@mdx-preview/runtime-utils';

// theme types, constants & functions (from contracts)
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
} from '@mdx-preview/contracts';

// RPC interface contracts (from contracts)
export type { ExtensionRPC, WebviewRPC } from '@mdx-preview/contracts';

// logging types & tags (from contracts)
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
} from '@mdx-preview/contracts';

// config enums, defaults & schema (from contracts)
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
} from '@mdx-preview/contracts';

// callout types & normalization (from registry)
export {
  type CalloutType,
  VALID_CALLOUT_TYPES,
  VALID_CALLOUT_TYPE_SET,
  CALLOUT_TYPE_ALIASES,
  CALLOUT_TITLES,
  normalizeCalloutType,
  isValidCalloutType,
} from '@mdx-preview/registry';

// centralized icon definitions (from registry)
export {
  CALLOUT_ICONS,
  GITHUB_ICONS,
  GITHUB_ALERT_ICONS,
  FILE_TREE_ICONS,
  LUCIDE_ICONS,
  type CalloutIconType,
  type GitHubIconType,
  type GitHubAlertIconType,
  type FileTreeIconType,
  type LucideIconType,
} from '@mdx-preview/registry';
