// tests/extension/preview/watchers/DependencyWatcher.test.ts
// unit tests for dependency watcher import tracking & callback behavior

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResolver, createdWatchers } = vi.hoisted(() => ({
  mockResolver: {
    shouldResolve: vi.fn<(specifier: string) => boolean>(),
    isRelativeImport: vi.fn<(specifier: string) => boolean>(),
    resolveSync: vi.fn(),
  },
  createdWatchers: new Map<
    string,
    {
      dispose: ReturnType<typeof vi.fn>;
      triggerChange: () => void;
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

vi.mock(
  '../../../../packages/extension/module-system/resolver/UnifiedResolver',
  () => ({
    getUnifiedResolver: () => mockResolver,
  })
);

vi.mock('../../../../packages/extension/utils/createFileWatcher', () => ({
  createFileWatcher: vi.fn((config: any) => {
    const fsPath = String(config.pattern);
    const watcher = {
      dispose: vi.fn(),
      triggerChange: () => {
        config.onChange?.({ fsPath });
      },
      triggerDelete: () => {
        config.onDelete?.({ fsPath });
      },
    };
    createdWatchers.set(fsPath, watcher);
    return watcher;
  }),
}));

import { DependencyWatcher } from '../../../../packages/extension/preview/watchers/DependencyWatcher';

function getInternalCache(watcher: DependencyWatcher): any {
  return (watcher as any).watchers;
}

describe('DependencyWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWatchers.clear();
    mockResolver.shouldResolve.mockImplementation(
      (specifier: string) => !!specifier && !specifier.startsWith('http')
    );
    mockResolver.isRelativeImport.mockImplementation(
      (specifier: string) =>
        specifier.startsWith('./') || specifier.startsWith('../')
    );
    mockResolver.resolveSync.mockImplementation((specifier: string) => {
      if (specifier === './a') {
        return {
          fsPath: '/workspace/a.tsx',
          isBuiltInShim: false,
        };
      }
      if (specifier === './b') {
        return {
          fsPath: '/workspace/b.tsx',
          isBuiltInShim: false,
        };
      }
      return null;
    });
  });

  it('becomes ready after document dir is set', async () => {
    const watcher = new DependencyWatcher(vi.fn());
    await watcher.start();

    expect(watcher.isActive()).toBe(true);
    expect(watcher.isReady()).toBe(false);

    watcher.setDocumentDir('/workspace');
    expect(watcher.isReady()).toBe(true);
  });

  it('becomes ready when explicit resolution context is set', async () => {
    const watcher = new DependencyWatcher(vi.fn());
    await watcher.start();

    watcher.setResolutionContext({ baseDir: '/workspace' });
    expect(watcher.isReady()).toBe(true);
  });

  it('adds watchers for local dependencies and triggers callback on change', async () => {
    const onChange = vi.fn();
    const watcher = new DependencyWatcher(onChange);
    watcher.setDocumentDir('/workspace');
    await watcher.start();

    watcher.updateDependencies(['./a', './b', 'react', 'http://example.com']);

    const cache = getInternalCache(watcher);
    expect(cache.size).toBe(2);
    expect(cache.has('/workspace/a.tsx')).toBe(true);
    expect(cache.has('/workspace/b.tsx')).toBe(true);

    createdWatchers.get('/workspace/a.tsx')?.triggerChange();
    expect(onChange).toHaveBeenCalledWith('/workspace/a.tsx');
  });

  it('removes stale watchers when imports change', async () => {
    const watcher = new DependencyWatcher(vi.fn());
    watcher.setDocumentDir('/workspace');
    await watcher.start();

    watcher.updateDependencies(['./a', './b']);
    watcher.updateDependencies(['./b']);

    const cache = getInternalCache(watcher);
    expect(cache.has('/workspace/a.tsx')).toBe(false);
    expect(cache.has('/workspace/b.tsx')).toBe(true);
    expect(createdWatchers.get('/workspace/a.tsx')?.dispose).toHaveBeenCalled();
  });

  it('deletes watcher and notifies callback on delete event', async () => {
    const onChange = vi.fn();
    const watcher = new DependencyWatcher(onChange);
    watcher.setDocumentDir('/workspace');
    await watcher.start();
    watcher.updateDependencies(['./a']);

    createdWatchers.get('/workspace/a.tsx')?.triggerDelete();

    const cache = getInternalCache(watcher);
    expect(cache.has('/workspace/a.tsx')).toBe(false);
    expect(onChange).toHaveBeenCalledWith('/workspace/a.tsx');
    expect(createdWatchers.get('/workspace/a.tsx')?.dispose).toHaveBeenCalled();
  });

  it('skips unresolved and built-in shim dependencies', async () => {
    mockResolver.resolveSync.mockImplementation((specifier: string) => {
      if (specifier === './shim') {
        return {
          fsPath: 'npm://shim',
          isBuiltInShim: true,
        };
      }
      return null;
    });

    const watcher = new DependencyWatcher(vi.fn());
    watcher.setDocumentDir('/workspace');
    await watcher.start();
    watcher.updateDependencies(['./shim', './missing']);

    const cache = getInternalCache(watcher);
    expect(cache.size).toBe(0);
  });

  it('clear disposes all active dependency watchers', async () => {
    const watcher = new DependencyWatcher(vi.fn());
    watcher.setDocumentDir('/workspace');
    await watcher.start();
    watcher.updateDependencies(['./a', './b']);

    watcher.clear();

    const cache = getInternalCache(watcher);
    expect(cache.size).toBe(0);
    expect(createdWatchers.get('/workspace/a.tsx')?.dispose).toHaveBeenCalled();
    expect(createdWatchers.get('/workspace/b.tsx')?.dispose).toHaveBeenCalled();
  });
});

