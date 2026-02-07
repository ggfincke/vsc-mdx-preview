// packages/shared/index.ts
// shared type definitions & registries for extension & webview packages

// import types used locally in this file
import type { Framework as FrameworkType } from './registry';
import type { ModuleErrorData } from './errors';

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
} from './constants';

// diagram server utilities
export {
  DEFAULT_PLANTUML_SERVER,
  normalizePlantUmlServerUrl,
  getPlantUmlServerOrigin,
  getPlantUmlRenderEndpoints,
} from './diagrams';

// component registry - single source of truth for all shim definitions
export {
  // types
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type ComponentDefinition,
  type ComponentBarrelDefinition,
  type Framework,
  type FrameworkId,
  type FrameworkSetting,
  // registry data
  COMPONENT_REGISTRY,
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  type ComponentRegistryEntryType,
  type GenericComponentName,
  type GenericComponentAlias,
  type DocusaurusComponent,
  type StarlightComponent,
  type NextjsComponent,
  type NextraComponent,
  // queries
  getAllGenericComponentNames,
  getGenericComponentSet,
  getPrimaryGenericComponentNames,
  getCanonicalComponentName,
  getFrameworkComponents,
  isGenericComponent,
  isFrameworkComponent,
  getGenericShimPath,
  getFrameworkShimPath,
} from './registry';

// core preloaded module IDs (react, mdx, layout)
export { PRELOADED_MODULE_IDS, type PreloadedModuleId } from './core-modules';

// fetch result w/ module code & dependencies
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

// trust state between extension & webview
export interface TrustState {
  workspaceTrusted: boolean;
  scriptsEnabled: boolean;
  canExecute: boolean;
  reason?: string;
  openMdxLinksInPreview: boolean;
}

// preview error w/ message & optional stack trace
export interface PreviewError {
  message: string;
  stack?: string;
  code?: string;
  // error context
  context?: string;
  // recoverable
  recoverable?: boolean;
  // module error data
  moduleError?: ModuleErrorData;
}

// check if value is a PreviewError
export function isPreviewError(value: unknown): value is PreviewError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as PreviewError).message === 'string'
  );
}

// format trust state for debug logging
export function formatTrustStateForDebug(state: TrustState): string {
  return (
    `Trust state: canExecute=${state.canExecute}, ` +
    `workspaceTrusted=${state.workspaceTrusted}, ` +
    `scriptsEnabled=${state.scriptsEnabled}`
  );
}

// error handling utilities
export {
  isError,
  extractErrorMessage,
  extractErrorStack,
  normalizeError,
  extractErrorInfo,
  extractErrorChain,
  formatErrorWithCause,
  type ErrorInfo,
} from './utils/errors';

// module error types (shared between extension & webview)
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
  // error factory functions
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

// module ID utilities (npm:// format handling)
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
} from './utils/module-id';

// LRU cache utilities
export {
  LRUCache,
  type LRUCacheOptions,
  NullableLRUCache,
  type NullableLRUCacheOptions,
  type NullableCacheResult,
  ContentHashCache,
  type ContentHashCacheOptions,
} from './utils';

// concurrency utilities
export { Semaphore } from './utils';

// validation utilities (pure type guards & coercers)
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
} from './utils';

// available preview themes (markdown content styling)
export type PreviewTheme =
  | 'github-light'
  | 'github-dark'
  | 'atom-dark'
  | 'atom-light'
  | 'atom-material'
  | 'one-dark'
  | 'one-light'
  | 'solarized-dark'
  | 'solarized-light'
  | 'gothic'
  | 'medium'
  | 'monokai'
  | 'newsprint'
  | 'night'
  | 'none'
  | 'vue';

// available mermaid diagram themes
export type MermaidTheme =
  | 'default'
  | 'dark'
  | 'forest'
  | 'neutral'
  | 'base'
  | 'null';

// available mermaid themes array (canonical source)
export const MERMAID_THEMES: MermaidTheme[] = [
  'default',
  'dark',
  'forest',
  'neutral',
  'base',
  'null',
];

// available code block themes (syntax highlighting)
export type CodeBlockTheme =
  | 'auto'
  | 'default'
  | 'atom-dark'
  | 'atom-light'
  | 'atom-material'
  | 'coy'
  | 'darcula'
  | 'dark'
  | 'funky'
  | 'github'
  | 'github-dark'
  | 'hopscotch'
  | 'monokai'
  | 'okaidia'
  | 'one-dark'
  | 'one-light'
  | 'pen-paper-coffee'
  | 'pojoaque'
  | 'solarized-dark'
  | 'solarized-light'
  | 'twilight'
  | 'vs'
  | 'vue'
  | 'xonokai';

