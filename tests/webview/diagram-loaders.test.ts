// tests/webview/diagram-loaders.test.ts
// unit tests for Mermaid & Graphviz loader modules

import { describe, expect, it, vi } from 'vitest';
import {
  createMermaidLoader,
  type MermaidModule,
} from '../../packages/webview-client/src/features/diagrams/utils/mermaidLoader';
import {
  createGraphvizLoader,
  type VizInstance,
} from '../../packages/webview-client/src/features/diagrams/utils/graphvizLoader';

describe('diagram loaders', () => {
  it('mermaid loader deduplicates concurrent loads', async () => {
    const moduleValue = {
      default: {},
    } as MermaidModule;
    const loadFn = vi.fn(async () => moduleValue);
    const loader = createMermaidLoader(loadFn);

    const [a, b] = await Promise.all([loader.load(), loader.load()]);

    expect(a).toBe(moduleValue);
    expect(b).toBe(moduleValue);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('mermaid loader retries after failure', async () => {
    const moduleValue = {
      default: {},
    } as MermaidModule;
    const loadFn = vi
      .fn<() => Promise<MermaidModule>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce(moduleValue);
    const loader = createMermaidLoader(loadFn);

    await expect(loader.load()).rejects.toThrow('first failure');
    await expect(loader.load()).resolves.toBe(moduleValue);
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('graphviz loader deduplicates and creates instance once', async () => {
    const instance = {
      renderString: vi.fn(),
    } as unknown as VizInstance;
    const instanceFactory = vi.fn(async () => instance);
    const loadModule = vi.fn(async () => ({
      instance: instanceFactory,
    }));
    const loader = createGraphvizLoader(loadModule);

    const [a, b] = await Promise.all([loader.load(), loader.load()]);

    expect(a).toBe(instance);
    expect(b).toBe(instance);
    expect(loadModule).toHaveBeenCalledTimes(1);
    expect(instanceFactory).toHaveBeenCalledTimes(1);
  });

  it('graphviz loader retries after failure', async () => {
    const instance = {
      renderString: vi.fn(),
    } as unknown as VizInstance;
    const instanceFactory = vi.fn(async () => instance);
    const loadModule = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce({ instance: instanceFactory });
    const loader = createGraphvizLoader(loadModule);

    await expect(loader.load()).rejects.toThrow('first failure');
    await expect(loader.load()).resolves.toBe(instance);
    expect(loadModule).toHaveBeenCalledTimes(2);
    expect(instanceFactory).toHaveBeenCalledTimes(1);
  });
});
