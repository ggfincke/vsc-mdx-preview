// tests/helpers/mock-services.ts
// shared service mock singletons for test infrastructure
// replaces per-file vi.mock('app/services') overrides w/ stable, configurable mocks

import { vi } from 'vitest';

// stable mock objects - same instances used by global setup & all test files
// configure behavior in beforeEach, reset happens via vi.clearAllMocks() in setup

export const mockConfigManager = {
  get: vi.fn((key: string) => {
    const defaults: Record<string, unknown> = {
      'preview.enableScripts': true,
      'components.builtins': true,
      'components.unknownBehavior': 'placeholder',
      'build.useSucraseTranspiler': false,
    };
    return defaults[key];
  }),
  set: vi.fn(async () => {}),
  getAll: vi.fn(() => ({})),
  inspect: vi.fn(),
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeKey: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
};

export const mockTrustManager = {
  getState: vi.fn(() => ({ canExecute: false })),
  getStateForDocument: vi.fn(() => ({ canExecute: false })),
  canExecute: vi.fn(() => false),
  subscribe: vi.fn(() => ({ dispose: vi.fn() })),
};

export const mockFrameworkDetector = {
  getFramework: vi.fn(() => ({ framework: 'generic', confidence: 1 })),
  areShimsEnabled: vi.fn(() => true),
  getFrameworkDisplayName: vi.fn((id: string) => id),
  subscribe: vi.fn(() => ({ dispose: vi.fn() })),
};

export const mockErrorReporter = {
  report: vi.fn(),
  reportSilent: vi.fn(),
  reportToUser: vi.fn(),
  reportConfigError: vi.fn(),
  reportWebviewError: vi.fn(),
  reportWithActions: vi.fn(async () => {}),
};

export const mockPreviewManager = {
  getCurrentPreview: vi.fn(),
  refreshAllPreviews: vi.fn(async () => {}),
  clearAllWebviewCaches: vi.fn(async () => {}),
  getPanel: vi.fn(),
  setPanel: vi.fn(),
  setPanelDoc: vi.fn(),
  getPanelDoc: vi.fn(),
  getExtensionUri: vi.fn(),
  setExtensionUri: vi.fn(),
  getWebviewAppUris: vi.fn(),
  setWebviewAppUris: vi.fn(),
  clearPanel: vi.fn(),
  getPanelDisposables: vi.fn(() => []),
};

export const mockThemeManager = {
  getWebviewThemeState: vi.fn(() => ({})),
  extractThemeFromFrontmatter: vi.fn(() => ({})),
  getThemeConfiguration: vi.fn(() => ({ mermaidIconPacks: [] })),
};

export const mockConfigCache = {
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn(() => false),
  clear: vi.fn(),
  hasWatcher: vi.fn(() => false),
  watchConfigPath: vi.fn(),
  unwatchConfigPath: vi.fn(),
  invalidate: vi.fn(),
  notifyChange: vi.fn(),
  subscribe: vi.fn(() => ({ dispose: vi.fn() })),
};

export const mockTailwindProcessor = {
  process: vi.fn(async () => undefined),
  isEnabled: vi.fn(() => false),
  invalidateCache: vi.fn(),
  detectProfile: vi.fn(),
  invalidateVersionCache: vi.fn(),
  invalidateDetectionCaches: vi.fn(),
  invalidateScanCache: vi.fn(),
};

export const mockStatusBarManager = {
  update: vi.fn(),
  dispose: vi.fn(),
};

export const mockMetaResolver = {
  resolve: vi.fn(),
  invalidate: vi.fn(),
};

export const mockOutputChannel = {
  appendLine: vi.fn(),
  append: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
};

// service module mock factory (used by setup.ts via async import)
export function getServicesMockModule() {
  return {
    getConfigManager: vi.fn(() => mockConfigManager),
    getConfigCache: vi.fn(() => mockConfigCache),
    getTrustManager: vi.fn(() => mockTrustManager),
    getThemeManager: vi.fn(() => mockThemeManager),
    getPreviewManager: vi.fn(() => mockPreviewManager),
    getFrameworkDetector: vi.fn(() => mockFrameworkDetector),
    getTailwindProcessor: vi.fn(() => mockTailwindProcessor),
    getErrorReporter: vi.fn(() => mockErrorReporter),
    getStatusBarManager: vi.fn(() => mockStatusBarManager),
    getMetaResolver: vi.fn(() => mockMetaResolver),
    ServiceRegistry: {},
    ServiceNames: {},
  };
}

// configure trust state (convenience helper for common test setup)
export function configureTrustState(trusted: boolean): void {
  const state = {
    canExecute: trusted,
    workspaceTrusted: trusted,
    isLocalWorkspace: true,
    isLocalDocScheme: true,
    enableScripts: trusted,
  };
  mockTrustManager.getState.mockReturnValue(state);
  mockTrustManager.getStateForDocument.mockReturnValue(state);
}
