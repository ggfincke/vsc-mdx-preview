import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import {
  TailwindScanner,
  type TailwindScanOptions,
  type TailwindScanResult,
} from '../tailwind';

// mock UnifiedResolver for dependency resolution tests
const mockResolveAsync = vi.fn();
const mockShouldResolve = vi.fn();
const mockIsRelativeImport = vi.fn();

vi.mock('../module-fetcher/UnifiedResolver', () => ({
  getUnifiedResolver: () => ({
    resolveAsync: mockResolveAsync,
    shouldResolve: mockShouldResolve,
    isRelativeImport: mockIsRelativeImport,
  }),
}));

vi.mock('fs');
vi.mock('../logging', () => ({
  debug: vi.fn(),
}));

describe('TailwindScanner', () => {
  let scanner: TailwindScanner;
  const defaultOptions: TailwindScanOptions = {
    includeDependencies: false,
  };

  // helper to configure resolver mocks for dependency tests
  function mockResolverForRelativeImports(
    importToPath: Record<string, string | null>
  ) {
    mockShouldResolve.mockImplementation((s: string) => {
      return s && !s.startsWith('http') && !s.startsWith('npm://');
    });
    mockIsRelativeImport.mockImplementation((s: string) => {
      return s?.startsWith('./') || s?.startsWith('../');
    });
    mockResolveAsync.mockImplementation(async (specifier: string) => {
      const fsPath = importToPath[specifier];
      if (fsPath) {
        return { fsPath, isBuiltInShim: false, specifier };
      }
      return null;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new TailwindScanner();

    // default resolver mock behavior
    mockShouldResolve.mockImplementation((s: string) => {
      return s && !s.startsWith('http') && !s.startsWith('npm://');
    });
    mockIsRelativeImport.mockImplementation((s: string) => {
      return s?.startsWith('./') || s?.startsWith('../');
    });
    mockResolveAsync.mockResolvedValue(null);
  });

  describe('basic className extraction', () => {
    it('should extract classes from className with double quotes', async () => {
      const text = '<div className="flex gap-2 items-center"></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });

    it('should extract classes from className with single quotes', async () => {
      const text = "<div className='px-4 py-2'></div>";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('px-4');
      expect(result.classList).toContain('py-2');
    });

    it('should extract classes from class attribute (without Name)', async () => {
      const text = '<div class="mt-4 mb-2"></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('mt-4');
      expect(result.classList).toContain('mb-2');
    });

    it('should handle multi-line className attributes', async () => {
      const text = `<div className="flex
        gap-2
        items-center"></div>`;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });

    it('should deduplicate class names', async () => {
      const text = `
        <div className="flex gap-2"></div>
        <div className="flex gap-4"></div>
      `;
      const result = await scanner.scan(text, defaultOptions);
      const flexCount = result.classList.filter((c) => c === 'flex').length;
      expect(flexCount).toBe(1);
    });
  });

  describe('dynamic expression extraction', () => {
    it('should extract from string literals in expressions', async () => {
      const text = '<div className={"flex gap-2"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
    });

    it('should extract from single-quoted strings in expressions', async () => {
      const text = "<div className={'px-4 py-2'}></div>";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('px-4');
      expect(result.classList).toContain('py-2');
    });

    it('should extract from template literals', async () => {
      const text = '<div className={`flex gap-2`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
    });

    it('should extract static parts AND interpolated strings from template literals', async () => {
      // enhanced: now extracts both static parts & string literals inside ${}
      const text =
        '<div className={`flex ${active ? "bg-blue" : "bg-gray"} gap-2`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // static parts before & after interpolation
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      // String literals from inside the interpolation
      expect(result.classList).toContain('bg-blue');
      expect(result.classList).toContain('bg-gray');
    });

    it('should extract from simple template literals without nested braces', async () => {
      const text = '<div className={`flex gap-2 items-center`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });

    it('should handle ternary expressions with string literals', async () => {
      const text =
        '<div className={isActive ? "bg-blue-500" : "bg-gray-500"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('bg-blue-500');
      expect(result.classList).toContain('bg-gray-500');
    });

    it('should handle nested ternary expressions', async () => {
      const text =
        '<div className={size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('text-lg');
      expect(result.classList).toContain('text-sm');
      expect(result.classList).toContain('text-base');
    });

    it('should handle logical AND expressions', async () => {
      const text = '<div className={isVisible && "block"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('block');
    });

    it('should handle logical OR expressions', async () => {
      const text = '<div className={customClass || "default-class"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('default-class');
    });

    it('should extract from complex template literal with multiple interpolations', async () => {
      // Enhanced brace matching correctly handles the full expression
      const text =
        '<div className={`flex ${direction === "row" ? "flex-row" : "flex-col"} ${wrap ? "flex-wrap" : "flex-nowrap"} items-center`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Static parts
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('items-center');
      // String literals from first interpolation
      expect(result.classList).toContain('flex-row');
      expect(result.classList).toContain('flex-col');
      // String literals from second interpolation
      expect(result.classList).toContain('flex-wrap');
      expect(result.classList).toContain('flex-nowrap');
      // "row" is extracted as a string literal (comparison value)
      expect(result.classList).toContain('row');
    });

    it('should extract cn() call inside template literal interpolation', async () => {
      // both the className expression & the nested cn() call are extracted
      const text =
        '<div className={`base-class ${cn("flex", condition && "gap-2")}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Static part from template literal
      expect(result.classList).toContain('base-class');
      // String literals from cn() call inside interpolation
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
    });

    it('should extract from array join patterns', async () => {
      // Array join patterns are now supported
      const text = "const cls = ['flex', 'gap-2', 'items-center'].join(' ');";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });
  });

  describe('clsx/cn/classnames extraction', () => {
    it('should extract from clsx() calls', async () => {
      const text = "const cls = clsx('flex', 'gap-2', 'items-center');";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });

    it('should extract from cn() calls', async () => {
      const text = "const cls = cn('px-4', 'py-2');";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('px-4');
      expect(result.classList).toContain('py-2');
    });

    it('should extract from classnames() calls', async () => {
      const text = "const cls = classnames('mt-4', 'mb-2');";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('mt-4');
      expect(result.classList).toContain('mb-2');
    });

    it('should extract from conditional clsx expressions', async () => {
      const text =
        "const cls = cn('px-4', condition && 'py-2', isActive ? 'bg-blue' : 'bg-gray');";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('px-4');
      expect(result.classList).toContain('py-2');
      expect(result.classList).toContain('bg-blue');
      expect(result.classList).toContain('bg-gray');
    });

    it('should extract from object syntax in classnames', async () => {
      const text =
        "const cls = classnames({ 'active': isActive, 'disabled': isDisabled });";
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('active');
      expect(result.classList).toContain('disabled');
    });

    it('should handle multiline clsx calls', async () => {
      const text = `const cls = clsx(
        'flex',
        'gap-2',
        condition && 'items-center'
      );`;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('items-center');
    });
  });

  describe('@apply directive extraction', () => {
    it('should extract classes from @apply', async () => {
      const text = '@apply flex items-center gap-2;';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('items-center');
      expect(result.classList).toContain('gap-2');
    });

    it('should handle multiple @apply statements', async () => {
      const text = `
        .card {
          @apply rounded-lg shadow-md;
          @apply p-4 bg-white;
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('rounded-lg');
      expect(result.classList).toContain('shadow-md');
      expect(result.classList).toContain('p-4');
      expect(result.classList).toContain('bg-white');
    });

    it('should extract responsive variants from @apply', async () => {
      const text = '@apply md:flex lg:hidden sm:grid-cols-2;';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('md:flex');
      expect(result.classList).toContain('lg:hidden');
      expect(result.classList).toContain('sm:grid-cols-2');
    });
  });

  describe('@layer utilities/components extraction', () => {
    it('should extract custom classes from @layer utilities', async () => {
      const text = `
        @layer utilities {
          .custom-gradient {
            background: linear-gradient(to right, red, blue);
          }
          .text-shadow-lg {
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('custom-gradient');
      expect(result.classList).toContain('text-shadow-lg');
    });

    it('should extract custom classes from @layer components', async () => {
      const text = `
        @layer components {
          .btn-primary {
            @apply bg-blue-500 text-white px-4 py-2;
          }
          .card-shadow {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('btn-primary');
      expect(result.classList).toContain('card-shadow');
      // Also extracts @apply classes
      expect(result.classList).toContain('bg-blue-500');
      expect(result.classList).toContain('text-white');
    });

    it('should handle nested selectors in @layer', async () => {
      const text = `
        @layer utilities {
          .responsive-grid {
            display: grid;
          }
          .responsive-grid-item {
            min-width: 0;
          }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('responsive-grid');
      expect(result.classList).toContain('responsive-grid-item');
    });

    it('should handle multiple @layer blocks', async () => {
      const text = `
        @layer utilities {
          .util-class { display: flex; }
        }
        @layer components {
          .comp-class { padding: 1rem; }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('util-class');
      expect(result.classList).toContain('comp-class');
    });

    it('should not extract from @layer base', async () => {
      const text = `
        @layer base {
          h1 {
            font-size: 2rem;
          }
          .base-class {
            color: black;
          }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      // @layer base is not scanned (it's for base styles, not custom classes)
      expect(result.classList).not.toContain('base-class');
    });

    it('should handle @layer with extra whitespace', async () => {
      const text = `
        @layer   utilities   {
          .spaced-class { display: block; }
        }
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('spaced-class');
    });
  });

  describe('escape sequence handling', () => {
    it('should handle single escaped quote in string', async () => {
      // className containing an escaped quote - should extract the class
      const text = '<div className={"flex \\"quoted\\" gap-2"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
    });

    it('should handle double backslash (escaped backslash) before quote', async () => {
      // \\\\ in source = \\ in string = escaped backslash, quote closes string
      const text = '<div className={"flex ends-with-backslash\\\\"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
    });

    it('should handle triple backslash (escaped backslash + escaped quote)', async () => {
      // \\\\\\" in source = \\" in string = backslash then escaped quote
      const text =
        '<div className={"flex \\\\\\"still-in-string gap-2"}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
    });

    it('should handle escaped characters in template literals', async () => {
      const text = '<div className={`flex \\` gap-2`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
    });
  });

  describe('token validation', () => {
    it('should accept arbitrary values', async () => {
      const text = 'className="bg-[#ff0000] w-[calc(100%-2rem)]"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('bg-[#ff0000]');
      expect(result.classList).toContain('w-[calc(100%-2rem)]');
    });

    it('should accept responsive variants', async () => {
      const text = 'className="sm:flex md:hidden lg:grid-cols-2"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('sm:flex');
      expect(result.classList).toContain('md:hidden');
      expect(result.classList).toContain('lg:grid-cols-2');
    });

    it('should accept state variants', async () => {
      const text = 'className="hover:bg-blue-500 focus:ring-2 active:scale-95"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('hover:bg-blue-500');
      expect(result.classList).toContain('focus:ring-2');
      expect(result.classList).toContain('active:scale-95');
    });

    it('should accept negative values', async () => {
      const text = 'className="-mt-4 -translate-x-1/2 -z-10"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('-mt-4');
      expect(result.classList).toContain('-translate-x-1/2');
      expect(result.classList).toContain('-z-10');
    });

    it('should accept fractions', async () => {
      const text = 'className="w-1/2 translate-y-1/3 h-3/4"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('w-1/2');
      expect(result.classList).toContain('translate-y-1/3');
      expect(result.classList).toContain('h-3/4');
    });

    it('should filter invalid tokens', async () => {
      const text = 'className="flex $invalid @weird {bad} <script>"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).not.toContain('$invalid');
      expect(result.classList).not.toContain('@weird');
      expect(result.classList).not.toContain('{bad}');
      expect(result.classList).not.toContain('<script>');
    });

    it('should accept important modifier', async () => {
      const text = 'className="!important !mt-4"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('!important');
      expect(result.classList).toContain('!mt-4');
    });

    it('should accept group and peer modifiers', async () => {
      const text = 'className="group-hover:text-blue-500 peer-focus:ring-2"';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('group-hover:text-blue-500');
      expect(result.classList).toContain('peer-focus:ring-2');
    });
  });

  describe('dependency scanning', () => {
    const optionsWithDeps: TailwindScanOptions = {
      includeDependencies: true,
      entryFilePath: '/workspace/src/page.mdx',
      entryFileDependencies: ['./Component.tsx', './utils.ts'],
    };

    it('should resolve and scan relative imports', async () => {
      // Mock resolver to resolve imports to file paths
      mockResolverForRelativeImports({
        './Component.tsx': '/workspace/src/Component.tsx',
        './utils.ts': '/workspace/src/utils.ts',
      });

      // Mock fs for FileScanValidator
      vi.spyOn(fs.promises, 'stat').mockImplementation(async (p) => {
        if (
          p === '/workspace/src/Component.tsx' ||
          p === '/workspace/src/utils.ts'
        ) {
          return { size: 100, isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (p) => {
        if (p === '/workspace/src/Component.tsx') {
          return 'const x = <div className="from-component"></div>';
        }
        if (p === '/workspace/src/utils.ts') {
          return 'const cls = cn("from-utils");';
        }
        return '';
      });

      const result = await scanner.scan(
        '<div className="from-entry"></div>',
        optionsWithDeps
      );

      expect(result.classList).toContain('from-entry');
      expect(result.classList).toContain('from-component');
      expect(result.classList).toContain('from-utils');
      expect(result.scannedFiles).toContain('/workspace/src/Component.tsx');
      expect(result.scannedFiles).toContain('/workspace/src/utils.ts');
    });

    it('should skip node_modules imports', async () => {
      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['react', '@radix-ui/react-dialog', 'lodash'],
      };

      await scanner.scan('', options);

      // Resolver should not be called for non-relative imports (isRelativeImport returns false)
      expect(mockResolveAsync).not.toHaveBeenCalled();
    });

    it('should resolve index files (via resolver)', async () => {
      // Mock resolver to resolve to index file
      mockResolverForRelativeImports({
        './components': '/workspace/src/components/index.tsx',
      });

      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        isFile: () => true,
      } as fs.Stats);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        'className="from-index"'
      );

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['./components'],
      };

      const result = await scanner.scan('', options);
      expect(result.scannedFiles).toContain(
        '/workspace/src/components/index.tsx'
      );
    });

    it('should use resolver for extension resolution', async () => {
      // Mock resolver to resolve ./Component to ./Component.tsx
      mockResolverForRelativeImports({
        './Component': '/workspace/src/Component.tsx',
      });

      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        isFile: () => true,
      } as fs.Stats);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('className="found"');

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['./Component'],
      };

      const result = await scanner.scan('', options);

      // Resolver should be called for resolution
      expect(mockResolveAsync).toHaveBeenCalledWith(
        './Component',
        expect.objectContaining({ baseDir: '/workspace/src' }),
        'dependency'
      );
      expect(result.scannedFiles).toContain('/workspace/src/Component.tsx');
    });

    it('should skip files over maxFileSizeBytes', async () => {
      mockResolverForRelativeImports({
        './large-file.tsx': '/workspace/src/large-file.tsx',
      });

      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 2 * 1024 * 1024, // 2MB
        isFile: () => true,
      } as fs.Stats);
      const readSpy = vi.spyOn(fs.promises, 'readFile');

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['./large-file.tsx'],
        maxFileSizeBytes: 1024 * 1024, // 1MB limit
      };

      const result = await scanner.scan('', options);

      expect(readSpy).not.toHaveBeenCalled();
      expect(result.scannedFiles).toHaveLength(0);
    });

    it('should gracefully handle unreadable files', async () => {
      mockResolverForRelativeImports({
        './unreadable.tsx': '/workspace/src/unreadable.tsx',
      });

      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        isFile: () => true,
      } as fs.Stats);
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['./unreadable.tsx'],
      };

      // Should not throw
      const result = await scanner.scan('className="entry"', options);
      expect(result.classList).toContain('entry');
      expect(result.scannedFiles).toHaveLength(0);
    });

    it('should not scan without required options', async () => {
      // Missing entryFilePath
      await scanner.scan('', {
        includeDependencies: true,
        entryFileDependencies: ['./Component.tsx'],
      });

      // Missing entryFileDependencies
      await scanner.scan('', {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
      });

      // Empty dependencies
      await scanner.scan('', {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [],
      });

      // Resolver should not be called when required options missing
      expect(mockResolveAsync).not.toHaveBeenCalled();
    });
  });

  describe('template literal edge cases', () => {
    it('should handle escaped characters in template literals', async () => {
      const text = '<div className={`flex \\` gap-2`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Escaped backtick should be handled
      expect(result.classList).toContain('flex');
    });

    it('should handle nested object literals in interpolations', async () => {
      // Enhanced brace matching now correctly handles nested objects
      const text =
        '<div className={`flex ${{ active: true } ? "bg-blue" : ""}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // now extracts static parts & string literals inside interpolations
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('bg-blue');
    });

    it('LIMITATION: deeply nested template literals only partially extracted', async () => {
      // Nested template literals are a parsing edge case
      // The regex for template literals can't handle nested backticks
      const text =
        '<div className={`outer ${condition ? `inner-${variant}` : "fallback"}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Static parts from outer template are extracted
      expect(result.classList).toContain('outer');
      // LIMITATION: nested template literals & their else branches may not be fully extracted
      // Use separate string literals instead of nested template literals when possible
    });

    it('should handle template literal with only interpolations', async () => {
      const text = '<div className={`${a}${b}${c}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // No static parts, no string literals
      expect(result.classList).toHaveLength(0);
    });

    it('should handle function calls with object args in interpolations', async () => {
      // Enhanced brace matching now handles nested objects in function calls
      const text =
        '<div className={`flex ${getClasses("primary", { large: true })}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // now extracts both static parts & string literals from interpolation
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('primary');
    });

    it('LIMITATION: cannot extract truly dynamic classes', async () => {
      // Classes like text-${size} where size is a variable cannot be extracted
      // This is a fundamental limitation - use Tailwind's safelist for these
      const text = '<div className={`text-${size} bg-${color}-500`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // these are dynamic & cannot be extracted statically
      expect(result.classList).not.toContain('text-sm');
      expect(result.classList).not.toContain('text-lg');
      // Document: Use Tailwind's safelist configuration for dynamic classes
    });

    it('should extract static parts and ternary strings from mixed template', async () => {
      // Enhanced extraction now properly handles mixed content
      const text =
        '<div className={`flex items-center text-${size} ${active ? "bg-blue-500" : "bg-gray-500"}`}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Static parts are extracted
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('items-center');
      // Ternary string literals are extracted
      expect(result.classList).toContain('bg-blue-500');
      expect(result.classList).toContain('bg-gray-500');
      // text-${size} is dynamic & not extracted
    });
  });

  describe('edge cases', () => {
    it('should handle empty string content', async () => {
      const result = await scanner.scan('', defaultOptions);
      expect(result.classList).toHaveLength(0);
      expect(result.scannedFiles).toHaveLength(0);
    });

    it('should handle whitespace-only content', async () => {
      const result = await scanner.scan('   \n\t\n   ', defaultOptions);
      expect(result.classList).toHaveLength(0);
    });

    it('should handle content with no class attributes', async () => {
      const text = '<div id="container"><span>Hello</span></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toHaveLength(0);
    });

    it('should handle malformed JSX - partial matches still extracted', async () => {
      const text = '<div className="flex incomplete';
      const result = await scanner.scan(text, defaultOptions);
      // Should still extract what's valid
      expect(result.classList).toHaveLength(0); // Quotes not closed
    });

    it('should handle very long class strings', async () => {
      const classes = Array.from({ length: 100 }, (_, i) => `class-${i}`).join(
        ' '
      );
      const text = `<div className="${classes}"></div>`;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList.length).toBe(100);
    });

    it('should handle mixed content (MDX with JSX and CSS)', async () => {
      const text = `
# Heading

<div className="prose max-w-none">
  <Component className={cn('flex', 'gap-2')} />
</div>

<style>
.custom {
  @apply bg-gray-100 rounded-lg;
}
</style>
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('prose');
      expect(result.classList).toContain('max-w-none');
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('gap-2');
      expect(result.classList).toContain('bg-gray-100');
      expect(result.classList).toContain('rounded-lg');
    });

    it('should handle nested expressions', async () => {
      const text = '<div className={styles[variant]}></div>';
      const result = await scanner.scan(text, defaultOptions);
      // Variable reference, no string literals
      expect(result.classList).toHaveLength(0);
    });

    it('should extract from comments too (intentional for safelist)', async () => {
      const text = `
        // className="flex gap-2"
        /* @apply hidden md:block; */
      `;
      const result = await scanner.scan(text, defaultOptions);
      // Regex doesn't distinguish comments - this is intentional for safelisting
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('hidden');
    });

    it('should handle expressions with nested braces in objects', async () => {
      const text =
        '<div className={cn({ "flex": true, "hidden": false })}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('hidden');
    });

    it('should handle expressions with function calls containing braces', async () => {
      const text = '<div className={getStyle({ variant: "primary" })}></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toContain('primary');
    });

    it('should NOT extract from string concatenation (no matching pattern)', async () => {
      // String concatenation doesn't match className/class or clsx/cn patterns
      const text = 'const cls = "flex " + "items-center" + " gap-2";';
      const result = await scanner.scan(text, defaultOptions);
      // no pattern matches variable assignment w/ string concatenation
      expect(result.classList).toHaveLength(0);
    });

    it('should handle deeply nested template literals without stack overflow', async () => {
      // create pathological input w/ 15 levels of nesting (exceeds MAX_RECURSION_DEPTH of 10)
      // the extraction should not throw & should extract classes up to the depth limit
      let nested = '"innermost-class"';
      for (let i = 0; i < 15; i++) {
        nested = `\`level${i} \${${nested}}\``;
      }
      const text = `<div className={${nested}}></div>`;

      // Should not throw a stack overflow error
      const result = await scanner.scan(text, defaultOptions);

      // Should have extracted at least the outer levels (classes up to depth limit)
      expect(result.classList).toBeDefined();
      expect(Array.isArray(result.classList)).toBe(true);
      // Note: Due to regex limitations w/ nested backticks, extraction may be partial,
      // but the important thing is it doesn't crash
    });

    it('should extract classes from moderately nested template literals', async () => {
      // A reasonable nesting level (3 levels) should fully extract
      const text = `<div className={\`flex \${condition ? \`gap-2 \${"text-sm"}\` : "hidden"}\`}></div>`;
      const result = await scanner.scan(text, defaultOptions);

      // static parts & nested string literals should be extracted
      expect(result.classList).toContain('flex');
      expect(result.classList).toContain('hidden');
      // Note: inner nested template literals w/ backticks are limited by regex
    });
  });

  describe('deterministic ordering', () => {
    it('should return classList in sorted order', async () => {
      const text = '<div className="zebra apple mango banana"></div>';
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toEqual(['apple', 'banana', 'mango', 'zebra']);
    });

    it('should return consistent ordering regardless of class discovery order', async () => {
      // Classes from multiple sources should be sorted consistently
      const text = `
        <div className="z-class"></div>
        <div className="a-class"></div>
        <div className="m-class"></div>
      `;
      const result = await scanner.scan(text, defaultOptions);
      expect(result.classList).toEqual(['a-class', 'm-class', 'z-class']);
    });

    it('should return consistent classList across multiple runs', async () => {
      const text =
        '<div className="flex gap-2 items-center mt-4 bg-blue-500"></div>';

      // run multiple times & verify consistency
      const results = await Promise.all([
        scanner.scan(text, defaultOptions),
        scanner.scan(text, defaultOptions),
        scanner.scan(text, defaultOptions),
      ]);

      const firstClassList = results[0].classList;
      for (const result of results) {
        expect(result.classList).toEqual(firstClassList);
      }

      // Verify it's actually sorted
      expect(firstClassList).toEqual([...firstClassList].sort());
    });

    it('should return scannedFiles in sorted order', async () => {
      // Mock resolver for all three imports
      mockResolverForRelativeImports({
        './z-component.tsx': '/workspace/src/z-component.tsx',
        './a-component.tsx': '/workspace/src/a-component.tsx',
        './m-component.tsx': '/workspace/src/m-component.tsx',
      });

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (p) => {
        const pathStr = String(p);
        if (
          pathStr === '/workspace/src/z-component.tsx' ||
          pathStr === '/workspace/src/a-component.tsx' ||
          pathStr === '/workspace/src/m-component.tsx'
        ) {
          return { size: 100, isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        'className="from-dep"'
      );

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: [
          './z-component.tsx',
          './a-component.tsx',
          './m-component.tsx',
        ],
      };

      const result = await scanner.scan('', options);

      expect(result.scannedFiles).toEqual([
        '/workspace/src/a-component.tsx',
        '/workspace/src/m-component.tsx',
        '/workspace/src/z-component.tsx',
      ]);
    });

    it('should produce deterministic order even with parallel file reads', async () => {
      // Mock resolver for all three imports
      mockResolverForRelativeImports({
        './comp-z.tsx': '/workspace/src/comp-z.tsx',
        './comp-a.tsx': '/workspace/src/comp-a.tsx',
        './comp-m.tsx': '/workspace/src/comp-m.tsx',
      });

      // Simulate parallel file reads completing in random order
      vi.spyOn(fs.promises, 'stat').mockImplementation(async (p) => {
        const pathStr = String(p);
        if (pathStr.includes('/workspace/src/')) {
          return { size: 100, isFile: () => true } as fs.Stats;
        }
        throw new Error('ENOENT');
      });
      vi.spyOn(fs.promises, 'readFile').mockImplementation(async (p) => {
        // Add random delay to simulate non-deterministic I/O
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        const pathStr = String(p);
        if (pathStr.includes('comp-z')) {
          return 'className="zebra-class"';
        }
        if (pathStr.includes('comp-a')) {
          return 'className="alpha-class"';
        }
        if (pathStr.includes('comp-m')) {
          return 'className="middle-class"';
        }
        return '';
      });

      const options: TailwindScanOptions = {
        includeDependencies: true,
        entryFilePath: '/workspace/src/page.mdx',
        entryFileDependencies: ['./comp-z.tsx', './comp-a.tsx', './comp-m.tsx'],
      };

      // Run multiple times to catch any non-determinism
      const results: TailwindScanResult[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await scanner.scan('className="main-class"', options));
      }

      // All results should be identical
      const expected = results[0];
      for (const result of results) {
        expect(result.classList).toEqual(expected.classList);
        expect(result.scannedFiles).toEqual(expected.scannedFiles);
      }

      // Verify sorting
      expect(expected.classList).toEqual([...expected.classList].sort());
      expect(expected.scannedFiles).toEqual([...expected.scannedFiles].sort());
    });

    it('should handle uppercase and lowercase classes with consistent ordering', async () => {
      // Default sort uses UTF-16 code unit order: uppercase before lowercase
      const text = '<div className="Flex flex FLEX Gap-2 gap-2"></div>';
      const result = await scanner.scan(text, defaultOptions);

      // Verify consistent ordering (uppercase letters come before lowercase in UTF-16)
      expect(result.classList).toEqual([
        'FLEX',
        'Flex',
        'Gap-2',
        'flex',
        'gap-2',
      ]);
    });

    it('should handle special characters in class names with consistent ordering', async () => {
      const text = 'className="!important -mt-4 hover:bg-blue w-1/2 bg-[#fff]"';
      const result = await scanner.scan(text, defaultOptions);

      // Should be sorted lexicographically
      const sorted = [...result.classList].sort();
      expect(result.classList).toEqual(sorted);
    });
  });
});
