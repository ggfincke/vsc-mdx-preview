// packages/extension/preview/EvaluationEngine.ts
// evaluation logic for MDX content, handles both Trusted & Safe modes

import * as fs from 'fs';
import { transformEntry } from '../module-system/transform/transform';
import { extractImportSpecifiers } from '../module-system/deps/import-extractor';
import { createLazyImport } from '../utils/lazy-import';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';

// lazy load Safe Mode compiler - only loaded when Safe Mode is actually used
const getCompileSafeModule = createLazyImport(
  () => import('../compiler/safe/compile')
);
import { ErrorContext } from '../errors';
import {
  getTailwindProcessor,
  getErrorReporter,
  getConfigManager,
} from '../services';
import {
  TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS,
  MDX_COMPILATION_TIMEOUT_MS,
} from '../constants';
import type { Preview, WebviewHandle } from './preview-manager';
import type { TrustState } from '@mdx-preview/shared';
import type { ResolvedConfig, TailwindConfig } from '../types';

// result of evaluating MDX in Trusted Mode
export interface TrustedEvaluationResult {
  // transpiled JS code
  code: string;
  // resolved file path
  entryFilePath: string;
  // extracted dependencies
  dependencies: string[];
  // parsed frontmatter
  frontmatter: Record<string, unknown> | undefined;
}

// result of evaluating MDX in Safe Mode
export interface SafeEvaluationResult {
  // sanitized HTML
  html: string;
  // parsed frontmatter
  frontmatter: Record<string, unknown> | undefined;
}

// parameters for Tailwind CSS processing
export interface TailwindProcessParams {
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
  tailwindConfig: TailwindConfig;
}

// evaluation engine handles core evaluation logic for MDX content
export class EvaluationEngine {
  // evaluate MDX in Trusted Mode (transpile to executable JS w/ React components)
  async evaluateTrusted(
    text: string,
    fsPath: string,
    preview: Preview
  ): Promise<TrustedEvaluationResult> {
    debug(`[${LogTags.ENGINE}] evaluateTrusted called`);

    debug(`[${LogTags.ENGINE}] Transforming entry...`);
    // transformEntry returns esmCode for import extraction (timeout prevents hang)
    const transformResult = await this.withTimeout(
      transformEntry(text, fsPath, preview),
      MDX_COMPILATION_TIMEOUT_MS
    );

    if (transformResult === null) {
      throw new Error(
        `MDX compilation timed out after ${MDX_COMPILATION_TIMEOUT_MS / 1000}s`
      );
    }

    const { code, esmCode, frontmatter } = transformResult;
    debug(
      `[${LogTags.ENGINE}] Transform complete, code length: ${code.length}`
    );

    // use async fs.promises.realpath instead of sync version
    const entryFilePath = await fs.promises.realpath(fsPath);

    // extract dependencies from ESM code (before CommonJS conversion for better parsing)
    const dependencies = await extractImportSpecifiers(esmCode);
    debug(`[${LogTags.ENGINE}] Dependencies: ${dependencies.join(', ')}`);

    return {
      code,
      entryFilePath,
      dependencies,
      frontmatter,
    };
  }

  // evaluate MDX content in Safe Mode - compiles MDX to sanitized HTML w/o code execution
  async evaluateSafe(
    text: string,
    mdxPreviewConfig: ResolvedConfig | undefined
  ): Promise<SafeEvaluationResult> {
    debug(`[${LogTags.ENGINE}] evaluateSafe called`);

    debug(`[${LogTags.ENGINE}] Loading Safe Mode compiler...`);
    const { compileSafe } = await getCompileSafeModule();

    debug(`[${LogTags.ENGINE}] Compiling to safe HTML...`);
    const { html, frontmatter } = await compileSafe(text, mdxPreviewConfig);
    debug(`[${LogTags.ENGINE}] Safe HTML compiled, length: ${html.length}`);

    return { html, frontmatter };
  }

  // process Tailwind CSS asynchronously (called after preview update to avoid blocking)
  async processTailwindAsync(
    preview: Preview,
    params: TailwindProcessParams,
    requestId: number,
    webviewHandle: WebviewHandle
  ): Promise<void> {
    try {
      debug(`[${LogTags.ENGINE}/TAILWIND] Starting background compilation`);

      const compilationTimeout =
        getConfigManager().get(
          'tailwind.compilationTimeout',
          preview.doc.uri
        ) ?? TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS;

      const result = await this.withTimeout(
        getTailwindProcessor().process({
          preview,
          mdxText: params.mdxText,
          entryFilePath: params.entryFilePath,
          entryFileDependencies: params.entryFileDependencies,
          trustState: params.trustState,
          tailwindConfig: params.tailwindConfig,
        }),
        compilationTimeout
      );

      if (result === null) {
        debug(`[${LogTags.ENGINE}/TAILWIND] Compilation timed out`);
        getErrorReporter().report(new Error('Tailwind compilation timed out'), {
          context: ErrorContext.Tailwind,
          showNotification: true,
          metadata: { timeout: compilationTimeout },
        });
        return;
      }

      if (!result || !preview.isTailwindRequestCurrent(requestId)) {
        return;
      }

      preview.updateTailwindWatchFiles(result.watchFiles);
      webviewHandle.setTailwindCss(result.css);
    } catch (error) {
      getErrorReporter().report(error, {
        context: ErrorContext.Tailwind,
        showNotification: true,
        metadata: { entryFilePath: params.entryFilePath },
      });
    }
  }

  // execute a promise w/ a timeout - returns null if the timeout is reached
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T | null> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result as T | null;
  }
}

// singleton instance
let engineInstance: EvaluationEngine | null = null;

// get the EvaluationEngine singleton instance
export function getEvaluationEngine(): EvaluationEngine {
  if (!engineInstance) {
    engineInstance = new EvaluationEngine();
  }
  return engineInstance;
}
