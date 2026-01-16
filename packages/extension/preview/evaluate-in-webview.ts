// packages/extension/preview/evaluate-in-webview.ts
// Evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import { performance } from 'perf_hooks';
import { Preview } from './preview-manager';
import { debug } from '../logging';
import { ErrorContext } from '../errors';
import { getTrustManager, getErrorReporter } from '../services';
import { getEvaluationEngine } from './EvaluationEngine';

// evaluate MDX content in the webview
// routes to Trusted Mode (full code execution) or Safe Mode (static HTML)
// based on the document's trust state
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
