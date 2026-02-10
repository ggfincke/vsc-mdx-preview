// packages/extension/preview/evaluate-in-webview.ts
// evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import { Preview } from './preview-manager';
import { createTaggedLogger } from '../../shared/logging/logger';
import { ErrorContext } from '../../shared/errors';
import { LogTags, formatTrustStateForDebug } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';

// module-level tagged logger
const log = createTaggedLogger(LogTags.EVALUATE);
import {
  getTrustManager,
  getErrorReporter,
  getFrameworkDetector,
  getTailwindProcessor,
} from '../../app/services';
import { getEvaluationEngine } from './EvaluationEngine';
import {
  resolveNextraMeta,
  mergeNextraMeta,
} from '../framework/nextra/MetaResolver';
import { extractNextraFrontmatter } from 'mdx-tools/compiler';
import {
  buildEffectivePreviewConfig,
  toCompilerConfig,
} from '../../shared/config/EffectivePreviewConfig';
import {
  detectComponents,
  getUsedGenericComponents,
} from '../diagnostics/ComponentDetector';
import type { TailwindProfileDetectionResult } from '../types';

// apply frontmatter overrides & send Nextra metadata
function applyFrontmatterAndMeta(
  preview: Preview,
  webviewHandle: Preview['webviewHandle'],
  fsPath: string,
  frontmatter: Record<string, unknown> | undefined
): void {
  // push theme state w/ frontmatter overrides
  if (frontmatter) {
    preview.pushThemeState(frontmatter);
  }

  // for Nextra projects, resolve & send page metadata
  sendNextraMetaIfNeeded(preview, webviewHandle, fsPath, frontmatter);
}

// clear stale Tailwind CSS (when Tailwind is disabled or in Safe Mode)
function clearTailwindCss(
  preview: Preview,
  webviewHandle: Preview['webviewHandle']
): void {
  const tailwindRequestId = preview.nextTailwindRequestId();
  if (preview.isTailwindRequestCurrent(tailwindRequestId)) {
    preview.updateTailwindWatchFiles([]);
    webviewHandle.setTailwindBrowserCss('');
    webviewHandle.setTailwindCss('');
  }
}

