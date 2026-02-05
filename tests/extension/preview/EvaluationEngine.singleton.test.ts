// tests/extension/preview/EvaluationEngine.singleton.test.ts
// unit tests for EvaluationEngine singleton wiring

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EvaluationEngine singleton', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns same instance for repeated calls in same module scope', async () => {
    const module = await import(
      '../../../packages/extension/preview/EvaluationEngine'
    );

    const first = module.getEvaluationEngine();
    const second = module.getEvaluationEngine();

    expect(first).toBe(second);
  });

  it('creates new instance after module cache reset', async () => {
    const firstModule = await import(
      '../../../packages/extension/preview/EvaluationEngine'
    );
    const first = firstModule.getEvaluationEngine();

    vi.resetModules();

    const secondModule = await import(
      '../../../packages/extension/preview/EvaluationEngine'
    );
    const second = secondModule.getEvaluationEngine();

    expect(second).not.toBe(first);
  });
});
