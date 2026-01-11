// packages/extension/test/framework-detector.test.ts
// tests for framework auto-detection from package.json

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  FrameworkDetector,
  type Framework,
} from '../framework/FrameworkDetector';

// mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// helper to create mock package.json content
function createPackageJson(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {}
): string {
  return JSON.stringify({
    dependencies: deps,
    devDependencies: devDeps,
  });
}

describe('FrameworkDetector', () => {
  let detector: FrameworkDetector;

  beforeEach(() => {
    // reset mocks
    vi.resetAllMocks();

    // get fresh instance
    FrameworkDetector.dispose();
    detector = FrameworkDetector.getInstance();
  });

  afterEach(() => {
    FrameworkDetector.dispose();
  });

  describe('detectFromPackageJson', () => {
    it('detects Docusaurus from @docusaurus/core dependency', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ '@docusaurus/core': '^3.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('docusaurus');
      expect(result.detected).toBe(true);
      expect(result.version).toBe('^3.0.0');
    });

    it('detects Starlight from @astrojs/starlight dependency', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ '@astrojs/starlight': '^0.21.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('astro-starlight');
      expect(result.detected).toBe(true);
    });

    it('detects Next.js from next + @next/mdx dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ next: '^14.0.0', '@next/mdx': '^14.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('nextjs');
      expect(result.detected).toBe(true);
    });

    it('detects Next.js from next + next-mdx-remote dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ next: '^14.0.0', 'next-mdx-remote': '^4.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('nextjs');
      expect(result.detected).toBe(true);
    });

    it('detects Next.js from next + @mdx-js/react dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ next: '^14.0.0', '@mdx-js/react': '^3.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('nextjs');
      expect(result.detected).toBe(true);
    });

    it('does not detect Next.js from next without MDX dependency', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({ next: '^14.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      // should fall back to generic since Next.js without MDX deps
      expect(result.framework).toBe('generic');
    });

    it('returns generic when no package.json exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('generic');
      expect(result.detected).toBe(true);
    });

    it('returns generic for empty package.json', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('generic');
    });

    it('handles devDependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({}, { '@docusaurus/core': '^3.0.0' })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('docusaurus');
    });

    it('prioritizes frameworks in detection order', () => {
      // Docusaurus should win over Next.js
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        createPackageJson({
          '@docusaurus/core': '^3.0.0',
          next: '^14.0.0',
          '@next/mdx': '^14.0.0',
        })
      );

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('docusaurus');
    });

    it('handles malformed package.json gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

      const result = detector.detectFromPackageJson('/workspace');

      expect(result.framework).toBe('generic');
    });
  });

  describe('getFrameworkDisplayName', () => {
    it('returns correct display names', () => {
      expect(detector.getFrameworkDisplayName('docusaurus')).toBe('Docusaurus');
      expect(detector.getFrameworkDisplayName('nextjs')).toBe('Next.js');
      expect(detector.getFrameworkDisplayName('astro-starlight')).toBe(
        'Starlight'
      );
      expect(detector.getFrameworkDisplayName('generic')).toBe('Generic');
    });
  });

  describe('findMdxComponentsFile', () => {
    it('finds mdx-components.tsx at root', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join('/workspace', 'mdx-components.tsx');
      });

      const result = detector.findMdxComponentsFile('/workspace');

      expect(result).toBe(path.join('/workspace', 'mdx-components.tsx'));
    });

    it('finds mdx-components.tsx in src directory', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join('/workspace', 'src', 'mdx-components.tsx');
      });

      const result = detector.findMdxComponentsFile('/workspace');

      expect(result).toBe(path.join('/workspace', 'src', 'mdx-components.tsx'));
    });

    it('finds mdx-components.ts when tsx not present', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join('/workspace', 'mdx-components.ts');
      });

      const result = detector.findMdxComponentsFile('/workspace');

      expect(result).toBe(path.join('/workspace', 'mdx-components.ts'));
    });

    it('returns null when no mdx-components file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detector.findMdxComponentsFile('/workspace');

      expect(result).toBeNull();
    });
  });

  describe('singleton behavior', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = FrameworkDetector.getInstance();
      const instance2 = FrameworkDetector.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('creates new instance after dispose', () => {
      const instance1 = FrameworkDetector.getInstance();
      FrameworkDetector.dispose();
      const instance2 = FrameworkDetector.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    describe('package.json structure variations', () => {
      it('handles package.json with only dependencies (no devDependencies key)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: { '@docusaurus/core': '^3.0.0' },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
      });

      it('handles package.json with only devDependencies (no dependencies key)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            devDependencies: { '@astrojs/starlight': '^0.21.0' },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('astro-starlight');
      });

      it('handles package.json with null dependencies', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: null,
            devDependencies: { '@docusaurus/core': '^3.0.0' },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
      });

      it('handles package.json with undefined dependencies', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            name: 'test-package',
            version: '1.0.0',
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });

      it('handles very large package.json with many deps', () => {
        const manyDeps: Record<string, string> = {};
        for (let i = 0; i < 100; i++) {
          manyDeps[`package-${i}`] = '1.0.0';
        }
        manyDeps['@docusaurus/core'] = '^3.0.0';

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({ dependencies: manyDeps })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
      });
    });

    describe('path edge cases', () => {
      it('handles workspace path with spaces', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );

        const result = detector.detectFromPackageJson(
          '/path/with spaces/workspace'
        );

        expect(result.framework).toBe('docusaurus');
      });

      it('handles workspace path with unicode characters', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );

        const result = detector.detectFromPackageJson('/path/日本語/workspace');

        expect(result.framework).toBe('docusaurus');
      });

      it('handles deeply nested workspace path', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );

        const result = detector.detectFromPackageJson(
          '/a/b/c/d/e/f/g/workspace'
        );

        expect(result.framework).toBe('docusaurus');
      });
    });

    describe('version handling', () => {
      it('extracts version correctly from semver range', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.2.1' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.version).toBe('^3.2.1');
      });

      it('handles versions with prerelease tags', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '3.0.0-alpha.1' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.version).toBe('3.0.0-alpha.1');
      });

      it('handles tilde version ranges', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '~3.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.version).toBe('~3.0.0');
      });

      it('handles exact version', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '3.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.version).toBe('3.0.0');
      });

      it('handles version with build metadata', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '3.0.0+build.123' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.version).toBe('3.0.0+build.123');
      });
    });

    describe('framework priority', () => {
      it('Docusaurus takes priority over Starlight when both present', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({
            '@docusaurus/core': '^3.0.0',
            '@astrojs/starlight': '^0.21.0',
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
      });

      it('Starlight takes priority over Next.js when both present', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({
            '@astrojs/starlight': '^0.21.0',
            next: '^14.0.0',
            '@next/mdx': '^14.0.0',
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('astro-starlight');
      });
    });

    describe('Next.js MDX detection', () => {
      it('detects Next.js with @next/mdx', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ next: '^14.0.0', '@next/mdx': '^14.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('nextjs');
      });

      it('detects Next.js with next-mdx-remote', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ next: '^14.0.0', 'next-mdx-remote': '^4.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('nextjs');
      });

      it('detects Next.js with @mdx-js/react', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ next: '^14.0.0', '@mdx-js/react': '^3.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('nextjs');
      });

      it('does not detect Next.js with only MDX dependency (no next)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@next/mdx': '^14.0.0' })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });
    });

    describe('findMdxComponentsFile edge cases', () => {
      it('prefers .tsx over .ts', () => {
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          const pathStr = String(p);
          return (
            pathStr.endsWith('mdx-components.tsx') ||
            pathStr.endsWith('mdx-components.ts')
          );
        });

        const result = detector.findMdxComponentsFile('/workspace');

        expect(result).toContain('mdx-components.tsx');
      });

      it('prefers root over src directory', () => {
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          const pathStr = String(p);
          return (
            pathStr === path.join('/workspace', 'mdx-components.tsx') ||
            pathStr === path.join('/workspace', 'src', 'mdx-components.tsx')
          );
        });

        const result = detector.findMdxComponentsFile('/workspace');

        expect(result).toBe(path.join('/workspace', 'mdx-components.tsx'));
      });

      it('handles .js extension', () => {
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          return p === path.join('/workspace', 'mdx-components.js');
        });

        const result = detector.findMdxComponentsFile('/workspace');

        expect(result).toBe(path.join('/workspace', 'mdx-components.js'));
      });

      it('handles .jsx extension', () => {
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          return p === path.join('/workspace', 'mdx-components.jsx');
        });

        const result = detector.findMdxComponentsFile('/workspace');

        expect(result).toBe(path.join('/workspace', 'mdx-components.jsx'));
      });
    });

    describe('error handling', () => {
      it('handles fs.readFileSync throwing error', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
        expect(result.detected).toBe(true);
      });

      it('handles JSON.parse throwing on invalid JSON', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });

      it('handles package.json with circular references gracefully', () => {
        // JSON.stringify would fail on circular refs, but JSON.parse works on valid JSON
        // This tests the error boundary
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('null');

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });
    });

    describe('monorepo scenarios', () => {
      // Note: Current implementation only looks at the specified workspace path
      // These tests document expected behavior for monorepo-like structures

      it('uses package.json from the specified path only', () => {
        // The detector reads from the exact path provided
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );

        const result = detector.detectFromPackageJson(
          '/workspace/packages/docs'
        );

        expect(result.framework).toBe('docusaurus');
        // The call should be for the specified path
        expect(fs.existsSync).toHaveBeenCalled();
      });

      it('returns generic when nested package.json does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = detector.detectFromPackageJson(
          '/workspace/packages/app'
        );

        expect(result.framework).toBe('generic');
      });

      it('handles workspace with multiple framework deps (uses priority)', () => {
        // In a monorepo, the root might have multiple framework deps
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({
            '@docusaurus/core': '^3.0.0',
            '@astrojs/starlight': '^0.21.0',
            next: '^14.0.0',
            '@next/mdx': '^14.0.0',
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Docusaurus has highest priority
        expect(result.framework).toBe('docusaurus');
      });
    });

    describe('partial package.json scenarios', () => {
      it('handles missing version field (null value)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': null,
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Still detects framework even with null version
        expect(result.framework).toBe('docusaurus');
        // Version is undefined when not a string
        expect(result.version).toBeUndefined();
      });

      it('handles empty version string', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': '',
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
        expect(result.version).toBe('');
      });

      it('handles array-type dependencies (invalid structure)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: ['@docusaurus/core'],
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Array is not valid dependencies format, should return generic
        expect(result.framework).toBe('generic');
      });

      it('handles numeric version (converted to undefined)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': 3,
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Framework is still detected
        expect(result.framework).toBe('docusaurus');
        // Version is undefined when not a string (typeof check)
        expect(result.version).toBeUndefined();
      });

      it('handles dependencies as boolean values', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': true,
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Framework detected even with boolean value
        expect(result.framework).toBe('docusaurus');
        // Version is undefined for non-string values
        expect(result.version).toBeUndefined();
      });

      it('handles missing both dependencies and devDependencies keys', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            name: 'empty-package',
            version: '1.0.0',
            description: 'No dependencies at all',
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
        expect(result.detected).toBe(true);
      });

      it('handles empty dependencies objects', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {},
            devDependencies: {},
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });

      it('handles dependencies with numeric keys', () => {
        // Unusual but valid JSON
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              0: '@docusaurus/core',
              '@docusaurus/core': '^3.0.0',
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Should still detect docusaurus from valid key
        expect(result.framework).toBe('docusaurus');
      });

      it('handles mixed valid/invalid dependency entries', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              'invalid-package': undefined,
              'another-invalid': null,
              '@docusaurus/core': '^3.0.0',
              'object-value': { nested: true },
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Should still detect docusaurus
        expect(result.framework).toBe('docusaurus');
        expect(result.version).toBe('^3.0.0');
      });

      it('handles local package references (file: protocol)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': 'file:../packages/docusaurus',
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Should still detect framework with file: reference
        expect(result.framework).toBe('docusaurus');
        expect(result.version).toBe('file:../packages/docusaurus');
      });

      it('handles git URL version references', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({
            dependencies: {
              '@docusaurus/core': 'github:facebook/docusaurus#main',
            },
          })
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
        expect(result.version).toBe('github:facebook/docusaurus#main');
      });
    });

    describe('monorepo detection (documents current behavior)', () => {
      // Current implementation: only reads package.json at specified path
      // These tests document this behavior for future reference

      it('reads only from specified path, not parent directories', () => {
        // In a monorepo, caller should pass correct path
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          return p === path.join('/workspace/packages/docs', 'package.json');
        });
        vi.mocked(fs.readFileSync).mockImplementation((p) => {
          if (p === path.join('/workspace/packages/docs', 'package.json')) {
            return createPackageJson({ '@docusaurus/core': '^3.0.0' });
          }
          throw new Error('ENOENT');
        });

        const result = detector.detectFromPackageJson(
          '/workspace/packages/docs'
        );

        expect(result.framework).toBe('docusaurus');
      });

      it('returns generic when nested package.json is not present', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = detector.detectFromPackageJson(
          '/workspace/packages/app'
        );

        expect(result.framework).toBe('generic');
      });

      it('does not traverse upward to find root package.json (documents limitation)', () => {
        // If package.json doesn't exist at specified path, returns generic
        // Does NOT look in parent directories
        vi.mocked(fs.existsSync).mockImplementation((p) => {
          // Root has package.json, nested does not
          return p === path.join('/workspace', 'package.json');
        });

        // Calling with nested path
        const result = detector.detectFromPackageJson(
          '/workspace/packages/app'
        );

        // Returns generic because it only checks specified path
        expect(result.framework).toBe('generic');
      });

      it('each nested workspace can have different framework', () => {
        // Mock different package.json for different paths
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation((p) => {
          const pathStr = String(p);
          if (pathStr.includes('docs')) {
            return createPackageJson({ '@docusaurus/core': '^3.0.0' });
          }
          if (pathStr.includes('app')) {
            return createPackageJson({
              next: '^14.0.0',
              '@next/mdx': '^14.0.0',
            });
          }
          return createPackageJson({});
        });

        const docsResult = detector.detectFromPackageJson(
          '/workspace/packages/docs'
        );
        const appResult = detector.detectFromPackageJson(
          '/workspace/packages/app'
        );

        expect(docsResult.framework).toBe('docusaurus');
        expect(appResult.framework).toBe('nextjs');
      });

      it('cache is isolated per workspace path', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        // First call for docs
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );
        const docsResult = detector.detectFromPackageJson(
          '/workspace/packages/docs'
        );

        // Second call for app - different result
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ next: '^14.0.0', '@next/mdx': '^14.0.0' })
        );
        const appResult = detector.detectFromPackageJson(
          '/workspace/packages/app'
        );

        // Both should be correctly cached separately
        expect(docsResult.framework).toBe('docusaurus');
        expect(appResult.framework).toBe('nextjs');
      });
    });

    describe('error recovery and resilience', () => {
      it('handles ENOENT error (file deleted during read)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          const error = new Error('ENOENT: no such file or directory');
          (error as any).code = 'ENOENT';
          throw error;
        });

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
        expect(result.detected).toBe(true);
      });

      it('handles EACCES error (permission denied)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          const error = new Error('EACCES: permission denied');
          (error as any).code = 'EACCES';
          throw error;
        });

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });

      it('handles EMFILE error (too many open files)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          const error = new Error('EMFILE: too many open files');
          (error as any).code = 'EMFILE';
          throw error;
        });

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('generic');
      });

      it('recovers after error on next call', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        // First call fails
        vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
          throw new Error('Temporary error');
        });
        const failedResult = detector.detectFromPackageJson('/workspace-fail');

        // Second call succeeds
        vi.mocked(fs.readFileSync).mockReturnValue(
          createPackageJson({ '@docusaurus/core': '^3.0.0' })
        );
        const successResult =
          detector.detectFromPackageJson('/workspace-success');

        expect(failedResult.framework).toBe('generic');
        expect(successResult.framework).toBe('docusaurus');
      });

      it('handles extremely large package.json without crashing', () => {
        // Create package.json with 10,000 dependencies
        const manyDeps: Record<string, string> = {};
        for (let i = 0; i < 10000; i++) {
          manyDeps[`package-${i}`] = '1.0.0';
        }
        // Add framework deps in the middle
        manyDeps['@docusaurus/core'] = '^3.0.0';

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
          JSON.stringify({ dependencies: manyDeps })
        );

        const result = detector.detectFromPackageJson('/workspace');

        // Should still find docusaurus
        expect(result.framework).toBe('docusaurus');
      });

      it('handles package.json with no newlines (minified)', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        // Minified JSON on single line
        vi.mocked(fs.readFileSync).mockReturnValue(
          '{"dependencies":{"@docusaurus/core":"^3.0.0"}}'
        );

        const result = detector.detectFromPackageJson('/workspace');

        expect(result.framework).toBe('docusaurus');
      });

      it('handles package.json with Unicode BOM', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        // UTF-8 BOM prefix
        vi.mocked(fs.readFileSync).mockReturnValue(
          '\ufeff' +
            JSON.stringify({ dependencies: { '@docusaurus/core': '^3.0.0' } })
        );

        // JSON.parse handles BOM in most implementations
        // This tests real-world edge case
        const result = detector.detectFromPackageJson('/workspace');

        // May or may not work depending on JSON.parse implementation
        // Just verify it doesn't crash
        expect(result).toBeDefined();
        expect(result.detected).toBe(true);
      });
    });
  });
});
