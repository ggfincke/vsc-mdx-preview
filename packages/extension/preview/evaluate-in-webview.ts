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

// evaluate MDX content in webview (routes to Trusted/Safe mode based on trust state)
export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  debug(`[EVALUATE] evaluateInWebview called for: ${fsPath}`);
  const { webviewHandle } = preview;
  const engine = getEvaluationEngine();

  // use document-specific trust check (includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(preview.doc.uri);
  debug(formatTrustStateForDebug('EVALUATE', trustState));

  try {
    performance.mark('preview/start');

    debug('[EVALUATE] Waiting for webviewHandshakePromise...');
    await preview.webviewHandshakePromise;
    debug('[EVALUATE] Handshake complete!');

    // push initial config after handshake
    preview.onWebviewReady();

    // send trust state to webview
    debug('[EVALUATE] Sending trust state to webview');
    webviewHandle.setTrustState(trustState);

    // send framework info so webview can lazy-load the right shims
    const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
    if (frameworkInfo.framework !== 'generic') {
      debug(`[EVALUATE] Sending framework to webview: ${frameworkInfo.framework}`);
      webviewHandle.setFramework(frameworkInfo.framework);
    }

    if (trustState.canExecute) {
      // trusted mode: full code evaluation
      debug('[EVALUATE] Using Trusted Mode');

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

      debug('[EVALUATE] Calling webviewHandle.updatePreview');
      webviewHandle.updatePreview(
        result.code,
        result.entryFilePath,
        result.dependencies
      );
      debug('[EVALUATE] updatePreview called');

      // compile Tailwind CSS after preview update (non-blocking)
      const tailwindRequestId = preview.nextTailwindRequestId();
      const effectiveConfig = buildEffectivePreviewConfig({
        docUri: preview.doc.uri,
        docFsPath: fsPath,
        frontmatter: result.frontmatter,
      });
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
      // safe mode: static HTML rendering
      debug('[EVALUATE] Using Safe Mode');

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

      debug('[EVALUATE] Calling webviewHandle.updatePreviewSafe');
      webviewHandle.updatePreviewSafe(result.html);
      debug('[EVALUATE] updatePreviewSafe called');
    }

    debug('[EVALUATE] evaluateInWebview complete');
  } catch (error) {
    debug(
      `[EVALUATE] ERROR: ${extractErrorMessage(error)}`
    );
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
      debug('[EVALUATE] Sending Nextra meta to webview:', mergedMeta);
      webviewHandle.setNextraMeta(mergedMeta);
    }
  } catch (err) {
    // non-fatal error, log & continue
    debug(`[EVALUATE] Error resolving Nextra meta: ${err}`);
  }
}
