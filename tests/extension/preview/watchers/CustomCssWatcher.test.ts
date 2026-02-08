// tests/extension/preview/watchers/CustomCssWatcher.test.ts
// unit tests for custom CSS watcher path resolution, loading, & notifications

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReadFileAsync, mockResolvePathWithFallbacks, createdWatchers } =
  vi.hoisted(() => ({
    mockReadFileAsync: vi.fn(),
    mockResolvePathWithFallbacks: vi.fn(),
    createdWatchers: new Map<
      string,
      {
        dispose: ReturnType<typeof vi.fn>;
        triggerChange: () => void;
        triggerCreate: () => void;
        triggerDelete: () => void;
      }
    >(),
  }));

vi.mock('../../../../packages/extension/logging', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../../packages/extension/utils/file-utils', () => ({
  readFileAsync: (...args: any[]) => mockReadFileAsync(...args),
}));

vi.mock('../../../../packages/extension/utils/path-utils', () => ({
  resolvePathWithFallbacks: (...args: any[]) =>
    mockResolvePathWithFallbacks(...args),
}));

vi.mock('../../../../packages/extension/utils/createFileWatcher', () => ({
  createFileWatcher: vi.fn((config: any) => {
    const fsPath = String(config.pattern);
    const watcher = {
      dispose: vi.fn(),
      triggerChange: () => {
        config.onChange?.({ fsPath });
      },
      triggerCreate: () => {
        config.onCreate?.({ fsPath });
      },
      triggerDelete: () => {
        config.onDelete?.({ fsPath });
      },
    };
    createdWatchers.set(fsPath, watcher);
    return watcher;
  }),
}));

import { CustomCssWatcher } from '../../../../packages/extension/preview/watchers/CustomCssWatcher';

describe('CustomCssWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWatchers.clear();
    mockResolvePathWithFallbacks.mockReturnValue('/workspace/custom.css');
    mockReadFileAsync.mockResolvedValue('body { color: red; }');
  });

  it('loads CSS on start and sends it to notifier', async () => {
    const notifier = { setCustomCss: vi.fn() };
    const watcher = new CustomCssWatcher(
      './custom.css',
      [{ uri: { fsPath: '/workspace' } } as any],
      '/workspace/docs'
    );
    watcher.setNotifier(notifier);

    await watcher.start();

    expect(watcher.isActive()).toBe(true);
    expect(watcher.isReady()).toBe(true);
    expect(mockReadFileAsync).toHaveBeenCalledWith(
      '/workspace/custom.css',
      'utf-8',
      expect.objectContaining({ logOnError: true })
    );
    expect(notifier.setCustomCss).toHaveBeenCalledWith(
      'body { color: red; }'
    );
  });

  it('reloads CSS on change and create events', async () => {
    const notifier = { setCustomCss: vi.fn() };
    const watcher = new CustomCssWatcher('./custom.css', undefined, null);
    watcher.setNotifier(notifier);
    await watcher.start();

    createdWatchers.get('/workspace/custom.css')?.triggerChange();
    createdWatchers.get('/workspace/custom.css')?.triggerCreate();

    await vi.waitFor(() => {
      expect(mockReadFileAsync).toHaveBeenCalledTimes(3);
      expect(notifier.setCustomCss).toHaveBeenCalledTimes(3);
    });
  });

  it('clears CSS on delete event', async () => {
    const notifier = { setCustomCss: vi.fn() };
    const watcher = new CustomCssWatcher('./custom.css', undefined, null);
    watcher.setNotifier(notifier);
    await watcher.start();

    createdWatchers.get('/workspace/custom.css')?.triggerDelete();

    expect(notifier.setCustomCss).toHaveBeenCalledWith('');
  });

  it('does not start when CSS path cannot be resolved', async () => {
    mockResolvePathWithFallbacks.mockReturnValue(null);
    const watcher = new CustomCssWatcher('./missing.css', undefined, null);

    await watcher.start();

    expect(watcher.isActive()).toBe(false);
    expect(mockReadFileAsync).not.toHaveBeenCalled();
  });

  it('setNotifier after start pushes current CSS immediately', async () => {
    const notifier = { setCustomCss: vi.fn() };
    const watcher = new CustomCssWatcher('./custom.css', undefined, null);
    await watcher.start();
    mockReadFileAsync.mockClear();

    watcher.setNotifier(notifier);

    await vi.waitFor(() => {
      expect(mockReadFileAsync).toHaveBeenCalledTimes(1);
      expect(notifier.setCustomCss).toHaveBeenCalledWith(
        'body { color: red; }'
      );
    });
  });

  it('updatePath disposes current watcher and restarts', () => {
    const watcher = new CustomCssWatcher('./custom.css', undefined, null);
    const disposeSpy = vi.spyOn(watcher, 'dispose');
    const startSpy = vi.spyOn(watcher, 'start').mockResolvedValue();

    watcher.updatePath('/new.css', undefined, '/new-dir');

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect((watcher as any).cssPath).toBe('/new.css');
    expect((watcher as any).documentDirectory).toBe('/new-dir');
  });
});
