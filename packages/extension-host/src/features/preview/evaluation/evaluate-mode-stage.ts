// packages/extension-host/src/features/preview/evaluation/evaluate-mode-stage.ts
// trusted/safe evaluation stage dispatch helpers

import type {
  PreparedEvaluationContext,
  SafeStageResult,
  TrustedStageResult,
} from './types';

export async function evaluateTrustedStage(
  context: PreparedEvaluationContext
): Promise<TrustedStageResult> {
  const result = await context.engine.evaluateTrusted(
    context.text,
    context.fsPath,
    context.preview,
    context.compilerConfig
  );

  return {
    kind: 'trusted',
    result,
  };
}

export async function evaluateSafeStage(
  context: PreparedEvaluationContext
): Promise<SafeStageResult> {
  const result = await context.engine.evaluateSafe(
    context.text,
    context.compilerConfig
  );

  return {
    kind: 'safe',
    result,
  };
}
