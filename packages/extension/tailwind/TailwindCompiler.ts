// packages/extension/tailwind/TailwindCompiler.ts
// compile Tailwind CSS via PostCSS
//
// error handling strategy:
// - this module propagates errors to its caller (TailwindProcessor)
// - the ESM/CJS module loading uses intelligent fallback: try CommonJS first,
//   then ESM if ERR_REQUIRE_ESM is detected
// - file I/O errors (readFile) propagate up - expected to be caught by orchestrator
//
// optimization: PostCSS is lazy-loaded to improve extension startup time
// for workspaces that don't use Tailwind

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { debug } from '../logging';
import { TailwindError } from '../errors';
import { MAX_INLINE_SOURCE_CHUNK_SIZE } from './constants';

// type-only import for PostCSS default export (actual module loaded lazily)
// postcss default export is a function that creates a Processor
type PostCSSFn = typeof import('postcss').default;

// module-level cache for lazy-loaded PostCSS function
let postcssInstance: PostCSSFn | null = null;

// lazy-load postcss only when Tailwind compilation is needed
// follows the same CJS/ESM fallback pattern as Tailwind plugin loading
async function getPostCSS(): Promise<PostCSSFn> {
  if (postcssInstance) {
    return postcssInstance;
  }

  debug('[TAILWIND] Lazy-loading postcss...');

  try {
    // try CommonJS require first (most common case)
    const mod = require('postcss');
    postcssInstance = (mod.default ?? mod) as PostCSSFn;
    debug('[TAILWIND] PostCSS loaded via require');
    return postcssInstance;
  } catch (error) {
    // handle ESM-only postcss package
    const isEsm =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ERR_REQUIRE_ESM';

    if (!isEsm) {
      throw error;
    }

    const mod = await import('postcss');
    postcssInstance = (mod.default ?? mod) as PostCSSFn;
    debug('[TAILWIND] PostCSS loaded via dynamic import (ESM)');
    return postcssInstance;
  }
}

// clear postcss cache (for testing or cache refresh scenarios)
export function clearPostCSSCache(): void {
  postcssInstance = null;
  debug('[TAILWIND] PostCSS cache cleared');
}

// PostCSS plugin factory type
// a function that accepts options & returns a PostCSS plugin object
type PostCSSPluginFactory = (options?: unknown) => {
  postcssPlugin: string;
  [key: string]: unknown;
};

export type TailwindVersion = 'v3' | 'v4';

export interface TailwindCompileOptions {
  tailwindVersion: TailwindVersion;
  configPath?: string | null;
  entryCssPath?: string | null;
  content: string;
  workspaceTailwindPath?: string;
  baseDir?: string | null;
}

export class TailwindCompiler {
  async compile(options: TailwindCompileOptions): Promise<string> {
    let inputCss = await this.loadInputCss(options);
    const plugin = await this.loadTailwindPlugin(options);

    const useInlineSources = options.tailwindVersion === 'v4';
    if (useInlineSources && options.content.trim()) {
      inputCss += this.buildInlineSourceDirectives(options.content);
    }

    const contentConfig =
      !useInlineSources && options.content
        ? [{ raw: options.content, extension: 'mdx' }]
        : [];

    const pluginOptions = {
      ...(options.configPath ? { config: options.configPath } : {}),
      ...(options.baseDir ? { base: options.baseDir } : {}),
      ...(contentConfig.length > 0 ? { content: contentConfig } : {}),
    };

    // lazy-load postcss (deferred until first Tailwind compilation)
    const postcss = await getPostCSS();
    const result = await postcss([plugin(pluginOptions)]).process(inputCss, {
      from: options.entryCssPath ?? undefined,
    });

    debug(
      `[TAILWIND] CSS compiled (${result.css.length} chars, version=${options.tailwindVersion})`
    );
    return result.css;
  }

  private async loadInputCss(options: TailwindCompileOptions): Promise<string> {
    if (options.entryCssPath) {
      return fs.promises.readFile(options.entryCssPath, 'utf-8');
    }

    if (options.tailwindVersion === 'v4') {
      // skip preflight to avoid overriding markdown styles in previews
      return [
        '@import "tailwindcss/theme";',
        '@tailwind components;',
        '@tailwind utilities;',
        '',
      ].join('\n');
    }

    // skip base layer to preserve markdown formatting by default
    return '@tailwind components;\n@tailwind utilities;\n';
  }

  // build @source inline() directives for Tailwind v4
  // Tailwind v4 uses CSS-based content discovery via @source directives instead
  // of the v3 `content` configuration option. This method chunks the class list
  // into multiple directives to avoid potential CSS parser issues w/ very long
  // inline strings
  // note: Tailwind v3 does not use this method - it passes content via the
  // plugin's `content` option instead
  private buildInlineSourceDirectives(content: string): string {
    const chunks: string[] = [];
    let current = '';

    for (const token of content.split(/\s+/)) {
      if (!token) {
        continue;
      }
      if (current.length + token.length + 1 > MAX_INLINE_SOURCE_CHUNK_SIZE) {
        chunks.push(current.trim());
        current = '';
      }
      current += `${token} `;
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return (
      '\n' +
      chunks
        .map((chunk) => `@source inline("${this.escapeInline(chunk)}");`)
        .join('\n') +
      '\n'
    );
  }

  private escapeInline(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private async loadTailwindPlugin(
    options: TailwindCompileOptions
  ): Promise<PostCSSPluginFactory> {
    if (options.tailwindVersion === 'v4') {
      return this.loadModule('@tailwindcss/postcss');
    }

    if (options.workspaceTailwindPath) {
      return this.loadModule(options.workspaceTailwindPath);
    }

    return this.loadModule('tailwindcss');
  }

  private async loadModule(id: string): Promise<PostCSSPluginFactory> {
    let plugin: unknown;

    try {
      const mod = require(id);
      plugin = mod.default ?? mod;
    } catch (error) {
      const isEsm =
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ERR_REQUIRE_ESM';
      if (!isEsm) {
        throw error;
      }
      const specifier = path.isAbsolute(id) ? pathToFileURL(id).href : id;
      const mod = await import(specifier);
      plugin = (mod as { default?: unknown }).default ?? mod;
    }

    return this.validatePluginModule(plugin, id);
  }

  // validates that a loaded module is a valid PostCSS plugin factory
  // throws TailwindError if the module is not a function
  private validatePluginModule(mod: unknown, id: string): PostCSSPluginFactory {
    if (typeof mod !== 'function') {
      throw new TailwindError(
        `Module "${id}" must export a function (PostCSS plugin factory). ` +
          `Got ${typeof mod} instead.`,
        'E562',
        'config'
      );
    }
    return mod as PostCSSPluginFactory;
  }
}
