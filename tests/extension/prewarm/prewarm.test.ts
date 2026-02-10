// tests/extension/prewarm/prewarm.test.ts
// unit tests for Babel prewarm coordination

import { describe, it, expect, beforeEach, vi } from 'vitest';

type TrustState = { canExecute: boolean };

type TrustHandler = (state: TrustState) => void;

const nextTick = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

let trustState: TrustState = { canExecute: false };
let trustHandlers: TrustHandler[] = [];

const setupTrustManagerMock = async (): Promise<void> => {
  const services =
    await import('../../../packages/extension-host/src/app/services');
  const getTrustManager = services.getTrustManager as unknown as vi.Mock;

  getTrustManager.mockImplementation(() => ({
    getState: vi.fn(() => trustState),
    subscribe: vi.fn((handler: TrustHandler) => {
      trustHandlers.push(handler);
      return { dispose: () => {} };
    }),
  }));
};

beforeEach(async () => {
  vi.resetModules();
  trustState = { canExecute: false };
  trustHandlers = [];

  const logging =
    await import('../../../packages/extension-host/src/shared/logging/logger');
  (logging.debug as unknown as vi.Mock).mockClear();

  await setupTrustManagerMock();

  const babelModule =
    await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');
  babelModule.resetPrewarmState();
  babelModule.clearBabelConfigCache();
});

describe('prewarmBabel()', () => {
  it('marks prewarm complete after successful prewarm', async () => {
    const babelModule =
      await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');

    await babelModule.prewarmBabel();

    expect(babelModule.isBabelPrewarmed()).toBe(true);
  });

  it('is idempotent when called multiple times', async () => {
    const babelModule =
      await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');
    const logging =
      await import('../../../packages/extension-host/src/shared/logging/logger');
    const debugMock = logging.debug as unknown as vi.Mock;

    await babelModule.prewarmBabel();
    const callsAfterFirst = debugMock.mock.calls.length;

    await babelModule.prewarmBabel();

    expect(debugMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('allows transformAsync to work without explicit prewarm', async () => {
    const babelModule =
      await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');

    const result = await babelModule.transformAsync(
      'const element = <div className="test">Hello</div>;'
    );

    expect(result).not.toBeNull();
  });
});

describe('initPrewarm()', () => {
  it('triggers prewarm when trust state changes to canExecute', async () => {
    const babelModule =
      await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');
    const prewarmSpy = vi
      .spyOn(babelModule, 'prewarmBabel')
      .mockResolvedValue();

    const prewarmModule =
      await import('../../../packages/extension-host/src/features/prewarm');

    const disposable = prewarmModule.initPrewarm();

    expect(prewarmSpy).not.toHaveBeenCalled();
    expect(trustHandlers.length).toBe(1);

    trustHandlers[0]({ canExecute: true });
    await nextTick();

    expect(prewarmSpy).toHaveBeenCalledTimes(1);

    disposable.dispose();
    prewarmSpy.mockRestore();
  });

  it('does not prewarm in Safe Mode', async () => {
    const babelModule =
      await import('../../../packages/extension-host/src/features/module-runtime/transform/babel');
    const prewarmSpy = vi
      .spyOn(babelModule, 'prewarmBabel')
      .mockResolvedValue();

    const prewarmModule =
      await import('../../../packages/extension-host/src/features/prewarm');
    const vscode = await import('vscode');

    const disposable = prewarmModule.initPrewarm();

    await nextTick();
    expect(prewarmSpy).not.toHaveBeenCalled();

    vscode.__fireActiveTextEditorChange({
      document: { languageId: 'mdx' },
    });
    await nextTick();

    expect(prewarmSpy).not.toHaveBeenCalled();

    disposable.dispose();
    prewarmSpy.mockRestore();
  });
});