// theme state sent from extension to webview
export interface WebviewThemeState {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  mermaidTheme: MermaidTheme;
  isLight: boolean;
  plantUmlServer: string;
}

// check if a preview theme is a light theme
export function isLightPreviewTheme(theme: PreviewTheme): boolean {
  return (
    theme.includes('light') ||
    ['medium', 'newsprint', 'gothic', 'none', 'vue'].includes(theme)
  );
}

// available preview themes
export const PREVIEW_THEMES: PreviewTheme[] = [
  'github-light',
  'github-dark',
  'atom-dark',
  'atom-light',
  'atom-material',
  'one-dark',
  'one-light',
  'solarized-dark',
  'solarized-light',
  'gothic',
  'medium',
  'monokai',
  'newsprint',
  'night',
  'none',
  'vue',
];

// available code block themes
export const CODE_BLOCK_THEMES: CodeBlockTheme[] = [
  'auto',
  'default',
  'atom-dark',
  'atom-light',
  'atom-material',
  'coy',
  'darcula',
  'dark',
  'funky',
  'github',
  'github-dark',
  'hopscotch',
  'monokai',
  'okaidia',
  'one-dark',
  'one-light',
  'pen-paper-coffee',
  'pojoaque',
  'solarized-dark',
  'solarized-light',
  'twilight',
  'vs',
  'vue',
  'xonokai',
];

// light/dark theme pairs for auto theme switching
export const THEME_PAIRS: Record<
  string,
  { light: PreviewTheme; dark: PreviewTheme }
> = {
  github: { light: 'github-light', dark: 'github-dark' },
  atom: { light: 'atom-light', dark: 'atom-dark' },
  one: { light: 'one-light', dark: 'one-dark' },
  solarized: { light: 'solarized-light', dark: 'solarized-dark' },
};

// find opposite theme for auto light/dark switching
export function getOppositeTheme(
  theme: PreviewTheme,
  targetIsLight: boolean
): PreviewTheme {
  for (const pair of Object.values(THEME_PAIRS)) {
    if (pair.light === theme && !targetIsLight) {
      return pair.dark;
    }
    if (pair.dark === theme && targetIsLight) {
      return pair.light;
    }
  }
  // return theme unchanged if no pair found
  return theme;
}

// extension-exposed RPC methods
export interface ExtensionRPC {
  handshake(): void;
  reportPerformance(evaluationDuration: number): void;
  fetch(
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined>;
  openSettings(settingId?: string): void;
  manageTrust(): void;
  openExternal(url: string): void;
  openDocument(
    relativePath: string,
    line?: number,
    column?: number
  ): Promise<void>;
  openPreview(relativePath: string): Promise<void>;
  renderPlantUml(code: string): Promise<string | undefined>;
}

// Nextra _meta.json page-level settings (preview-relevant only)
export interface NextraPageMeta {
  // title
  title?: string;
  // layout
  layout?: 'default' | 'full' | 'raw';
  // description
  description?: string;
  // toc visibility
  toc?: boolean;
}

// webview-exposed RPC methods
export interface WebviewRPC {
  setTrustState(state: TrustState): void;
  setFramework(framework: FrameworkType): void;
  // used components
  setUsedComponents(components: string[]): void;
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void;
  updatePreviewSafe(html: string): void;
  showPreviewError(error: PreviewError): void;
  invalidate(fsPath: string): Promise<void>;
  // clear caches
  clearAllCaches(): Promise<void>;
  setStale(isStale: boolean): void;
  setCustomCss(css: string): void;
  setTailwindCss(css: string): void;
  setTheme(state: WebviewThemeState): void;
  setNextraMeta(meta: NextraPageMeta): void;
}

// logging types & tags (shared between extension & webview)
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

// config enums (canonical source for validation & settings)
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

// callout types & normalization (shared between extension & webview)
export {
  type CalloutType,
  VALID_CALLOUT_TYPES,
  VALID_CALLOUT_TYPE_SET,
  CALLOUT_TYPE_ALIASES,
  CALLOUT_TITLES,
  normalizeCalloutType,
  isValidCalloutType,
} from './callout';

// centralized icon definitions (shared between extension & webview)
export {
  CALLOUT_ICONS,
  GITHUB_ICONS,
  GITHUB_ALERT_ICONS,
  FILE_TREE_ICONS,
  type CalloutIconType,
  type GitHubIconType,
  type GitHubAlertIconType,
  type FileTreeIconType,
} from './icons';
