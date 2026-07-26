// tests/extension/preview/extension-rpc-handler.test.ts
// verify extension-host RPC request caching on preview hot paths

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockConfigManager,
  mockTrustManager,
} from '../../helpers/mock-services';
import ExtensionHandle from '../../../packages/extension-host/src/platform/rpc/extension-rpc-handler';

function createPreview() {
  return {
    doc: {
      uri: {
        scheme: 'file',
        fsPath: '/workspace/doc.mdx',
      },
    },
    active: true,
  } as unknown as ConstructorParameters<typeof ExtensionHandle>[0];
}

const openPreview = vi.fn(async () => {});

describe('ExtensionHandle PlantUML rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrustManager.getState.mockReturnValue({
      workspaceTrusted: true,
      scriptsEnabled: true,
      canExecute: true,
      openMdxLinksInPreview: true,
    });
    mockConfigManager.get.mockReturnValue('https://plantuml.example');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent renders, caches results, and invalidates on server change', async () => {
    let resolveFirstFetch:
      | ((response: {
          ok: boolean;
          status: number;
          text: () => Promise<string>;
        }) => void)
      | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstFetch = resolve;
          })
      )
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<svg>server-two</svg>',
      });
    vi.stubGlobal('fetch', fetchMock);

    const handle = new ExtensionHandle(createPreview(), openPreview);
    const first = handle.renderPlantUml('Alice -> Bob');
    const concurrent = handle.renderPlantUml('Alice -> Bob');

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    resolveFirstFetch?.({
      ok: true,
      status: 200,
      text: async () => '<svg>server-one</svg>',
    });

    await expect(first).resolves.toBe('<svg>server-one</svg>');
    await expect(concurrent).resolves.toBe('<svg>server-one</svg>');
    await expect(handle.renderPlantUml('Alice -> Bob')).resolves.toBe(
      '<svg>server-one</svg>'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockConfigManager.get.mockReturnValue('https://plantuml-two.example');
    await expect(handle.renderPlantUml('Alice -> Bob')).resolves.toBe(
      '<svg>server-two</svg>'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
