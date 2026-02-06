// tests/compilation/trusted-compile.test.ts
// Unit tests for Trusted Mode MDX compilation (MDX -> JavaScript)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => ({ scheme: 'file', fsPath: path, path }),
  },
}));

// Mock services w/ hoisted mocks
const { mockTrustManager } = vi.hoisted(() => ({
  mockTrustManager: {
    getStateForDocument: vi.fn(() => ({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    })),
    canExecute: vi.fn(() => true),
  },
}));

vi.mock('../../packages/extension/services', () => ({
  getTrustManager: () => mockTrustManager,
}));

// Mock logging
vi.mock('../../packages/extension/logging', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock plugin loader (avoid loading real plugins)
vi.mock('../../packages/extension/compiler/plugins/loader', () => ({
  loadPluginsFromConfig: vi.fn(async () => ({
    remarkPlugins: [],
    rehypePlugins: [],
    errorCount: 0,
  })),
}));

// Import after mocks
import { compileTrusted } from '../../packages/extension/compiler/trusted/compile';
import {
  createMockPreview,
  createMockCompilerConfigFromPreview,
  FIXTURES,
} from '../helpers';

describe('compileTrusted()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to JavaScript with React imports', async () => {
    const preview = createMockPreview({ content: FIXTURES.basicMdx });
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createMockCompilerConfigFromPreview(preview)
    );

    expect(result.code).toContain('import React from');
    expect(result.code).toContain('MDXContent');
    expect(result.code).toContain('export default');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const preview = createMockPreview({ content: FIXTURES.mdxWithFrontmatter });
    const result = await compileTrusted(
      FIXTURES.mdxWithFrontmatter,
      true,
      createMockCompilerConfigFromPreview(preview)
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
  });

  it('injects vscode-markdown-layout when no default export and useVscodeMarkdownStyles is true', async () => {
    const preview = createMockPreview({
      content: FIXTURES.basicMdx,
      configuration: { useVscodeMarkdownStyles: true },
    });
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createMockCompilerConfigFromPreview(preview)
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toContain('createLayout');
  });

  it('preserves existing default export (no layout injection)', async () => {
    const preview = createMockPreview({
      content: FIXTURES.mdxWithLayout,
      configuration: { useVscodeMarkdownStyles: true },
    });
    const result = await compileTrusted(
      FIXTURES.mdxWithLayout,
      true,
      createMockCompilerConfigFromPreview(preview)
    );

    // Should NOT inject vscode-markdown-layout when there's already a default export
    expect(result.code).not.toContain('vscode-markdown-layout');
  });

  it('returns empty frontmatter when none present', async () => {
    const preview = createMockPreview({ content: FIXTURES.basicMdx });
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createMockCompilerConfigFromPreview(preview)
    );

    expect(result.frontmatter).toEqual({});
  });
});
