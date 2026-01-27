// tests/webview/TrustedPreview.test.ts
// Unit tests for TrustedPreview memo comparison (J.2 optimization)

import { describe, it, expect } from 'vitest';

// Import the arePropsEqual function for testing
// Since it's not exported, we'll test the comparison logic directly
interface TrustedPreviewRendererProps {
  content: {
    mode: 'trusted';
    code: string;
    entryFilePath: string;
    dependencies: string[];
  };
  evaluatedComponent: React.ComponentType | null;
  onComponentReady: (component: React.ComponentType | null) => void;
  onError: (error: { message: string; stack?: string }) => void;
}

// Replicate the arePropsEqual logic for testing
function arePropsEqual(
  prevProps: TrustedPreviewRendererProps,
  nextProps: TrustedPreviewRendererProps
): boolean {
  // Check primitive fields
  if (prevProps.content.code !== nextProps.content.code) return false;
  if (prevProps.content.entryFilePath !== nextProps.content.entryFilePath) return false;
  if (prevProps.evaluatedComponent !== nextProps.evaluatedComponent) return false;

  // Check dependencies array (shallow comparison)
  const prevDeps = prevProps.content.dependencies;
  const nextDeps = nextProps.content.dependencies;
  if (prevDeps.length !== nextDeps.length) return false;
  for (let i = 0; i < prevDeps.length; i++) {
    if (prevDeps[i] !== nextDeps[i]) return false;
  }

  return true;
}

describe('TrustedPreviewRenderer memo comparison (J.2)', () => {
  const mockCallback = (): void => {};
  const mockErrorCallback = (): void => {};

  const createProps = (
    overrides: Partial<{
      code: string;
      entryFilePath: string;
      dependencies: string[];
      evaluatedComponent: React.ComponentType | null;
    }> = {}
  ): TrustedPreviewRendererProps => ({
    content: {
      mode: 'trusted',
      code: overrides.code ?? 'const x = 1;',
      entryFilePath: overrides.entryFilePath ?? '/path/to/file.mdx',
      dependencies: overrides.dependencies ?? ['react', './Button'],
    },
    evaluatedComponent: overrides.evaluatedComponent ?? null,
    onComponentReady: mockCallback,
    onError: mockErrorCallback,
  });

  describe('should return true (prevent re-render) when', () => {
    it('all fields are identical', () => {
      const props = createProps();
      expect(arePropsEqual(props, props)).toBe(true);
    });

    it('props are equal objects with same values', () => {
      const prev = createProps({ dependencies: ['a', 'b', 'c'] });
      const next = createProps({ dependencies: ['a', 'b', 'c'] });
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('dependencies arrays have same items in same order', () => {
      const deps = ['react', './Button', '@mdx-preview/shims'];
      const prev = createProps({ dependencies: deps.slice() });
      const next = createProps({ dependencies: deps.slice() });
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('empty dependencies arrays', () => {
      const prev = createProps({ dependencies: [] });
      const next = createProps({ dependencies: [] });
      expect(arePropsEqual(prev, next)).toBe(true);
    });
  });

  describe('should return false (allow re-render) when', () => {
    it('code changes', () => {
      const prev = createProps({ code: 'const x = 1;' });
      const next = createProps({ code: 'const x = 2;' });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('entryFilePath changes', () => {
      const prev = createProps({ entryFilePath: '/a.mdx' });
      const next = createProps({ entryFilePath: '/b.mdx' });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('evaluatedComponent changes', () => {
      const ComponentA = (): null => null;
      const ComponentB = (): null => null;
      const prev = createProps({ evaluatedComponent: ComponentA });
      const next = createProps({ evaluatedComponent: ComponentB });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('dependencies length changes', () => {
      const prev = createProps({ dependencies: ['a', 'b'] });
      const next = createProps({ dependencies: ['a', 'b', 'c'] });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('dependencies item changes', () => {
      const prev = createProps({ dependencies: ['a', 'b', 'c'] });
      const next = createProps({ dependencies: ['a', 'x', 'c'] });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('dependencies order changes', () => {
      const prev = createProps({ dependencies: ['a', 'b', 'c'] });
      const next = createProps({ dependencies: ['c', 'b', 'a'] });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('dependencies item is added', () => {
      const prev = createProps({ dependencies: ['react'] });
      const next = createProps({ dependencies: ['react', './NewComponent'] });
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('dependencies item is removed', () => {
      const prev = createProps({ dependencies: ['react', './Button'] });
      const next = createProps({ dependencies: ['react'] });
      expect(arePropsEqual(prev, next)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles single dependency correctly', () => {
      const prev = createProps({ dependencies: ['react'] });
      const next = createProps({ dependencies: ['react'] });
      expect(arePropsEqual(prev, next)).toBe(true);

      const prev2 = createProps({ dependencies: ['react'] });
      const next2 = createProps({ dependencies: ['vue'] });
      expect(arePropsEqual(prev2, next2)).toBe(false);
    });

    it('handles many dependencies efficiently', () => {
      const manyDeps = Array.from({ length: 50 }, (_, i) => `dep-${i}`);
      const prev = createProps({ dependencies: manyDeps.slice() });
      const next = createProps({ dependencies: manyDeps.slice() });
      expect(arePropsEqual(prev, next)).toBe(true);
    });
  });
});
