// packages/shared/index.ts
// shared type definitions & registries for extension & webview packages

// import types used locally in this file
import type { Framework as FrameworkType } from './registry';

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

// component registry - single source of truth for all shim definitions
export {
  // types
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type ComponentDefinition,
  type ComponentBarrelDefinition,
  type Framework,
  type FrameworkId,
  type FrameworkName,
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

// core preloaded module IDs (React, MDX, layout)
export {
  PRELOADED_MODULE_IDS,
  type PreloadedModuleId,
} from './core-modules';

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
  // error context category (module-fetch, transpile, etc)
  context?: string;
  // hint for webview to show retry button
  recoverable?: boolean;
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
export function formatTrustStateForDebug(
  tag: string,
  state: TrustState
): string {
  return (
    `[${tag}] Trust state: canExecute=${state.canExecute}, ` +
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
export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base' | 'null';

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
}

// Nextra _meta.json page-level settings (preview-relevant only)
export interface NextraPageMeta {
  // title from _meta.json or frontmatter (sidebarTitle takes precedence)
  title?: string;
  // layout type: 'default' (max-width container), 'full' (full-width), 'raw' (no styling)
  layout?: 'default' | 'full' | 'raw';
  // page description (from frontmatter)
  description?: string;
  // whether TOC should be visible (informational for preview)
  toc?: boolean;
}

// webview-exposed RPC methods
export interface WebviewRPC {
  setTrustState(state: TrustState): void;
  setFramework(framework: FrameworkType): void;
  // inform webview which generic components are used (for conditional shim preloading)
  setUsedComponents(components: string[]): void;
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void;
  updatePreviewSafe(html: string): void;
  showPreviewError(error: PreviewError): void;
  invalidate(fsPath: string): Promise<void>;
  setStale(isStale: boolean): void;
  setCustomCss(css: string): void;
  setTailwindCss(css: string): void;
  setTheme(state: WebviewThemeState): void;
  setNextraMeta(meta: NextraPageMeta): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
}
