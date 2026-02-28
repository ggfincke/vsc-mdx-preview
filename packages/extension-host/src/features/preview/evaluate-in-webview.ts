// packages/extension-host/src/features/preview/evaluate-in-webview.ts
// evaluate MDX content in webview (orchestrates Trusted/Safe mode evaluation)

import { performance } from 'perf_hooks';
import { createTaggedLogger } from '../../shared/logging/logger';
import { ErrorContext } from '../../shared/errors';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { getErrorReporter, getFrameworkDetector } from '../../app/services';
import { getEvaluationEngine } from './EvaluationEngine';
import {
  evaluateSafeStage,
  evaluateTrustedStage,
  postPushArtifacts,
  prepareEvaluationContext,
  type PreparedEvaluationContext,
} from './evaluation';
import type { Preview } from './Preview';

const log = createTaggedLogger(LogTags.EVALUATE);

export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  log.debug(`evaluateInWebview called for: ${fsPath}`);
  const engine = getEvaluationEngine();

  try {
    const prepared = await prepareEvaluationContext(
      preview,
      text,
      fsPath,
      engine
    );
    if (prepared.kind === 'refresh-required') {
      await preview.refreshWebview();
      return;
    }

    const context = prepared.context;

    performance.mark('preview/start');

    await waitForHandshakeAndPushBaseState(context);

    const stageResult = context.canExecute
      ? await evaluateTrustedStage(context)
      : await evaluateSafeStage(context);

    await postPushArtifacts(context, stageResult);

    log.debug('evaluateInWebview complete');
  } catch (error: unknown) {
    log.debug(`ERROR: ${extractErrorMessage(error)}`);
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
): Promise<void> {
  const { preview, trustState } = context;
  const { webviewHandle } = preview;

  log.debug('Waiting for webviewHandshakePromise...');
  await preview.webviewHandshakePromise;
  log.debug('Handshake complete!');

  preview.onWebviewReady();

  log.debug('Sending trust state to webview');
  webviewHandle.setTrustState(trustState);
  preview.pushRuntimeConfiguration();

  const frameworkInfo = getFrameworkDetector().getFramework(preview.doc.uri);
  if (frameworkInfo.framework === 'generic') {
    return;
  }

  log.debug(`Sending framework to webview: ${frameworkInfo.framework}`);
  webviewHandle.setFramework(frameworkInfo.framework);
}
