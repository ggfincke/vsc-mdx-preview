// packages/extension-host/src/features/preview/evaluation/prepare-evaluation-context.ts
// preparation stage for evaluate-in-webview (trust/config/tailwind routing)

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags, formatTrustStateForDebug } from '@mdx-preview/contracts';
import { getTailwindProcessor, getTrustManager } from '../../../app/services';
import {
  buildEffectivePreviewConfig,
  toCompilerConfig,
} from '../configuration/EffectivePreviewConfig';
import { EXTENSION_DISPLAY_NAME } from '../../../shared/constants';
import type { DocumentAnalysisIdentity } from '../../../shared/mdx-analysis/document-analysis';
import type { EvaluationEngine } from '../EvaluationEngine';
import type { Preview } from '../Preview';
import type { TailwindProfileDetectionResult } from '../../tailwind/types/detector';
import type {
  PreparedEvaluationContext,
  PreparedEvaluationResult,
} from './types';

const log = createTaggedLogger(LogTags.EVALUATE);

export async function prepareEvaluationContext(
  preview: Preview,
  text: string,
  fsPath: string,
  engine: EvaluationEngine,
  isCurrent: () => boolean,
  documentIdentity: DocumentAnalysisIdentity
): Promise<PreparedEvaluationResult> {
  const trustState = getTrustManager().getStateForDocument(preview.doc.uri);
  log.debug(formatTrustStateForDebug(trustState));

  const effectiveConfig = buildEffectivePreviewConfig({
    docUri: preview.doc.uri,
    docFsPath: fsPath,
  });
  const compilerConfig = toCompilerConfig(effectiveConfig, {
    docUri: preview.doc.uri,
    docFsPath: fsPath,
  });

  const canExecute = trustState.canExecute && effectiveConfig.enableScripts;
  log.debug(
    `Effective canExecute: ${canExecute} (trustState.canExecute=${trustState.canExecute}, effectiveConfig.enableScripts=${effectiveConfig.enableScripts})`
  );

  const tailwindEnabled = effectiveConfig.tailwind.enabled !== 'disabled';
  const shouldProcessTailwind = canExecute && tailwindEnabled;
  let tailwindProfileHint: TailwindProfileDetectionResult | undefined;

  if (shouldProcessTailwind) {
    tailwindProfileHint = await getTailwindProcessor().detectProfile({
      preview,
      mdxText: text,
      tailwindConfig: effectiveConfig.tailwind,
    });

    if (!isCurrent()) {
      return { kind: 'superseded' };
    }

    if (tailwindProfileHint.profile === 'advanced') {
      const fallbackReason = tailwindProfileHint.reason;
      const fallbackKey = canExecute
        ? `trusted:${fallbackReason}`
        : `safe:${fallbackReason}`;
      if (preview.markTailwindFallbackReason(fallbackKey)) {
        showAdvancedProfileStatusBarMessage(canExecute, fallbackReason);
      }
    } else {
      preview.clearTailwindFallbackReason();
    }
  } else {
    if (!isCurrent()) {
      return { kind: 'superseded' };
    }
    preview.clearTailwindFallbackReason();
  }

  const needsBrowserRuntime =
    tailwindProfileHint?.profile === 'browser' &&
    shouldProcessTailwind &&
    (effectiveConfig.tailwind.enabled === 'enabled' ||
      tailwindProfileHint.hasTailwindInput);
  if (!isCurrent()) {
    return { kind: 'superseded' };
  }
  if (preview.setTailwindBrowserRuntimeEnabled(needsBrowserRuntime)) {
    return { kind: 'refresh-required' };
  }

  const context: PreparedEvaluationContext = {
    preview,
    isCurrent,
    documentIdentity,
    text,
    fsPath,
    engine,
    trustState,
    effectiveConfig,
    compilerConfig,
    canExecute,
    tailwindEnabled,
    tailwindProfileHint,
  };

  return {
    kind: 'ready',
    context,
  };
}

function showAdvancedProfileStatusBarMessage(
  canExecute: boolean,
  fallbackReason: string
): void {
  if (canExecute) {
    log.warn(`Tailwind advanced fallback active: ${fallbackReason}`);
    vscode.window.setStatusBarMessage(
      `${EXTENSION_DISPLAY_NAME} Tailwind: advanced fallback active (${fallbackReason})`,
      8000
    );
    return;
  }

  log.warn(
    `Tailwind advanced profile detected in Safe Mode: ${fallbackReason}`
  );
  vscode.window.setStatusBarMessage(
    `${EXTENSION_DISPLAY_NAME} Tailwind: advanced config detected (${fallbackReason}); enable Trusted Mode for full Tailwind support`,
    10000
  );
}
