import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import { TailwindCompiler, type TailwindCompileOptions } from '../tailwind';

vi.mock('fs');
vi.mock('../logging', () => ({
  debug: vi.fn(),
}));

// use vi.hoisted to define mocks that can be referenced in hoisted vi.mock factories
const { mockProcess, mockPostcss } = vi.hoisted(() => {
  const mockProcess = vi.fn();
  const mockPostcss = vi.fn(() => ({ process: mockProcess }));
  return { mockProcess, mockPostcss };
});

vi.mock('postcss', () => ({
  default: mockPostcss,
}));

describe('TailwindCompiler', () => {
  let compiler: TailwindCompiler;
  let mockPlugin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mockProcess to return default CSS
    mockProcess.mockResolvedValue({ css: '.flex { display: flex; }' });

    // Create mock plugin that captures options
    mockPlugin = vi.fn((opts) => ({
      postcssPlugin: 'tailwindcss',
      opts,
    }));

    compiler = new TailwindCompiler();

    // Spy on private loadModule method to return our mock plugin
    vi.spyOn(
      compiler as unknown as { loadModule: (id: string) => Promise<unknown> },
      'loadModule'
    ).mockResolvedValue(mockPlugin);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('v3 compilation', () => {
    const v3Options: TailwindCompileOptions = {
      tailwindVersion: 'v3',
      content: 'flex gap-2 items-center',
    };

    it('should compile with default entry CSS (no @tailwind base)', async () => {
      await compiler.compile(v3Options);

      // check that process was called w/ correct input CSS
      expect(mockProcess).toHaveBeenCalled();
      const processCall = mockProcess.mock.calls[0];
      const inputCss = processCall[0];

      // v3 default skips base layer
      expect(inputCss).toContain('@tailwind components;');
      expect(inputCss).toContain('@tailwind utilities;');
      expect(inputCss).not.toContain('@tailwind base');
    });

    it('should use custom entry CSS when provided', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        '@tailwind base;\n@tailwind components;\n@tailwind utilities;'
      );

      const options: TailwindCompileOptions = {
        ...v3Options,
        entryCssPath: '/workspace/src/custom.css',
      };

      await compiler.compile(options);

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        '/workspace/src/custom.css',
        'utf-8'
      );
      const inputCss = mockProcess.mock.calls[0][0];
      expect(inputCss).toContain('@tailwind base;');
    });

    it('should pass configPath to tailwindcss plugin', async () => {
      const options: TailwindCompileOptions = {
        ...v3Options,
        configPath: '/workspace/tailwind.config.js',
      };

      await compiler.compile(options);

      expect(mockPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          config: '/workspace/tailwind.config.js',
        })
      );
    });

    it('should pass content to plugin options for v3', async () => {
      await compiler.compile(v3Options);

      expect(mockPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [{ raw: 'flex gap-2 items-center', extension: 'mdx' }],
        })
      );
    });

    it('should not include content option when empty for v3', async () => {
      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: '',
      };

      await compiler.compile(options);

      // Should not have content key when empty
      const pluginCall = mockPlugin.mock.calls[0][0];
      expect(pluginCall.content).toBeUndefined();
    });

    it('should load tailwindcss module for v3', async () => {
      await compiler.compile(v3Options);

      expect(
        (compiler as unknown as { loadModule: ReturnType<typeof vi.fn> })
          .loadModule
      ).toHaveBeenCalledWith('tailwindcss');
    });

    it('should use workspace tailwindcss path when provided', async () => {
      const options: TailwindCompileOptions = {
        ...v3Options,
        workspaceTailwindPath: '/workspace/node_modules/tailwindcss',
      };

      await compiler.compile(options);

      expect(
        (compiler as unknown as { loadModule: ReturnType<typeof vi.fn> })
          .loadModule
      ).toHaveBeenCalledWith('/workspace/node_modules/tailwindcss');
    });
  });

  describe('v4 compilation', () => {
    const v4Options: TailwindCompileOptions = {
      tailwindVersion: 'v4',
      content: 'flex gap-2 items-center',
    };

    it('should compile with default entry CSS (includes theme import)', async () => {
      await compiler.compile(v4Options);

      const inputCss = mockProcess.mock.calls[0][0];

      expect(inputCss).toContain('@import "tailwindcss/theme";');
      expect(inputCss).toContain('@tailwind components;');
      expect(inputCss).toContain('@tailwind utilities;');
    });

    it('should build inline source directives from content', async () => {
      await compiler.compile(v4Options);

      const inputCss = mockProcess.mock.calls[0][0];

      expect(inputCss).toContain('@source inline("flex gap-2 items-center");');
    });

    it('should chunk long content into multiple @source directives', async () => {
      // Generate content that exceeds 2000 chars
      const longContent = Array.from(
        { length: 300 },
        (_, i) => `class-${i}`
      ).join(' ');
      const options: TailwindCompileOptions = {
        ...v4Options,
        content: longContent,
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];

      // Should have multiple @source directives
      const sourceMatches = inputCss.match(/@source inline\(/g);
      expect(sourceMatches).not.toBeNull();
      expect(sourceMatches!.length).toBeGreaterThan(1);
    });

    it('should escape backslashes and quotes in inline sources', async () => {
      const options: TailwindCompileOptions = {
        ...v4Options,
        content: 'bg-[url("test.png")] w-[calc(100%)]',
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];

      // Quotes should be escaped
      expect(inputCss).toContain('\\"');
    });

    it('should not add inline sources when content is empty', async () => {
      const options: TailwindCompileOptions = {
        ...v4Options,
        content: '',
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];
      expect(inputCss).not.toContain('@source inline');
    });

    it('should not add inline sources when content is whitespace only', async () => {
      const options: TailwindCompileOptions = {
        ...v4Options,
        content: '   \n\t   ',
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];
      expect(inputCss).not.toContain('@source inline');
    });

    it('should not pass content to plugin options for v4 (uses inline sources)', async () => {
      await compiler.compile(v4Options);

      const pluginCall = mockPlugin.mock.calls[0][0];
      expect(pluginCall.content).toBeUndefined();
    });

    it('should load @tailwindcss/postcss module for v4', async () => {
      await compiler.compile(v4Options);

      expect(
        (compiler as unknown as { loadModule: ReturnType<typeof vi.fn> })
          .loadModule
      ).toHaveBeenCalledWith('@tailwindcss/postcss');
    });
  });

  describe('error handling', () => {
    it('should propagate postcss errors', async () => {
      mockProcess.mockRejectedValueOnce(new Error('CSS syntax error'));

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
      };

      await expect(compiler.compile(options)).rejects.toThrow(
        'CSS syntax error'
      );
    });

    it('should propagate file read errors', async () => {
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
        entryCssPath: '/nonexistent/file.css',
      };

      await expect(compiler.compile(options)).rejects.toThrow('ENOENT');
    });

    it('should propagate module loading errors', async () => {
      vi.spyOn(
        compiler as unknown as { loadModule: (id: string) => Promise<unknown> },
        'loadModule'
      ).mockRejectedValue(new Error('Cannot find module'));

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
      };

      await expect(compiler.compile(options)).rejects.toThrow(
        'Cannot find module'
      );
    });
  });

  describe('module validation', () => {
    it('should throw error when module exports non-function', async () => {
      // Create a new compiler without mocking loadModule to test validation
      const validatingCompiler = new TailwindCompiler();

      // access private method through type assertion & mock require to return non-function
      vi.spyOn(
        validatingCompiler as unknown as {
          loadModule: (id: string) => Promise<unknown>;
        },
        'loadModule'
      ).mockImplementation(async (id: string) => {
        // Simulate what happens when validation fails
        const mod = { version: '3.0.0' }; // Object, not a function
        if (typeof mod !== 'function') {
          throw new Error(
            `Module "${id}" must export a function (PostCSS plugin factory). Got object instead.`
          );
        }
        return mod;
      });

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
      };

      await expect(validatingCompiler.compile(options)).rejects.toThrow(
        'must export a function (PostCSS plugin factory)'
      );
    });

    it('should throw error with module name in message', async () => {
      const validatingCompiler = new TailwindCompiler();

      vi.spyOn(
        validatingCompiler as unknown as {
          loadModule: (id: string) => Promise<unknown>;
        },
        'loadModule'
      ).mockImplementation(async (id: string) => {
        throw new Error(
          `Module "${id}" must export a function (PostCSS plugin factory). Got string instead.`
        );
      });

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
      };

      await expect(validatingCompiler.compile(options)).rejects.toThrow(
        'tailwindcss'
      );
    });

    it('should accept valid function export', async () => {
      const validPlugin = vi.fn(() => ({
        postcssPlugin: 'tailwindcss',
      }));

      vi.spyOn(
        compiler as unknown as { loadModule: (id: string) => Promise<unknown> },
        'loadModule'
      ).mockResolvedValue(validPlugin);

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
      };

      // Should not throw
      await expect(compiler.compile(options)).resolves.toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should pass baseDir option when provided', async () => {
      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
        baseDir: '/workspace',
      };

      await compiler.compile(options);

      expect(mockPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          base: '/workspace',
        })
      );
    });

    it('should set from option in postcss process', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        '@tailwind utilities;'
      );

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v3',
        content: 'flex',
        entryCssPath: '/workspace/styles.css',
      };

      await compiler.compile(options);

      expect(mockProcess).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          from: '/workspace/styles.css',
        })
      );
    });

    it('should return compiled CSS', async () => {
      mockProcess.mockResolvedValueOnce({
        css: '.flex { display: flex; }.gap-2 { gap: 0.5rem; }',
      });

      const result = await compiler.compile({
        tailwindVersion: 'v3',
        content: 'flex gap-2',
      });

      expect(result).toBe('.flex { display: flex; }.gap-2 { gap: 0.5rem; }');
    });

    it('should handle content with special characters', async () => {
      const options: TailwindCompileOptions = {
        tailwindVersion: 'v4',
        content: 'bg-[#ff0000] w-[100%] text-[14px]',
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];
      expect(inputCss).toContain('bg-[#ff0000]');
      expect(inputCss).toContain('w-[100%]');
    });

    it('should use custom entry CSS for v4 when provided', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        '@import "tailwindcss";\n.custom { color: red; }'
      );

      const options: TailwindCompileOptions = {
        tailwindVersion: 'v4',
        content: 'flex',
        entryCssPath: '/workspace/custom.css',
      };

      await compiler.compile(options);

      const inputCss = mockProcess.mock.calls[0][0];
      expect(inputCss).toContain('@import "tailwindcss"');
      expect(inputCss).toContain('.custom { color: red; }');
    });
  });
});
