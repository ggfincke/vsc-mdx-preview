// packages/extension/preview/evaluate-in-webview.ts
// evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import { Preview } from './preview-manager';
import { debug } from '../logging';
import { ErrorContext } from '../errors';
import {
  extractErrorMessage,
  formatTrustStateForDebug,
  LogTags,
} from '@mdx-preview/shared';
import {
  getTrustManager,
  getErrorReporter,
  getFrameworkDetector,
} from '../services';
import { getEvaluationEngine } from './EvaluationEngine';
import { resolveNextraMeta, mergeNextraMeta } from '../nextra/MetaResolver';
import { extractNextraFrontmatter } from '../compiler/shared/mdx-common';
import { buildEffectivePreviewConfig } from '../config/EffectivePreviewConfig';
import {
  detectComponents,
  getUsedGenericComponents,
} from '../diagnostics/ComponentDetector';

// evaluate MDX content in webview (routes to Trusted/Safe mode based on trust state)
export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  debug(`[${LogTags.EVALUATE}] evaluateInWebview called for: ${fsPath}`);
  const { webviewHandle } = preview;
  const engine = getEvaluationEngine();

  // use document-specific trust check (includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(preview.doc.uri);
  debug(formatTrustStateForDebug(LogTags.EVALUATE, trustState));

  try {
    performance.mark('preview/start');

    debug(`[${LogTags.EVALUATE}] Waiting for webviewHandshakePromise...`);
    await preview.webviewHandshakePromise;
    debug(`[${LogTags.EVALUATE}] Handshake complete!`);

    // push initial config after handshake
    preview.onWebviewReady();

    // send trust state to webview
    debug(`[${LogTags.EVALUATE}] Sending trust state to webview`);
    webviewHandle.setTrustState(trustState);

    // send framework info so webview can lazy-load the right shims
    const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
    if (frameworkInfo.framework !== 'generic') {
      debug(
        `[${LogTags.EVALUATE}] Sending framework to webview: ${frameworkInfo.framework}`
      );
      webviewHandle.setFramework(frameworkInfo.framework);
    }

    if (trustState.canExecute) {
      // trusted mode: full code evaluation
      debug(`[${LogTags.EVALUATE}] Using Trusted Mode`);

      const result = await engine.evaluateTrusted(text, fsPath, preview);

      // update dependency watcher w/ local imports
      preview.updateDependencies(result.dependencies);

      // push theme state w/ frontmatter overrides
      if (result.frontmatter) {
        preview.pushThemeState(result.frontmatter);
      }

      // for Nextra projects, resolve & send page metadata
      sendNextraMetaIfNeeded(
        preview,
        webviewHandle,
        fsPath,
        result.frontmatter
      );

      // detect used generic components for conditional shim preloading
      try {
        // no config components needed here
        // pass URI for caching
        const detectionResult = await detectComponents(
          text,
          { detectImports: true },
          new Set(),
          preview.doc.uri.toString()
        );
        const usedGenericComponents = getUsedGenericComponents(detectionResult);
        if (usedGenericComponents.length > 0) {
          debug(
            `[${LogTags.EVALUATE}] Used generic components: ${usedGenericComponents.join(', ')}`
          );
          webviewHandle.setUsedComponents(usedGenericComponents);
        }
      } catch (err) {
        // detection failure is non-fatal - webview will load all generic shims as fallback
        debug(
          `[${LogTags.EVALUATE}] Component detection failed: ${extractErrorMessage(err)}`
        );
      }

      debug(`[${LogTags.EVALUATE}] Calling webviewHandle.updatePreview`);
      webviewHandle.updatePreview(
        result.code,
        result.entryFilePath,
        result.dependencies
      );
      debug(`[${LogTags.EVALUATE}] updatePreview called`);

      // build effective config for Tailwind check
      const effectiveConfig = buildEffectivePreviewConfig({
        docUri: preview.doc.uri,
        docFsPath: fsPath,
        frontmatter: result.frontmatter,
      });

      // compile Tailwind CSS after preview update (non-blocking)
      // skip processing entirely when explicitly disabled to avoid overhead
      if (effectiveConfig.tailwind.enabled !== 'disabled') {
        const tailwindRequestId = preview.nextTailwindRequestId();
        void engine.processTailwindAsync(
          preview,
          {
            mdxText: text,
            entryFilePath: result.entryFilePath,
            entryFileDependencies: result.dependencies,
            trustState,
            tailwindConfig: effectiveConfig.tailwind,
          },
          tailwindRequestId,
          webviewHandle
        );
      } else {
        // clear any stale Tailwind CSS when disabled
        const tailwindRequestId = preview.nextTailwindRequestId();
        if (preview.isTailwindRequestCurrent(tailwindRequestId)) {
          preview.updateTailwindWatchFiles([]);
          webviewHandle.setTailwindCss('');
        }
      }
    } else {
      // safe mode: static HTML rendering
      debug(`[${LogTags.EVALUATE}] Using Safe Mode`);

      // disable Tailwind in safe mode
      const tailwindRequestId = preview.nextTailwindRequestId();
      if (preview.isTailwindRequestCurrent(tailwindRequestId)) {
        preview.updateTailwindWatchFiles([]);
        webviewHandle.setTailwindCss('');
      }

      const result = await engine.evaluateSafe(text, preview.mdxPreviewConfig);

      // push theme state w/ frontmatter overrides
      if (result.frontmatter) {
        preview.pushThemeState(result.frontmatter);
      }

      // for Nextra projects, resolve & send page metadata
      sendNextraMetaIfNeeded(
        preview,
        webviewHandle,
        fsPath,
        result.frontmatter
      );

      debug(`[${LogTags.EVALUATE}] Calling webviewHandle.updatePreviewSafe`);
      webviewHandle.updatePreviewSafe(result.html);
      debug(`[${LogTags.EVALUATE}] updatePreviewSafe called`);
    }

    debug(`[${LogTags.EVALUATE}] evaluateInWebview complete`);
  } catch (error) {
    debug(`[${LogTags.EVALUATE}] ERROR: ${extractErrorMessage(error)}`);
    getErrorReporter().report(error, {
      context: ErrorContext.Transpile,
      showInWebview: true,
      webviewHandle,
      metadata: { fsPath },
    });
  }
}

// resolve & send Nextra page metadata (only runs for Nextra projects)
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
      debug(
        `[${LogTags.EVALUATE}] Sending Nextra meta to webview:`,
        mergedMeta
      );
      webviewHandle.setNextraMeta(mergedMeta);
    }
  } catch (err) {
    // non-fatal error, log & continue
    debug(
      `[${LogTags.EVALUATE}] Error resolving Nextra meta: ${extractErrorMessage(err)}`
    );
  }
}
