// packages/extension/test/PackageJsonWatcher.test.ts
// unit tests for PackageJsonWatcher (file watching, debouncing, disposal)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resetMocks, workspace, Disposable, Uri } from './__mocks__/vscode';
import { PackageJsonWatcher } from '../module-fetcher/PackageJsonWatcher';

describe('PackageJsonWatcher', () => {
  let watcher: PackageJsonWatcher;
  let mockOnInvalidate: ReturnType<typeof vi.fn>;
  let capturedListeners: {
    packageJson?: (uri: any) => void;
    lockFile?: (uri: any) => void;
  };

  beforeEach(() => {
    __resetMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Capture the onDidChange listeners
    capturedListeners = {};

    // Override the createFileSystemWatcher mock to capture listeners
    (
      workspace.createFileSystemWatcher as ReturnType<typeof vi.fn>
    ).mockImplementation((pattern: string) => {
      const mockWatcher = {
        onDidChange: vi.fn((listener: (uri: any) => void) => {
          if (pattern.includes('package.json')) {
            capturedListeners.packageJson = listener;
          } else {
            capturedListeners.lockFile = listener;
          }
          return new Disposable(() => {});
        }),
        onDidCreate: vi.fn(() => new Disposable(() => {})),
        onDidDelete: vi.fn(() => new Disposable(() => {})),
        dispose: vi.fn(),
      };
      return mockWatcher;
    });

    watcher = new PackageJsonWatcher();
    mockOnInvalidate = vi.fn();
  });

  afterEach(() => {
    watcher.dispose();
    vi.useRealTimers();
    __resetMocks();
  });

  describe('start', () => {
    it('creates watchers for package.json and lock files', () => {
      watcher.start(mockOnInvalidate);

      expect(workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '**/package.json',
        true,
        false,
        true
      );
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}',
        true,
        false,
        true
      );
    });
  });

  describe('debouncing', () => {
    it('debounces rapid changes', () => {
      watcher.start(mockOnInvalidate);

      // Trigger multiple changes rapidly
      capturedListeners.packageJson?.(Uri.file('/project/package.json'));
      capturedListeners.packageJson?.(Uri.file('/project/package.json'));
      capturedListeners.packageJson?.(Uri.file('/project/package.json'));

      // No callback yet (debouncing)
      expect(mockOnInvalidate).not.toHaveBeenCalled();

      // Advance past debounce delay (500ms)
      vi.advanceTimersByTime(600);

      // Now callback should be called once
      expect(mockOnInvalidate).toHaveBeenCalledTimes(1);
    });

    it('calls callback after debounce delay', () => {
      watcher.start(mockOnInvalidate);

      capturedListeners.packageJson?.(Uri.file('/project/package.json'));

      // Advance time less than debounce delay
      vi.advanceTimersByTime(200);
      expect(mockOnInvalidate).not.toHaveBeenCalled();

      // Advance past debounce delay
      vi.advanceTimersByTime(400);
      expect(mockOnInvalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('lock file changes', () => {
    it('triggers invalidation on lock file change', () => {
      watcher.start(mockOnInvalidate);

      capturedListeners.lockFile?.(Uri.file('/project/package-lock.json'));

      vi.advanceTimersByTime(600);

      expect(mockOnInvalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('clears pending debounce timer', () => {
      watcher.start(mockOnInvalidate);

      capturedListeners.packageJson?.(Uri.file('/project/package.json'));

      // Dispose before debounce completes
      watcher.dispose();

      // Advance time
      vi.advanceTimersByTime(600);

      // Callback should not be called (timer was cleared)
      expect(mockOnInvalidate).not.toHaveBeenCalled();
    });

    it('can be called multiple times safely', () => {
      watcher.start(mockOnInvalidate);

      expect(() => {
        watcher.dispose();
        watcher.dispose();
      }).not.toThrow();
    });
  });
});
