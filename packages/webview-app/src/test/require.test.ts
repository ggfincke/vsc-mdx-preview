// packages/webview-app/src/test/require.test.ts
// unit tests for createSyncRequire (module resolution order, alias lookup, errors)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock rpc-webview before importing module-loader (it imports rpc-webview)
vi.mock('../rpc-webview', () => ({
  ExtensionHandle: {
    fetch: vi.fn(),
  },
  registerWebviewHandlers: vi.fn(),
}));

import { registry } from '../module-loader/ModuleRegistry';
import { createSyncRequire } from '../module-loader/require';

describe('createSyncRequire', () => {
  beforeEach(() => {
    registry.clear();
  });

  describe('direct cache hit', () => {
    it('returns exports from directly cached module', () => {
      const exports = { default: () => 'hello', named: 42 };
      registry.set('/path/to/module.js', {
        id: '/path/to/module.js',
        exports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      const result = require('/path/to/module.js');

      expect(result).toBe(exports);
    });

    it('returns cached module regardless of parent', () => {
      const exports = { value: 'shared' };
      registry.set('shared-module', {
        id: 'shared-module',
        exports,
        loaded: true,
      });

      const require1 = createSyncRequire('/parent1.js');
      const require2 = createSyncRequire('/parent2.js');

      expect(require1('shared-module')).toBe(exports);
      expect(require2('shared-module')).toBe(exports);
    });
  });

  describe('resolution map lookup', () => {
    it('resolves relative imports via resolution map', () => {
      const exports = { Component: () => null };
      const fsPath = '/resolved/component.js';

      registry.set(fsPath, {
        id: fsPath,
        exports,
        loaded: true,
      });
      registry.setResolution('/parent/file.js', './component', fsPath);

      const require = createSyncRequire('/parent/file.js');
      const result = require('./component');

      expect(result).toBe(exports);
    });

    it('uses parent-specific resolution', () => {
      // Same request resolves differently from different parents
      const exports1 = { version: 1 };
      const exports2 = { version: 2 };

      registry.set('/dir1/utils.js', {
        id: '/dir1/utils.js',
        exports: exports1,
        loaded: true,
      });
      registry.set('/dir2/utils.js', {
        id: '/dir2/utils.js',
        exports: exports2,
        loaded: true,
      });

      registry.setResolution('/dir1/file.js', './utils', '/dir1/utils.js');
      registry.setResolution('/dir2/file.js', './utils', '/dir2/utils.js');

      const require1 = createSyncRequire('/dir1/file.js');
      const require2 = createSyncRequire('/dir2/file.js');

      expect(require1('./utils')).toBe(exports1);
      expect(require2('./utils')).toBe(exports2);
    });

    it('prefers direct cache over resolution map', () => {
      const directExports = { source: 'direct' };
      const resolvedExports = { source: 'resolved' };

      // cache directly w/ request string
      registry.set('./module', {
        id: './module',
        exports: directExports,
        loaded: true,
      });

      // Also set up resolution mapping
      registry.set('/resolved/module.js', {
        id: '/resolved/module.js',
        exports: resolvedExports,
        loaded: true,
      });
      registry.setResolution('/parent.js', './module', '/resolved/module.js');

      const require = createSyncRequire('/parent.js');
      // Direct cache should win
      expect(require('./module')).toBe(directExports);
    });
  });

  describe('alias lookup', () => {
    it('resolves react alias', () => {
      const reactExports = { createElement: () => null, useState: () => null };
      registry.preload('react', reactExports);

      const require = createSyncRequire('/any/parent.js');
      const result = require('react');

      expect(result).toBe(reactExports);
    });

    it('resolves react-dom alias', () => {
      const reactDomExports = { render: () => null };
      registry.preload('react-dom', reactDomExports);

      const require = createSyncRequire('/any/parent.js');
      const result = require('react-dom');

      expect(result).toBe(reactDomExports);
    });

    it('resolves react/jsx-runtime alias', () => {
      const jsxRuntimeExports = { jsx: () => null, jsxs: () => null };
      registry.preload('react/jsx-runtime', jsxRuntimeExports);

      const require = createSyncRequire('/any/parent.js');
      const result = require('react/jsx-runtime');

      expect(result).toBe(jsxRuntimeExports);
    });

    it('resolves styled-components alias', () => {
      const styledExports = { default: () => null, css: () => null };
      registry.preload('styled-components', styledExports);

      const require = createSyncRequire('/any/parent.js');
      const result = require('styled-components');

      expect(result).toBe(styledExports);
    });
  });

  describe('npm:// prefixed fallback', () => {
    it('resolves npm:// prefixed modules', () => {
      const lodashExports = { get: () => null, set: () => null };
      registry.set('npm://lodash@latest', {
        id: 'npm://lodash@latest',
        exports: lodashExports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      const result = require('lodash');

      expect(result).toBe(lodashExports);
    });

    it('prefers alias over npm:// fallback', () => {
      const aliasExports = { source: 'alias' };
      const npmExports = { source: 'npm' };

      registry.preload('react', aliasExports);
      registry.set('npm://react@latest', {
        id: 'npm://react@latest',
        exports: npmExports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      // Alias should win over npm:// fallback
      expect(require('react')).toBe(aliasExports);
    });
  });

  describe('error handling', () => {
    it('throws error for unknown module', () => {
      const require = createSyncRequire('/parent.js');

      expect(() => require('unknown-module')).toThrow(
        /Module not found: "unknown-module"/
      );
    });

    it('error message includes parent module ID', () => {
      const require = createSyncRequire('/path/to/MyComponent.tsx');

      expect(() => require('missing-dep')).toThrow(
        /required by "\/path\/to\/MyComponent.tsx"/
      );
    });

    it('error message suggests fetching dependencies', () => {
      const require = createSyncRequire('/parent.js');

      expect(() => require('unfetched')).toThrow(
        /Make sure all dependencies are fetched before evaluation/
      );
    });

    it('throws for unresolved relative import', () => {
      const require = createSyncRequire('/parent.js');

      expect(() => require('./unresolved')).toThrow(
        /Module not found: ".\/unresolved"/
      );
    });
  });

  describe('resolution order', () => {
    it('direct cache hit has highest priority', () => {
      const directExports = { source: 'direct' };
      const resolvedExports = { source: 'resolved' };

      // set up both direct cache & resolution map
      registry.set('my-module', {
        id: 'my-module',
        exports: directExports,
        loaded: true,
      });
      registry.set('/resolved/my-module.js', {
        id: '/resolved/my-module.js',
        exports: resolvedExports,
        loaded: true,
      });
      registry.setResolution(
        '/parent.js',
        'my-module',
        '/resolved/my-module.js'
      );

      const require = createSyncRequire('/parent.js');
      // Direct cache should win
      expect(require('my-module')).toBe(directExports);
    });

    it('resolution map is used when no direct cache hit', () => {
      const resolvedExports = { source: 'resolved' };
      const npmExports = { source: 'npm' };

      // set up resolution map & npm:// fallback (no direct cache)
      registry.set('/resolved/module.js', {
        id: '/resolved/module.js',
        exports: resolvedExports,
        loaded: true,
      });
      registry.setResolution(
        '/parent.js',
        'module-name',
        '/resolved/module.js'
      );
      registry.set('npm://module-name@latest', {
        id: 'npm://module-name@latest',
        exports: npmExports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      // Resolution map should win over npm:// fallback
      expect(require('module-name')).toBe(resolvedExports);
    });

    it('npm:// fallback is used when no other resolution applies', () => {
      const npmExports = { source: 'npm' };

      registry.set('npm://some-pkg@latest', {
        id: 'npm://some-pkg@latest',
        exports: npmExports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      expect(require('some-pkg')).toBe(npmExports);
    });

    it('alias takes priority over npm:// fallback (uses react as real example)', () => {
      // React is a real alias: 'react' -> 'npm://react@18'
      const react18Exports = { source: 'react@18' };
      const reactLatestExports = { source: 'react@latest' };

      // Register the aliased canonical ID
      registry.set('npm://react@18', {
        id: 'npm://react@18',
        exports: react18Exports,
        loaded: true,
      });
      // Also register npm://react@latest (the fallback)
      registry.set('npm://react@latest', {
        id: 'npm://react@latest',
        exports: reactLatestExports,
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      // Alias should resolve to npm://react@18, not npm://react@latest
      expect(require('react')).toBe(react18Exports);
    });
  });

  describe('edge cases', () => {
    it('handles empty exports object', () => {
      registry.set('/empty.js', {
        id: '/empty.js',
        exports: {},
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      expect(require('/empty.js')).toEqual({});
    });

    it('handles null/undefined in exports', () => {
      registry.set('/nullable.js', {
        id: '/nullable.js',
        exports: { value: null, other: undefined },
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      const result = require('/nullable.js');
      expect(result).toEqual({ value: null, other: undefined });
    });

    it('handles exports with functions', () => {
      const fn = () => 'result';
      registry.set('/fn.js', {
        id: '/fn.js',
        exports: { default: fn },
        loaded: true,
      });

      const require = createSyncRequire('/parent.js');
      const result = require('/fn.js');
      expect(result.default).toBe(fn);
      expect(result.default()).toBe('result');
    });
  });
});
