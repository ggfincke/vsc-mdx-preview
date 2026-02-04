// packages/extension/tailwind/TailwindCompiler.ts
// compile Tailwind CSS via PostCSS w/ lazy-loading for startup performance

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
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

  debug(`[${LogTags.TAILWIND}] Lazy-loading postcss...`);

  try {
    // try CommonJS require first (most common case)
    const mod = require('postcss');
    postcssInstance = (mod.default ?? mod) as PostCSSFn;
    debug(`[${LogTags.TAILWIND}] PostCSS loaded via require`);
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
    debug(`[${LogTags.TAILWIND}] PostCSS loaded via dynamic import (ESM)`);
    return postcssInstance;
  }
}

// clear postcss cache (for testing or cache refresh scenarios)
export function clearPostCSSCache(): void {
  postcssInstance = null;
  debug(`[${LogTags.TAILWIND}] PostCSS cache cleared`);
}

// PostCSS plugin factory type
// a function that accepts options & returns a PostCSS plugin object
type PostCSSPluginFactory = (options?: unknown) => {
  postcssPlugin: string;
  [key: string]: unknown;
};

export type TailwindVersion = 'v4';

export interface TailwindCompileOptions {
  tailwindVersion: TailwindVersion;
  configPath?: string | null;
  entryCssPath?: string | null;
  content: string;
  baseDir?: string | null;
}

export class TailwindCompiler {
  async compile(options: TailwindCompileOptions): Promise<string> {
    let inputCss = await this.loadInputCss(options);
    const plugin = await this.loadTailwindPlugin();

    // v4 uses @source inline() directives for content discovery
    if (options.content.trim()) {
      inputCss += this.buildInlineSourceDirectives(options.content);
    }

    const pluginOptions = {
      ...(options.configPath ? { config: options.configPath } : {}),
      ...(options.baseDir ? { base: options.baseDir } : {}),
    };

    // lazy-load postcss (deferred until first Tailwind compilation)
    const postcss = await getPostCSS();
    const result = await postcss([plugin(pluginOptions)]).process(inputCss, {
      from: options.entryCssPath ?? undefined,
    });

    debug(
      `[${LogTags.TAILWIND}] CSS compiled (${result.css.length} chars, version=${options.tailwindVersion})`
    );
    return result.css;
  }

  private async loadInputCss(options: TailwindCompileOptions): Promise<string> {
    if (options.entryCssPath) {
      return fs.promises.readFile(options.entryCssPath, 'utf-8');
    }

    // v4: skip preflight to avoid overriding markdown styles in previews
    return [
      '@import "tailwindcss/theme";',
      '@tailwind components;',
      '@tailwind utilities;',
      '',
    ].join('\n');
  }

  // build @source inline() directives for content discovery
  // chunks the class list into multiple directives to avoid potential
  // CSS parser issues w/ very long inline strings
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

  private async loadTailwindPlugin(): Promise<PostCSSPluginFactory> {
    return this.loadModule('@tailwindcss/postcss');
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

  // validate loaded module is a valid PostCSS plugin factory & throw TailwindError if not a function
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
