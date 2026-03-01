// packages/extension-host/src/features/preview/evaluation/post-push-artifacts.ts
// post-evaluation artifact pushes & shared side effects

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { getFrameworkDetector, getMetaResolver } from '../../../app/services';
import {
  detectComponents,
  getUsedGenericComponents,
} from '../../diagnostics/ComponentDetector';
import { extractNextraFrontmatter } from 'mdx-forge/compiler';
import { clearTailwindChannels } from './tailwind-channel-utils';
import type {
  EvaluationStageResult,
  PreparedEvaluationContext,
  SafeStageResult,
  TrustedStageResult,
} from './types';

const log = createTaggedLogger(LogTags.EVALUATE);

export async function postPushArtifacts(
  context: PreparedEvaluationContext,
  stageResult: EvaluationStageResult
): Promise<void> {
  if (stageResult.kind === 'trusted') {
    await postTrustedArtifacts(context, stageResult);
    return;
  }

  postSafeArtifacts(context, stageResult);
}

async function postTrustedArtifacts(
  context: PreparedEvaluationContext,
  stageResult: TrustedStageResult
): Promise<void> {
  const preview = context.preview;
  const { webviewHandle } = preview;
  const { result } = stageResult;

  preview.updateDependencies(result.dependencies);
  applyFrontmatterAndMeta(context, result.frontmatter);

  await detectAndPushUsedComponents(context);

  log.debug('Calling webviewHandle.updatePreview');
  webviewHandle.updatePreview(
    result.code,
    result.entryFilePath,
    result.dependencies
  );
  log.debug('updatePreview called');

  if (!context.tailwindEnabled) {
    clearTailwindChannels(context.preview, webviewHandle);
    return;
  }

  const tailwindRequestId = context.preview.nextTailwindRequestId();
  void context.engine.processTailwindAsync(
    context.preview,
    {
      mdxText: context.text,
      entryFilePath: result.entryFilePath,
      entryFileDependencies: result.dependencies,
      trustState: context.trustState,
      tailwindConfig: context.effectiveConfig.tailwind,
      profileHint: context.tailwindProfileHint,
    },
    tailwindRequestId,
    webviewHandle
  );
}

function postSafeArtifacts(
  context: PreparedEvaluationContext,
  stageResult: SafeStageResult
): void {
  const preview = context.preview;
  const { webviewHandle } = preview;

  clearTailwindChannels(context.preview, webviewHandle);

  applyFrontmatterAndMeta(context, stageResult.result.frontmatter);

  log.debug('Calling webviewHandle.updatePreviewSafe');
  webviewHandle.updatePreviewSafe(stageResult.result.html);
  log.debug('updatePreviewSafe called');
}

async function detectAndPushUsedComponents(
  context: PreparedEvaluationContext
): Promise<void> {
  const preview = context.preview;
  const { webviewHandle } = preview;

  try {
    const detectionResult = await detectComponents(
      context.text,
      { detectImports: true },
      new Set(),
      preview.doc.uri.toString()
    );
    const usedGenericComponents = getUsedGenericComponents(detectionResult);
    if (usedGenericComponents.length === 0) {
      return;
    }

    log.debug(`Used generic components: ${usedGenericComponents.join(', ')}`);
    webviewHandle.setUsedComponents(usedGenericComponents);
  } catch (err) {
    // detection failure is non-fatal - webview loads all generic shims as fallback
    log.debug(`Component detection failed: ${extractErrorMessage(err)}`);
  }
}

function applyFrontmatterAndMeta(
  context: PreparedEvaluationContext,
  frontmatter: Record<string, unknown> | undefined
): void {
  const { preview } = context;

  if (frontmatter) {
    preview.pushThemeState(frontmatter);
  }

  preview.pushRuntimeConfiguration();

  sendNextraMetaIfNeeded(context, frontmatter);
}

function sendNextraMetaIfNeeded(
  context: PreparedEvaluationContext,
  frontmatter: Record<string, unknown> | undefined
): void {
  const preview = context.preview;
  const { webviewHandle } = preview;

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

    const metaFromJson = getMetaResolver().resolveNextraMeta(
      context.fsPath,
      workspaceFolder.uri.fsPath
    );

    const metaFromFrontmatter = extractNextraFrontmatter(frontmatter ?? {});
    const mergedMeta = getMetaResolver().mergeNextraMeta(
      metaFromJson,
      metaFromFrontmatter
    );

    if (Object.keys(mergedMeta).length === 0) {
      return;
    }

    log.debug('Sending Nextra meta to webview:', mergedMeta);
    webviewHandle.setNextraMeta(mergedMeta);
  } catch (err) {
    log.debug(`Error resolving Nextra meta: ${extractErrorMessage(err)}`);
  }
}
