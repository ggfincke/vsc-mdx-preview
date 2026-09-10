// packages/extension-host/src/features/tailwind/TailwindCompiler.ts
// compile Tailwind CSS via PostCSS w/ lazy-loading for startup performance

import * as path from 'path';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { TailwindError } from '../../shared/errors';
import { MAX_INLINE_SOURCE_CHUNK_SIZE } from './constants';
import { loadModuleWithEsmFallback } from '../../shared/utils/lazy-import';
import {
  pathExists,
  readFileRequiredAsync,
} from '../../shared/utils/file-utils';

const log = createTaggedLogger(LogTags.TAILWIND);

// type-only import for PostCSS default export (actual module loaded lazily)
// postcss default export is a function that creates a Processor
type PostCSSFn = typeof import('postcss').default;

// module-level cache for lazy-loaded PostCSS function
let postcssInstance: PostCSSFn | null = null;

// clear the lazy PostCSS module
export function clearPostCSSCache(): void {
  postcssInstance = null;
}

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
  inlineTailwindStyles: readonly string[];
  inputFilePath: string;
  content: string;
  baseDir?: string | null;
}

export class TailwindCompiler {
  async compile(options: TailwindCompileOptions): Promise<string> {
    const postcss = await getPostCSS();
    let inputCss = await this.loadInputCss(options, postcss);
    const plugin = await this.loadTailwindPlugin();

    // v4 uses @source inline() directives for content discovery
    if (options.content.trim()) {
      inputCss += this.buildInlineSourceDirectives(options.content);
    }

    const pluginOptions = {
      ...(options.baseDir ? { base: options.baseDir } : {}),
    };

    const result = await postcss([plugin(pluginOptions)]).process(inputCss, {
      from: options.inputFilePath,
    });

    log.debug(
      `CSS compiled (${result.css.length} chars, version=${options.tailwindVersion})`
    );
    return result.css;
  }

  private async loadInputCss(
    options: TailwindCompileOptions,
    postcss: PostCSSFn
  ): Promise<string> {
    const inlineStyles = options.inlineTailwindStyles
      .map((style) => style.trim())
      .filter(Boolean);
    const segments: string[] = [];
    const authoredInputs = inlineStyles.map((css) => ({
      css,
      from: options.inputFilePath,
    }));

    if (options.entryCssPath) {
      const entryCssPath = path.resolve(options.entryCssPath);
      authoredInputs.push({
        css: await readFileRequiredAsync(entryCssPath, 'utf-8'),
        from: entryCssPath,
      });
      // retain the entry file as an import so its relative paths keep their base
      segments.push(`@import "${this.escapeCssString(entryCssPath)}";`);
    } else {
      // skip preflight to avoid overriding markdown styles in previews
      const bundledThemePath = path.join(__dirname, 'tailwind-theme.css');
      const themeModuleId = 'tailwindcss/theme';
      const themePath = this.escapeCssString(
        pathExists(bundledThemePath)
          ? bundledThemePath
          : require.resolve(themeModuleId)
      );
      segments.push(
        `@import "${themePath}";`,
        '@tailwind components;',
        '@tailwind utilities;'
      );
    }

    let hasAuthoredConfig = false;
    for (const input of authoredInputs) {
      postcss
        .parse(input.css, { from: input.from })
        .walkAtRules('config', () => {
          hasAuthoredConfig = true;
        });
    }
    if (options.configPath && !hasAuthoredConfig) {
      const configPath = this.escapeCssString(path.resolve(options.configPath));
      segments.push(`@config "${configPath}";`);
    }

    return [...segments, ...inlineStyles].join('\n\n');
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
        .map((chunk) => `@source inline("${this.escapeCssString(chunk)}");`)
        .join('\n') +
      '\n'
    );
  }

  private escapeCssString(value: string): string {
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
