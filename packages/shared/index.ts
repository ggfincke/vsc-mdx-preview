// packages/shared/index.ts
// shared type definitions and registries for extension & webview packages

// component registry - single source of truth for all shim definitions
export {
  COMPONENT_REGISTRY,
  SHIM_PREFIX,
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
  type ComponentRegistryEntry,
  type ComponentRegistryEntryType,
  type ComponentDefinition,
  type ComponentBarrelDefinition,
  type Framework,
  type FrameworkId,
  type GenericComponentName,
  type GenericComponentAlias,
  type DocusaurusComponent,
  type StarlightComponent,
  type NextjsComponent,
  type NextraComponent,
} from './registry/components';

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
  // error context category (module-fetch, transpile, etc.)
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

// error handling utilities
export {
  isError,
  extractErrorMessage,
  extractErrorStack,
  normalizeError,
  extractErrorInfo,
  type ErrorInfo,
} from './utils/errors';

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
  // Title from _meta.json or frontmatter (sidebarTitle takes precedence)
  title?: string;
  // Layout type: 'default' (max-width container), 'full' (full-width), 'raw' (no styling)
  layout?: 'default' | 'full' | 'raw';
  // Page description (from frontmatter)
  description?: string;
  // Whether TOC should be visible (informational for preview)
  toc?: boolean;
}

// webview-exposed RPC methods
export interface WebviewRPC {
  setTrustState(state: TrustState): void;
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
