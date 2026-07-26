// packages/extension-host/src/features/preview/evaluation/types.ts
// stage contract types for evaluate-in-webview orchestration

import type { TrustState } from '@mdx-preview/contracts';
import type {
  CompilerConfig,
  EffectivePreviewConfig,
} from '../../../shared/config/types';
import type { TailwindProfileDetectionResult } from '../../tailwind/types/detector';
import type {
  EvaluationEngine,
  SafeEvaluationResult,
  TrustedEvaluationResult,
} from '../EvaluationEngine';
import type { Preview } from '../Preview';

export interface PreparedEvaluationContext {
  preview: Preview;
  isCurrent: () => boolean;
  text: string;
  fsPath: string;
  engine: EvaluationEngine;
  trustState: TrustState;
  effectiveConfig: EffectivePreviewConfig;
  compilerConfig: CompilerConfig;
  canExecute: boolean;
  tailwindEnabled: boolean;
  tailwindProfileHint?: TailwindProfileDetectionResult;
}

export type PreparedEvaluationResult =
  | {
      kind: 'refresh-required';
    }
  | {
      kind: 'superseded';
    }
  | {
      kind: 'ready';
      context: PreparedEvaluationContext;
    };

export interface TrustedStageResult {
  kind: 'trusted';
  result: TrustedEvaluationResult;
}

export interface SafeStageResult {
  kind: 'safe';
  result: SafeEvaluationResult;
}

export type EvaluationStageResult = TrustedStageResult | SafeStageResult;