// evaluate MDX content in webview (route to Trusted/Safe mode based on trust state)
export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  log.debug(`evaluateInWebview called for: ${fsPath}`);
  const { webviewHandle } = preview;
  const engine = getEvaluationEngine();

  // use document-specific trust check (includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(preview.doc.uri);
  log.debug(formatTrustStateForDebug(trustState));

  // build effective config early to check for per-project enableScripts override
  const effectiveConfig = buildEffectivePreviewConfig({
    docUri: preview.doc.uri,
    docFsPath: fsPath,
  });
  const compilerConfig = toCompilerConfig(effectiveConfig, {
    docUri: preview.doc.uri,
    docFsPath: fsPath,
  });

  // effective canExecute: trust state & per-project enableScripts (config file can force Safe Mode)
  const canExecute = trustState.canExecute && effectiveConfig.enableScripts;
  log.debug(
    `Effective canExecute: ${canExecute} (trustState.canExecute=${trustState.canExecute}, effectiveConfig.enableScripts=${effectiveConfig.enableScripts})`
  );

  try {
    let tailwindProfileHint: TailwindProfileDetectionResult | undefined;
    const tailwindEnabled = effectiveConfig.tailwind.enabled !== 'disabled';
    const shouldProcessTailwind = canExecute && tailwindEnabled;

    if (tailwindEnabled) {
      tailwindProfileHint = await getTailwindProcessor().detectProfile({
        preview,
        mdxText: text,
        tailwindConfig: effectiveConfig.tailwind,
      });

      if (tailwindProfileHint.profile === 'advanced') {
        const fallbackReason = tailwindProfileHint.reason;
        const fallbackKey = canExecute
          ? `trusted:${fallbackReason}`
          : `safe:${fallbackReason}`;
        if (preview.markTailwindFallbackReason(fallbackKey)) {
          if (canExecute) {
            log.warn(`Tailwind advanced fallback active: ${fallbackReason}`);
            vscode.window.setStatusBarMessage(
              `MDX Preview Tailwind: advanced fallback active (${fallbackReason})`,
              8000
            );
          } else {
            log.warn(
              `Tailwind advanced profile detected in Safe Mode: ${fallbackReason}`
            );
            vscode.window.setStatusBarMessage(
              `MDX Preview Tailwind: advanced config detected (${fallbackReason}); enable Trusted Mode for full Tailwind support`,
              10000
            );
          }
        }
      } else {
        preview.clearTailwindFallbackReason();
      }
    } else {
      preview.clearTailwindFallbackReason();
    }

    const needsBrowserRuntime =
      tailwindProfileHint?.profile === 'browser' && shouldProcessTailwind;
    if (preview.setTailwindBrowserRuntimeEnabled(needsBrowserRuntime)) {
      await preview.refreshWebview();
      return;
    }

    performance.mark('preview/start');

    log.debug('Waiting for webviewHandshakePromise...');
    await preview.webviewHandshakePromise;
    log.debug('Handshake complete!');

    // push initial config after handshake
    preview.onWebviewReady();

    // send trust state to webview
    log.debug('Sending trust state to webview');
    webviewHandle.setTrustState(trustState);

    // send framework info so webview can lazy-load the right shims
    const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
    if (frameworkInfo.framework !== 'generic') {
      log.debug(`Sending framework to webview: ${frameworkInfo.framework}`);
      webviewHandle.setFramework(frameworkInfo.framework);
    }

    if (canExecute) {
      // trusted mode: full code evaluation
      log.debug('Using Trusted Mode');

      const result = await engine.evaluateTrusted(
        text,
        fsPath,
        preview,
        compilerConfig
      );

      // update dependency watcher w/ local imports
      preview.updateDependencies(result.dependencies);

      applyFrontmatterAndMeta(
        preview,
        webviewHandle,
        fsPath,
        result.frontmatter
      );

      // detect used generic components for conditional shim preloading
      try {
        // pass URI for caching (no config components needed)
        const detectionResult = await detectComponents(
          text,
          { detectImports: true },
          new Set(),
          preview.doc.uri.toString()
        );
        const usedGenericComponents = getUsedGenericComponents(detectionResult);
        if (usedGenericComponents.length > 0) {
          log.debug(
            `Used generic components: ${usedGenericComponents.join(', ')}`
          );
          webviewHandle.setUsedComponents(usedGenericComponents);
        }
      } catch (err) {
        // detection failure is non-fatal - webview will load all generic shims as fallback
        log.debug(`Component detection failed: ${extractErrorMessage(err)}`);
      }

      log.debug('Calling webviewHandle.updatePreview');
      webviewHandle.updatePreview(
        result.code,
        result.entryFilePath,
        result.dependencies
      );
      log.debug('updatePreview called');

      // compile Tailwind CSS after preview update (skip if explicitly disabled)
      if (tailwindEnabled) {
        const tailwindRequestId = preview.nextTailwindRequestId();
        void engine.processTailwindAsync(
          preview,
          {
            mdxText: text,
            entryFilePath: result.entryFilePath,
            entryFileDependencies: result.dependencies,
            trustState,
            tailwindConfig: effectiveConfig.tailwind,
            profileHint: tailwindProfileHint,
          },
          tailwindRequestId,
          webviewHandle
        );
      } else {
        // clear any stale Tailwind CSS when disabled
        clearTailwindCss(preview, webviewHandle);
      }
    } else {
      // safe mode: static HTML rendering
      log.debug('Using Safe Mode');

      // disable Tailwind in safe mode
      clearTailwindCss(preview, webviewHandle);

      const result = await engine.evaluateSafe(text, compilerConfig);

      applyFrontmatterAndMeta(
        preview,
        webviewHandle,
        fsPath,
        result.frontmatter
      );

      log.debug('Calling webviewHandle.updatePreviewSafe');
      webviewHandle.updatePreviewSafe(result.html);
      log.debug('updatePreviewSafe called');
    }

    log.debug('evaluateInWebview complete');
  } catch (error: unknown) {
    log.debug(`ERROR: ${extractErrorMessage(error)}`);
    getErrorReporter().report(error, {
      context: ErrorContext.Transpile,
      showInWebview: true,
      webviewHandle,
      metadata: { fsPath },
    });
  }
}

// resolve & send Nextra page metadata (only run for Nextra projects)
function sendNextraMetaIfNeeded(
  preview: Preview,
  webviewHandle: Preview['webviewHandle'],
  fsPath: string,
  frontmatter: Record<string, unknown> | undefined
): void {
  try {
    const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
    if (frameworkInfo.framework !== 'nextra') {
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      preview.doc.uri
    );
    if (!workspaceFolder) {
      return;
    }

    // resolve metadata from _meta.json
    const metaFromJson = resolveNextraMeta(fsPath, workspaceFolder.uri.fsPath);

    // extract Nextra-specific frontmatter
    const metaFromFrontmatter = extractNextraFrontmatter(frontmatter ?? {});

    // merge (frontmatter overrides _meta.json)
    const mergedMeta = mergeNextraMeta(metaFromJson, metaFromFrontmatter);

    // only send if we have meaningful metadata
    if (Object.keys(mergedMeta).length > 0) {
      log.debug('Sending Nextra meta to webview:', mergedMeta);
      webviewHandle.setNextraMeta(mergedMeta);
    }
  } catch (err) {
    // non-fatal error, log & continue
    log.debug(`Error resolving Nextra meta: ${extractErrorMessage(err)}`);
  }
}
