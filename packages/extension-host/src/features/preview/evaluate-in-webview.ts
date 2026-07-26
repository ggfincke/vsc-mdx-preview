// packages/extension-host/src/features/preview/evaluate-in-webview.ts
// evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';
import { createTaggedLogger } from '../../shared/logging/logger';
import { ErrorContext } from '../../shared/errors';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { getErrorReporter, getFrameworkDetector } from '../../app/services';
import { getEvaluationEngine } from './EvaluationEngine';
import { HandshakeTimeoutError } from './PreviewInitializer';
import { postPushArtifacts } from './evaluation/post-push-artifacts';
import { prepareEvaluationContext } from './evaluation/prepare-evaluation-context';
import type { PreparedEvaluationContext } from './evaluation/types';
import type { DocumentAnalysisIdentity } from '../../shared/mdx-analysis/document-analysis';
import type { Preview } from './Preview';

const log = createTaggedLogger(LogTags.EVALUATE);

// dedupe: one visible handshake-failure notification at a time
let handshakeNotificationVisible = false;
const readyHandshakeByPreview = new WeakMap<Preview, Promise<void>>();

// webview never booted, so an in-webview error goes nowhere; notify w/ recovery
function notifyHandshakeTimeout(preview: Preview): void {
  if (handshakeNotificationVisible) {
    return;
  }
  handshakeNotificationVisible = true;
  void vscode.window
    .showErrorMessage(
      'MDX Preview failed to initialize. The preview panel may be blank.',
      'Retry'
    )
    .then((choice) => {
      handshakeNotificationVisible = false;
      if (choice === 'Retry') {
        void preview.refreshWebview();
      }
    });
}

export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string,
  isCurrent?: () => boolean,
  documentIdentity: DocumentAnalysisIdentity = {
    uri: preview.doc.uri.toString(),
    version: preview.doc.version,
  }
): Promise<void> {
  log.debug(`evaluateInWebview called for: ${fsPath}`);
  const engine = getEvaluationEngine();
  const stale = () => isCurrent?.() === false;
  const current = () => !stale();

  try {
    const prepared = await prepareEvaluationContext(
      preview,
      text,
      fsPath,
      engine,
      current,
      documentIdentity
    );
    if (prepared.kind === 'superseded') {
      return;
    }
    if (prepared.kind === 'refresh-required') {
      if (stale()) {
        return;
      }
      await preview.refreshWebview();
      return;
    }

    const context = prepared.context;

    performance.mark('preview/start');

    if (!(await waitForHandshakeAndPushBaseState(context))) {
      log.debug('evaluateInWebview: superseded before compile, skipping');
      return;
    }

    const stageResult = context.canExecute
      ? {
          kind: 'trusted' as const,
          result: await context.engine.evaluateTrusted(
            context.text,
            context.fsPath,
            context.preview,
            context.compilerConfig
          ),
        }
      : {
          kind: 'safe' as const,
          result: await context.engine.evaluateSafe(
            context.text,
            context.compilerConfig
          ),
        };

    // drop stale results: never push an older compile over a newer render
    if (stale()) {
      log.debug('evaluateInWebview: superseded after compile, dropping result');
      return;
    }

    await postPushArtifacts(context, stageResult);

    log.debug('evaluateInWebview complete');
  } catch (error: unknown) {
    log.debug(`ERROR: ${extractErrorMessage(error)}`);
    // stale failure is not the user's current state - don't flash an old error
    if (stale()) {
      return;
    }
    if (error instanceof HandshakeTimeoutError) {
      notifyHandshakeTimeout(preview);
      return;
    }
    preview.pushThemeState();
    getErrorReporter().report(error, {
      context: ErrorContext.Transpile,
      showInWebview: true,
      webviewHandle: preview.webviewHandle,
      metadata: { fsPath },
    });
  }
}

async function waitForHandshakeAndPushBaseState(
  context: PreparedEvaluationContext
): Promise<boolean> {
  const { preview, trustState, isCurrent } = context;
  const { webviewHandle } = preview;
  const handshakePromise = preview.webviewHandshakePromise;

  log.debug('Waiting for webviewHandshakePromise...');
  await handshakePromise;
  log.debug('Handshake complete!');

  if (!isCurrent()) {
    return false;
  }
  if (readyHandshakeByPreview.get(preview) !== handshakePromise) {
    readyHandshakeByPreview.set(preview, handshakePromise);
    preview.onWebviewReady();
  }

  log.debug('Sending trust state to webview');
  await webviewHandle.setTrustState(trustState);
  if (!isCurrent()) {
    return false;
  }
  preview.pushRuntimeConfiguration();

  const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
  if (frameworkInfo.framework === 'generic') {
    return true;
  }

  log.debug(`Sending framework to webview: ${frameworkInfo.framework}`);
  webviewHandle.setFramework(frameworkInfo.framework);
  return true;
}
