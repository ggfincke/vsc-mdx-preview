// tests/extension/preview/PreviewConfiguration.test.ts
// config change detection — drives preview refresh decisions

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockConfigManager } from '../../helpers/mock-services';

// mock readPreviewConfigurationState
const mockReadState = vi.fn();
vi.mock(
  '../../../packages/extension-host/src/shared/config/preview-settings',
  () => ({
    readPreviewConfigurationState: (...args: unknown[]) =>
      mockReadState(...args),
  })
);

// mock lodash.debounce to return passthrough
vi.mock('lodash.debounce', () => ({
  default: (fn: Function) => fn,
}));

import { PreviewConfiguration } from '../../../packages/extension-host/src/features/preview/PreviewConfiguration';

// default configuration state
function createConfigState(overrides: Record<string, unknown> = {}) {
  return {
    updateMode: 'onChange',
    debounceDelay: 300,
    useVscodeMarkdownStyles: true,
    useWhiteBackground: false,
    customLayoutFilePath: '',
    customCss: '',
    plantUmlServer: '',
    useSucraseTranspiler: false,
    securityPolicy: 'strict',
    tailwindEnabled: 'auto',
    ...overrides,
  };
}

const mockDocUri = { scheme: 'file', fsPath: '/workspace/test.mdx' };

describe('PreviewConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadState.mockReturnValue(createConfigState());
    mockConfigManager.getAll.mockReturnValue({});
  });

  it('reads initial configuration on construction', () => {
    new PreviewConfiguration(mockDocUri as any, vi.fn());

    expect(mockReadState).toHaveBeenCalledWith(mockConfigManager, mockDocUri);
  });

  it('exposes configuration & style getters', () => {
    const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

    expect(config.configuration.updateMode).toBe('onChange');
    expect(config.styleConfiguration).toEqual({
      useVscodeMarkdownStyles: true,
      useWhiteBackground: false,
    });
    expect(config.securityConfiguration).toEqual({
      securityPolicy: 'strict',
    });
  });

  describe('updateConfiguration()', () => {
    it('detects style changes -> needsWebviewRefresh: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ useWhiteBackground: true })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects security policy change -> needsWebviewRefresh: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ securityPolicy: 'disabled' })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects debounce delay change -> needsDebounceRecreate: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ debounceDelay: 500 })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsDebounceRecreate).toBe(true);
    });

    it('detects CSS path change -> needsCssWatcherUpdate: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ customCss: '/workspace/custom.css' })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsCssWatcherUpdate).toBe(true);
      expect(result.oldCssPath).toBe('');
    });

    it('detects customLayoutFilePath change -> needsWebviewRefresh: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ customLayoutFilePath: '/workspace/layout.tsx' })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects plantUmlServer change -> needsWebviewRefresh: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ plantUmlServer: 'http://localhost:8080' })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects tailwindEnabled change -> needsWebviewRefresh: true', () => {
      mockReadState.mockReturnValueOnce(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      mockReadState.mockReturnValueOnce(
        createConfigState({ tailwindEnabled: 'enabled' })
      );
      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('returns no changes when config is identical', () => {
      mockReadState.mockReturnValue(createConfigState());
      const config = new PreviewConfiguration(mockDocUri as any, vi.fn());

      const result = config.updateConfiguration(mockDocUri as any, vi.fn());

      expect(result.needsWebviewRefresh).toBe(false);
      expect(result.needsDebounceRecreate).toBe(false);
      expect(result.needsCssWatcherUpdate).toBe(false);
    });
  });
});
