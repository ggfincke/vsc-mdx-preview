// packages/webview-app/src/test/module-loader.test.ts
// tests for module loader resolution & require functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock rpc-webview before importing module-loader (it imports rpc-webview)
vi.mock('../rpc-webview', () => ({
  ExtensionHandle: {
    fetch: vi.fn(),
  },
  registerWebviewHandlers: vi.fn(),
}));

import { registry } from '../module-loader/ModuleRegistry';
import { loadModule } from '../module-loader/index';
import type { FetchResult } from '../module-loader/types';

describe('ModuleRegistry', () => {
  beforeEach(() => {
    registry.clear();
  });

  describe('resolution map', () => {
    it('stores and retrieves resolution mappings', () => {
      const parentId = '/path/to/README.mdx';
      const request = './src/my-component';
      const fsPath = '/path/to/src/my-component.js';

      registry.setResolution(parentId, request, fsPath);

      expect(registry.getResolution(parentId, request)).toBe(fsPath);
    });

    it('returns undefined for unknown resolutions', () => {
      expect(registry.getResolution('/parent', './unknown')).toBeUndefined();
    });

    it('handles same request from different parents', () => {
      const parent1 = '/dir1/file.mdx';
      const parent2 = '/dir2/file.mdx';
      const request = './utils';
      const fsPath1 = '/dir1/utils.js';
      const fsPath2 = '/dir2/utils.js';

      registry.setResolution(parent1, request, fsPath1);
      registry.setResolution(parent2, request, fsPath2);

      expect(registry.getResolution(parent1, request)).toBe(fsPath1);
      expect(registry.getResolution(parent2, request)).toBe(fsPath2);
    });

    it('clears resolutions on clearNonPreloaded', () => {
      registry.setResolution('/parent', './dep', '/dep.js');
      registry.clearNonPreloaded([]);

      expect(registry.getResolution('/parent', './dep')).toBeUndefined();
    });

    it('clears resolutions on clear', () => {
      registry.setResolution('/parent', './dep', '/dep.js');
      registry.clear();

      expect(registry.getResolution('/parent', './dep')).toBeUndefined();
    });
  });
});

describe('loadModule', () => {
  beforeEach(() => {
    registry.clear();
  });

  it('resolves relative imports via resolution map', async () => {
    const entryPath = '/project/README.mdx';
    const componentPath = '/project/src/my-component.js';

    // mock fetcher returns the resolved path
    const mockFetcher = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        _parentId: string
      ): Promise<FetchResult | undefined> => {
        if (request === './src/my-component') {
          return {
            fsPath: componentPath,
            code: `
              const React = require('react');
              module.exports.default = function MyComponent() {
                return null;
              };
            `,
            dependencies: ['react'],
          };
        }
        return undefined;
      }
    );

    // preload react for the test
    registry.preload('react', { createElement: vi.fn() });

    // entry module code that requires the component
    const entryCode = `
      const MyComponent = require('./src/my-component').default;
      module.exports.default = function MDXContent() {
        return MyComponent();
      };
    `;

    const module = await loadModule(
      entryPath,
      entryCode,
      ['./src/my-component'],
      mockFetcher
    );

    // verify the module loaded successfully
    expect(module).toBeDefined();
    expect(module.exports.default).toBeInstanceOf(Function);

    // verify the resolution was registered
    expect(registry.getResolution(entryPath, './src/my-component')).toBe(
      componentPath
    );

    // verify the fetcher was called correctly
    expect(mockFetcher).toHaveBeenCalledWith(
      './src/my-component',
      false,
      entryPath
    );
  });

  it('handles nested relative imports', async () => {
    const entryPath = '/project/docs/README.mdx';
    const componentPath = '/project/docs/components/Button.js';
    const utilsPath = '/project/docs/components/utils.js';

    const mockFetcher = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        parentId: string
      ): Promise<FetchResult | undefined> => {
        if (request === './components/Button' && parentId === entryPath) {
          return {
            fsPath: componentPath,
            code: `
              const utils = require('./utils');
              module.exports.default = function Button() {
                return utils.format('button');
              };
            `,
            dependencies: ['./utils'],
          };
        }
        if (request === './utils' && parentId === componentPath) {
          return {
            fsPath: utilsPath,
            code: `
              module.exports.format = function(s) { return s.toUpperCase(); };
            `,
            dependencies: [],
          };
        }
        return undefined;
      }
    );

    const entryCode = `
      const Button = require('./components/Button').default;
      module.exports.default = function MDXContent() {
        return Button();
      };
    `;

    const module = await loadModule(
      entryPath,
      entryCode,
      ['./components/Button'],
      mockFetcher
    );

    expect(module).toBeDefined();
    expect(module.exports.default).toBeInstanceOf(Function);

    // verify both resolutions were registered
    expect(registry.getResolution(entryPath, './components/Button')).toBe(
      componentPath
    );
    expect(registry.getResolution(componentPath, './utils')).toBe(utilsPath);
  });

  it('handles CSS imports', async () => {
    const entryPath = '/project/README.mdx';
    const cssPath = '/project/styles.css';

    const mockFetcher = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        _parentId: string
      ): Promise<FetchResult | undefined> => {
        if (request === './styles.css') {
          return {
            fsPath: cssPath,
            code: '',
            css: '.button { color: red; }',
            dependencies: [],
          };
        }
        return undefined;
      }
    );

    const entryCode = `
      require('./styles.css');
      module.exports.default = function MDXContent() {
        return null;
      };
    `;

    const module = await loadModule(
      entryPath,
      entryCode,
      ['./styles.css'],
      mockFetcher
    );

    expect(module).toBeDefined();
    // CSS module should be in cache
    expect(registry.has(cssPath)).toBe(true);
    // resolution should be registered
    expect(registry.getResolution(entryPath, './styles.css')).toBe(cssPath);
  });
});
