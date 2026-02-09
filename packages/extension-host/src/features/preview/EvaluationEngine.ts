// packages/extension/preview/EvaluationEngine.ts
// evaluation logic for MDX content, handles both Trusted & Safe modes

import * as fs from 'fs';
import { transformEntry } from '../module-runtime/transform/transform';
import { extractImportSpecifiers } from '../module-runtime/dependencies/import-extractor';
import { createLazyImport } from '../../shared/utils/lazy-import';
import { createSingleton } from '../../shared/utils/singleton-factory';
import { raceTimeout } from '../../shared/utils/async-utils';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/shared';

// module-level tagged logger
const log = createTaggedLogger(LogTags.ENGINE);

// lazy load Safe Mode compiler - only loaded when Safe Mode is actually used
const getCompileSafeModule = createLazyImport(
  () => import('../compilation/safe/compile')
);
import { ErrorContext } from '../../shared/errors';
import { getTailwindProcessor, getErrorReporter } from '../../app/services';
import {
  TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS,
  MDX_COMPILATION_TIMEOUT_MS,
} from '../../shared/constants';
import type { Preview, WebviewHandle } from './preview-manager';
import type { TrustState } from '@mdx-preview/shared';
import type { CompilerConfig, TailwindConfig } from '../types';

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

// evaluation engine - handle core evaluation logic for MDX content
export class EvaluationEngine {
  // evaluate MDX in Trusted Mode (transpile to executable JS w/ React components)
  async evaluateTrusted(
    text: string,
    fsPath: string,
    preview: Preview,
    compilerConfig: CompilerConfig
  ): Promise<TrustedEvaluationResult> {
    log.debug('evaluateTrusted called');

    log.debug('Transforming entry...');
    // transformEntry: return esmCode for import extraction (timeout to prevent hang)
    const transformResult = await raceTimeout(
      transformEntry(text, fsPath, preview, compilerConfig),
      {
        timeoutMs: MDX_COMPILATION_TIMEOUT_MS,
        behavior: 'return-null',
      }
    );

    if (transformResult === null) {
      throw new Error(
        `MDX compilation timed out after ${MDX_COMPILATION_TIMEOUT_MS / 1000}s`
      );
    }

    const { code, esmCode, frontmatter } = transformResult;
    log.debug(`Transform complete, code length: ${code.length}`);

    // use async fs.promises.realpath instead of sync version
    const entryFilePath = await fs.promises.realpath(fsPath);

    // extract dependencies from ESM code (before CommonJS conversion for better parsing)
    const dependencies = await extractImportSpecifiers(esmCode);
    log.debug(`Dependencies: ${dependencies.join(', ')}`);

    return {
      code,
      entryFilePath,
      dependencies,
      frontmatter,
    };
  }

  // evaluate MDX content in Safe Mode - compile MDX to sanitized HTML w/o code execution
  async evaluateSafe(
    text: string,
    compilerConfig: CompilerConfig
  ): Promise<SafeEvaluationResult> {
    log.debug('evaluateSafe called');

    log.debug('Loading Safe Mode compiler...');
    const { compileSafe } = await getCompileSafeModule();

    log.debug('Compiling to safe HTML...');
    const { html, frontmatter } = await compileSafe(text, compilerConfig);
    log.debug(`Safe HTML compiled, length: ${html.length}`);

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
      log.debug('TAILWIND: Starting background compilation');

      const compilationTimeout =
        params.tailwindConfig.compilationTimeout ??
        TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS;

      const result = await raceTimeout(
        getTailwindProcessor().process({
          preview,
          mdxText: params.mdxText,
          entryFilePath: params.entryFilePath,
          entryFileDependencies: params.entryFileDependencies,
          trustState: params.trustState,
          tailwindConfig: params.tailwindConfig,
        }),
        {
          timeoutMs: compilationTimeout,
          behavior: 'return-null',
        }
      );

      if (result === null) {
        log.debug('TAILWIND: Compilation timed out');
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
    } catch (error: unknown) {
      getErrorReporter().report(error, {
        context: ErrorContext.Tailwind,
        showNotification: true,
        metadata: { entryFilePath: params.entryFilePath },
      });
    }
  }
}

const evaluationEngineSingleton = createSingleton(() => new EvaluationEngine());

// get the EvaluationEngine singleton instance
export function getEvaluationEngine(): EvaluationEngine {
  return evaluationEngineSingleton.get();
}
