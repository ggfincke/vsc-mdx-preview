// tests/compilation/safe-compile.test.ts
// Unit tests for Safe Mode MDX compilation (MDX -> HTML)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({}));

// Mock services w/ hoisted mocks
const { mockConfigManager } = vi.hoisted(() => ({
  mockConfigManager: {
    get: vi.fn((key: string): unknown => {
      if (key === 'components.builtins') return true;
      if (key === 'components.unknownBehavior') return 'placeholder';
      return undefined;
    }),
  },
}));

vi.mock('../../packages/extension/services', () => ({
  getConfigManager: () => mockConfigManager,
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

// Import after mocks
import { compileSafe } from '../../packages/extension/compiler/safe/compile';
import { FIXTURES } from '../helpers';

describe('compileSafe()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigManager.get.mockImplementation((key: string) => {
      if (key === 'components.builtins') return true;
      if (key === 'components.unknownBehavior') return 'placeholder';
      return undefined;
    });
  });

  it('compiles basic MDX to HTML', async () => {
    const result = await compileSafe(FIXTURES.basicMdx);

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p');
    expect(result.html).toContain('World');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileSafe(FIXTURES.mdxWithFrontmatter);

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    // Frontmatter should not appear in HTML
    expect(result.html).not.toContain('Test Document');
    expect(result.html).not.toContain('author:');
  });

  it('creates placeholder for unknown JSX components (default behavior)', async () => {
    const result = await compileSafe(FIXTURES.mdxWithJsx);

    expect(result.html).toContain('mdx-unknown-component-placeholder');
    expect(result.html).toContain('CustomComponent');
  });

  it('strips unknown components when unknownBehavior is "strip"', async () => {
    mockConfigManager.get.mockImplementation((key: string) => {
      if (key === 'components.builtins') return true;
      if (key === 'components.unknownBehavior') return 'strip';
      return undefined;
    });

    const result = await compileSafe(FIXTURES.mdxWithJsx);

    expect(result.html).not.toContain('CustomComponent');
    expect(result.html).not.toContain('mdx-unknown-component');
  });

  it('replaces JSX expressions with placeholder', async () => {
    const result = await compileSafe(FIXTURES.mdxWithExpression);

    expect(result.html).toContain('mdx-expression-placeholder');
    expect(result.html).toContain('{...}');
    // Should not evaluate the expression
    expect(result.html).not.toContain('42');
  });

  it('handles code blocks correctly', async () => {
    const result = await compileSafe(FIXTURES.mdxWithCodeBlock);

    expect(result.html).toContain('<pre');
    expect(result.html).toContain('<code');
    expect(result.html).toContain('const');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileSafe(FIXTURES.basicMdx);

    expect(result.frontmatter).toEqual({});
  });
});
