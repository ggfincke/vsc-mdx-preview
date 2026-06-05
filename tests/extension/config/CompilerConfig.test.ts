// tests/extension/config/CompilerConfig.test.ts
// unit tests for compiler config projection helpers

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EffectivePreviewConfig,
  ResolvedConfig,
} from '../../../packages/extension-host/src/types';
import { mockConfigManager, mockThemeManager } from '../../helpers/mock-services';

const { mockResolveConfig } = vi.hoisted(() => ({
  mockResolveConfig: vi.fn(),
}));

vi.mock(
  '../../../packages/extension-host/src/features/preview/configuration/ConfigResolver',
  () => ({
    resolveConfig: mockResolveConfig,
  })
);

import {
  buildCompilerConfig,
  buildEffectivePreviewConfig,
  toCompilerConfig,
} from '../../../packages/extension-host/src/shared/config/EffectivePreviewConfig';
import { DEFAULTS } from '../../../packages/extension-host/src/shared/config/setting-keys';
import { SecurityPolicy } from '../../../packages/extension-host/src/features/security/SecurityPolicy';
import { SETTINGS_DEFAULTS } from '@mdx-preview/contracts';

const DOC_URI = {
  scheme: 'file',
  fsPath: '/workspace/docs/page.mdx',
  path: '/workspace/docs/page.mdx',
  toString: () => 'file:///workspace/docs/page.mdx',
} as any;

const BASE_SETTINGS = {
  'preview.updateMode': 'onType',
  'preview.debounceDelay': 120,
  'preview.enableScripts': true,
  'preview.openMdxLinksInPreview': true,
  'preview.security': 'strict',
  'preview.useVscodeMarkdownStyles': true,
  'preview.useWhiteBackground': false,
  'preview.customCss': '',
  'preview.mdx.customLayoutFilePath': '/workspace/layout.tsx',
  'build.useSucraseTranspiler': false,
  'preview.previewTheme': 'github-light',
  'preview.codeBlockTheme': 'auto',
  'preview.autoTheme': true,
  'diagrams.plantUmlServer': 'https://kroki.io',
  'tailwind.enabled': 'auto',
  'tailwind.maxFileSizeBytes': 1024,
  'tailwind.maxCssFilesToSearch': 50,
  'tailwind.cacheMaxEntries': 20,
  'tailwind.cacheTtlSeconds': 30,
  'tailwind.compilationTimeout': 2000,
  framework: 'auto',
  'framework.componentShims': true,
  'components.builtins': true,
  'components.unknownBehavior': 'placeholder',
};

function createEffectiveConfig(): EffectivePreviewConfig {
  return {
    updateMode: 'onType',
    debounceDelay: 120,
    enableScripts: true,
    openMdxLinksInPreview: true,
    securityPolicy: 'strict',
    useVscodeMarkdownStyles: true,
    useWhiteBackground: false,
    customCss: '',
    customLayoutFilePath: '/workspace/layout.tsx',
    useSucraseTranspiler: false,
    previewTheme: 'github-light',
    codeBlockTheme: 'auto',
    autoTheme: true,
    plantUmlServer: 'https://kroki.io',
    tailwind: {
      enabled: 'auto',
      maxFileSizeBytes: 1024,
      maxCssFilesToSearch: 50,
      cacheMaxEntries: 20,
      cacheTtlSeconds: 30,
      compilationTimeout: 2000,
      configPath: undefined,
    },
    framework: 'auto',
    frameworkComponentShims: true,
    componentsBuiltins: false,
    componentsUnknownBehavior: 'raw',
    remarkPlugins: undefined,
    rehypePlugins: undefined,
    components: undefined,
    frameworkOverride: undefined,
    frameworkOptions: undefined,
    configFile: null,
  };
}

describe('CompilerConfig helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager.getAll.mockReturnValue(BASE_SETTINGS);
    mockThemeManager.extractThemeFromFrontmatter.mockReturnValue({});
    mockResolveConfig.mockReturnValue(null);
  });

  it('projects compiler fields from effective config', () => {
    const effectiveConfig = createEffectiveConfig();
    const compilerConfig = toCompilerConfig(effectiveConfig, {
      docUri: DOC_URI,
      docFsPath: DOC_URI.fsPath,
    });

    expect(compilerConfig).toEqual({
      docUri: DOC_URI,
      docFsPath: '/workspace/docs/page.mdx',
      customLayoutFilePath: '/workspace/layout.tsx',
      useVscodeMarkdownStyles: true,
      useWhiteBackground: false,
      componentsBuiltins: false,
      componentsUnknownBehavior: 'raw',
      configFile: null,
    });
  });

  it('builds compiler config from merged effective config', () => {
    const resolvedConfig: ResolvedConfig = {
      configPath: '/workspace/.mdx-previewrc.json',
      configDir: '/workspace',
      config: {
        unknownBehavior: 'strip',
        enableScripts: false,
      },
    };
    mockResolveConfig.mockReturnValue(resolvedConfig);

    const compilerConfig = buildCompilerConfig({
      docUri: DOC_URI,
      docFsPath: DOC_URI.fsPath,
    });

    expect(compilerConfig).toEqual({
      docUri: DOC_URI,
      docFsPath: '/workspace/docs/page.mdx',
      customLayoutFilePath: '/workspace/layout.tsx',
      useVscodeMarkdownStyles: true,
      useWhiteBackground: false,
      componentsBuiltins: true,
      componentsUnknownBehavior: 'strip',
      configFile: resolvedConfig,
    });
  });

  it('config file can only disable enableScripts, never enable it', () => {
    mockResolveConfig.mockReturnValue({
      configPath: '/workspace/.mdx-previewrc.json',
      configDir: '/workspace',
      config: { enableScripts: false },
    });
    const disabled = buildEffectivePreviewConfig({
      docUri: DOC_URI,
      docFsPath: DOC_URI.fsPath,
    });
    expect(disabled.enableScripts).toBe(false);

    // no file override -> falls through to enabled setting
    mockResolveConfig.mockReturnValue(null);
    const passthrough = buildEffectivePreviewConfig({
      docUri: DOC_URI,
      docFsPath: DOC_URI.fsPath,
    });
    expect(passthrough.enableScripts).toBe(true);
  });

  it('derives extension defaults from shared contract defaults', () => {
    const expectedSecurityPolicy =
      (SETTINGS_DEFAULTS['preview.security'] as string) === 'disabled'
        ? SecurityPolicy.Disabled
        : SecurityPolicy.Strict;

    expect(Object.keys(DEFAULTS).sort()).toEqual(
      Object.keys(SETTINGS_DEFAULTS).sort()
    );
    expect(DEFAULTS).toEqual({
      ...SETTINGS_DEFAULTS,
      'preview.security': expectedSecurityPolicy,
    });
  });
});
