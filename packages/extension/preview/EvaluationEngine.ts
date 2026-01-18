// packages/extension/preview/EvaluationEngine.ts
// evaluation logic for MDX content - handles both Trusted & Safe modes

import * as fs from 'fs';
import { transformEntry } from '../module-fetcher/transform';
import { extractImportSpecifiers } from '../module-fetcher/import-extractor';
import { compileToSafeHTML } from '../transpiler/mdx/mdx-safe';
import { debug } from '../logging';
import { ErrorContext } from '../errors';
import {
  getTailwindProcessor,
  getErrorReporter,
  getConfigManager,
} from '../services';
import { TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS } from '../constants';
import type { Preview, WebviewHandle } from './preview-manager';
import type { TrustState } from '@mdx-preview/shared-types';
import type { ResolvedConfig } from './config';

// result of evaluating MDX in Trusted Mode
export interface TrustedEvaluationResult {
  // transpiled JavaScript code
  code: string;
  // resolved file path
  entryFilePath: string;
  // extracted dependencies
  dependencies: string[];
  // parsed frontmatter from MDX
  frontmatter: Record<string, unknown> | undefined;
}

// result of evaluating MDX in Safe Mode
export interface SafeEvaluationResult {
  // sanitized HTML content
  html: string;
  // parsed frontmatter from MDX
  frontmatter: Record<string, unknown> | undefined;
}

// parameters for Tailwind CSS processing
export interface TailwindProcessParams {
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
}

// * EvaluationEngine handles the core evaluation logic for MDX content
// extracted from evaluate-in-webview.ts for better testability
export class EvaluationEngine {
  // evaluate MDX content in Trusted Mode
  // transpiles MDX to executable JavaScript w/ full React component support
  async evaluateTrusted(
    text: string,
    fsPath: string,
    preview: Preview
  ): Promise<TrustedEvaluationResult> {
    debug('[ENGINE] evaluateTrusted called');

    debug('[ENGINE] Transforming entry...');
    const { code, frontmatter } = await transformEntry(text, fsPath, preview);
    debug(`[ENGINE] Transform complete, code length: ${code.length}`);

    // Use async fs.promises.realpath instead of sync version
    const entryFilePath = await fs.promises.realpath(fsPath);

    // extract dependencies using shared utility (ESM-first w/ CJS fallback)
    const dependencies = await extractImportSpecifiers(code);
    debug(`[ENGINE] Dependencies: ${dependencies.join(', ')}`);

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
    debug('[ENGINE] evaluateSafe called');

    debug('[ENGINE] Compiling to safe HTML...');
    const { html, frontmatter } = await compileToSafeHTML(
      text,
      mdxPreviewConfig
    );
    debug(`[ENGINE] Safe HTML compiled, length: ${html.length}`);

    return { html, frontmatter };
  }

  // process Tailwind CSS asynchronously (non-blocking)
  // called after the initial preview update to avoid blocking render
  async processTailwindAsync(
    preview: Preview,
    params: TailwindProcessParams,
    requestId: number,
    webviewHandle: WebviewHandle
  ): Promise<void> {
    try {
      debug('[ENGINE/TAILWIND] Starting background compilation');

      const compilationTimeout =
        getConfigManager().get('tailwind.compilationTimeout', preview.doc.uri) ??
        TAILWIND_COMPILATION_TIMEOUT_DEFAULT_MS;

      const result = await this.withTimeout(
        getTailwindProcessor().process({
          preview,
          mdxText: params.mdxText,
          entryFilePath: params.entryFilePath,
          entryFileDependencies: params.entryFileDependencies,
          trustState: params.trustState,
        }),
        compilationTimeout
      );

      if (result === null) {
        debug('[ENGINE/TAILWIND] Compilation timed out');
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
