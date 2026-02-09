// tests/extension/preview/watchers/DocumentTracker.test.ts
// unit tests for document version & stale state tracking

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTracker } from '../../../../packages/extension-host/src/features/preview/watchers/DocumentTracker';

describe('DocumentTracker', () => {
  let tracker: DocumentTracker;
  let mockNotifier: { setStale: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tracker = new DocumentTracker();
    mockNotifier = { setStale: vi.fn() };
    tracker.setNotifier(mockNotifier);
  });

  // initial state

  describe('initial state', () => {
    it('not stale initially', () => {
      expect(tracker.isStale()).toBe(false);
    });

    it('lastRenderedVersion is -1 initially', () => {
      expect(tracker.hasRenderedVersion(0)).toBe(false);
      expect(tracker.hasRenderedVersion(-1)).toBe(true);
    });
  });

  // markStale

  describe('markStale', () => {
    it('sets isStale to true & calls notifier.setStale(true)', () => {
      tracker.markStale();
      expect(tracker.isStale()).toBe(true);
      expect(mockNotifier.setStale).toHaveBeenCalledWith(true);
    });

    it('does not call notifier again when already stale', () => {
      tracker.markStale();
      mockNotifier.setStale.mockClear();
      tracker.markStale();
      expect(mockNotifier.setStale).not.toHaveBeenCalled();
    });
  });

  // markRendered

  describe('markRendered', () => {
    it('sets isStale false & calls notifier.setStale(false)', () => {
      tracker.markStale();
      mockNotifier.setStale.mockClear();
      tracker.markRendered(5);
      expect(tracker.isStale()).toBe(false);
      expect(mockNotifier.setStale).toHaveBeenCalledWith(false);
    });

    it('hasRenderedVersion returns true for rendered version', () => {
      tracker.markRendered(5);
      expect(tracker.hasRenderedVersion(5)).toBe(true);
      expect(tracker.hasRenderedVersion(4)).toBe(false);
    });

    it('does not call notifier when not stale', () => {
      tracker.markRendered(3);
      expect(mockNotifier.setStale).not.toHaveBeenCalled();
    });
  });

  // resetRenderedVersion

  describe('resetRenderedVersion', () => {
    it('resets so hasRenderedVersion returns false', () => {
      tracker.markRendered(5);
      expect(tracker.hasRenderedVersion(5)).toBe(true);
      tracker.resetRenderedVersion();
      expect(tracker.hasRenderedVersion(5)).toBe(false);
    });
  });

  // IWatcher lifecycle

  describe('IWatcher lifecycle', () => {
    it('start sets active', async () => {
      tracker.stop();
      expect(tracker.isActive()).toBe(false);
      await tracker.start();
      expect(tracker.isActive()).toBe(true);
    });

    it('stop sets inactive', () => {
      tracker.stop();
      expect(tracker.isActive()).toBe(false);
    });

    it('isReady returns true when active', () => {
      expect(tracker.isReady()).toBe(true);
    });

    it('isReady returns false when inactive', () => {
      tracker.stop();
      expect(tracker.isReady()).toBe(false);
    });

    it('waitForReady resolves immediately', async () => {
      await tracker.waitForReady();
    });
  });

  // dispose

  describe('dispose', () => {
    it('clears notifier & sets inactive', () => {
      tracker.dispose();
      expect(tracker.isActive()).toBe(false);
      // notifier cleared - markStale should not throw
      tracker.markStale();
      // no call on cleared notifier
      expect(mockNotifier.setStale).not.toHaveBeenCalled();
    });
  });
});
