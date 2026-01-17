// packages/extension/preview/evaluate-in-webview.ts
// evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import { Preview } from './preview-manager';
import { debug } from '../logging';
import { ErrorContext } from '../errors';
import {
  getTrustManager,
  getErrorReporter,
  getFrameworkDetector,
} from '../services';
import { getEvaluationEngine } from './EvaluationEngine';
import { resolveNextraMeta, mergeNextraMeta } from '../nextra/MetaResolver';
import { extractNextraFrontmatter } from '../transpiler/mdx/mdx-common';

// evaluate MDX content in webview (routes to Trusted/Safe mode based on trust state)
export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  debug(`[EVALUATE] evaluateInWebview called for: ${fsPath}`);
  const { webviewHandle } = preview;
  const engine = getEvaluationEngine();

  // Use document-specific trust check (includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(preview.doc.uri);
  debug(
    `[EVALUATE] Trust state: canExecute=${trustState.canExecute}, ` +
      `workspaceTrusted=${trustState.workspaceTrusted}, ` +
      `scriptsEnabled=${trustState.scriptsEnabled}`
  );

  try {
    performance.mark('preview/start');

    debug('[EVALUATE] Waiting for webviewHandshakePromise...');
    await preview.webviewHandshakePromise;
    debug('[EVALUATE] Handshake complete!');

    // Push initial config after handshake
    preview.onWebviewReady();

    // Send trust state to webview
    debug('[EVALUATE] Sending trust state to webview');
    webviewHandle.setTrustState(trustState);

    if (trustState.canExecute) {
      // Trusted Mode: full code evaluation
      debug('[EVALUATE] Using Trusted Mode');

      const result = await engine.evaluateTrusted(text, fsPath, preview);

      // update dependency watcher w/ local imports
      preview.updateDependencies(result.dependencies);

      // push theme state w/ frontmatter overrides
      if (result.frontmatter) {
        preview.pushThemeState(result.frontmatter);
      }

      // For Nextra projects, resolve and send page metadata
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

      // Compile Tailwind CSS after preview update (non-blocking)
      const tailwindRequestId = preview.nextTailwindRequestId();
      void engine.processTailwindAsync(
        preview,
        {
          mdxText: text,
          entryFilePath: result.entryFilePath,
          entryFileDependencies: result.dependencies,
          trustState,
        },
        tailwindRequestId,
        webviewHandle
      );
    } else {
      // Safe Mode: static HTML rendering
      debug('[EVALUATE] Using Safe Mode');

      // Disable Tailwind in Safe Mode
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

      // For Nextra projects, resolve and send page metadata
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
      `[EVALUATE] ERROR: ${error instanceof Error ? error.message : String(error)}`
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

    // Resolve metadata from _meta.json
    const metaFromJson = resolveNextraMeta(fsPath, workspaceFolder.uri.fsPath);

    // Extract Nextra-specific frontmatter
    const metaFromFrontmatter = extractNextraFrontmatter(frontmatter ?? {});

    // Merge (frontmatter overrides _meta.json)
    const mergedMeta = mergeNextraMeta(metaFromJson, metaFromFrontmatter);

    // Only send if we have meaningful metadata
    if (Object.keys(mergedMeta).length > 0) {
      debug('[EVALUATE] Sending Nextra meta to webview:', mergedMeta);
      webviewHandle.setNextraMeta(mergedMeta);
    }
  } catch (err) {
    // Non-fatal error, just log and continue
    debug(`[EVALUATE] Error resolving Nextra meta: ${err}`);
  }
}
