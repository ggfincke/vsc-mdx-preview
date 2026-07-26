// packages/extension-host/src/features/tailwind/TailwindCompiler.ts
// compile Tailwind CSS via PostCSS w/ lazy-loading for startup performance

import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { TailwindError } from '../../shared/errors';
import { MAX_INLINE_SOURCE_CHUNK_SIZE } from './constants';
import { loadModuleWithEsmFallback } from '../../shared/utils/lazy-import';
import { readFileAsync } from '../../shared/utils/file-utils';

const log = createTaggedLogger(LogTags.TAILWIND);

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

  log.debug('Lazy-loading postcss...');
  postcssInstance = await loadModuleWithEsmFallback<PostCSSFn>('postcss');
  log.debug('PostCSS loaded');
  return postcssInstance;
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

    log.debug(
      `CSS compiled (${result.css.length} chars, version=${options.tailwindVersion})`
    );
    return result.css;
  }

  private async loadInputCss(options: TailwindCompileOptions): Promise<string> {
    if (options.entryCssPath) {
      let readError: unknown;
      const entryCss = await readFileAsync(options.entryCssPath, 'utf-8', {
        onError: (error) => {
          readError = error;
        },
      });

      if (entryCss === null) {
        throw readError instanceof Error
          ? readError
          : new TailwindError(
              `Failed to read Tailwind CSS entry file: ${options.entryCssPath}`,
              'E562',
              'config'
            );
      }
      return entryCss;
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
    const id = '@tailwindcss/postcss';
    const plugin = await loadModuleWithEsmFallback<unknown>(id);
    if (typeof plugin !== 'function') {
      throw new TailwindError(
        `Module "${id}" must export a function (PostCSS plugin factory). ` +
          `Got ${typeof plugin} instead.`,
        'E562',
        'config'
      );
    }
    return plugin as PostCSSPluginFactory;
  }
}
