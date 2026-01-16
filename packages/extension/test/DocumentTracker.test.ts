// packages/extension/test/DocumentTracker.test.ts
// tests for DocumentTracker - tracks document versions and stale state

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTracker } from '../preview/watchers/DocumentTracker';

describe('DocumentTracker', () => {
  let tracker: DocumentTracker;

  beforeEach(() => {
    tracker = new DocumentTracker();
  });

  describe('initialization', () => {
    it('starts active by default', () => {
      expect(tracker.isActive()).toBe(true);
    });

    it('is not stale initially', () => {
      expect(tracker.isStale()).toBe(false);
    });

    it('has no rendered version initially', () => {
      expect(tracker.hasRenderedVersion(0)).toBe(false);
      expect(tracker.hasRenderedVersion(1)).toBe(false);
    });
  });

  describe('setNotifier', () => {
    it('sets the notifier', () => {
      const notifier = { setStale: vi.fn() };

      tracker.setNotifier(notifier);

      // Verify notifier is used on state change
      tracker.markStale();
      expect(notifier.setStale).toHaveBeenCalledWith(true);
    });
  });

  describe('isStale', () => {
    it('returns false initially', () => {
      expect(tracker.isStale()).toBe(false);
    });

    it('returns true after markStale', () => {
      tracker.markStale();

      expect(tracker.isStale()).toBe(true);
    });

    it('returns false after markRendered', () => {
      tracker.markStale();
      tracker.markRendered(1);

      expect(tracker.isStale()).toBe(false);
    });
  });

  describe('hasRenderedVersion', () => {
    it('returns false for unrendered version', () => {
      expect(tracker.hasRenderedVersion(1)).toBe(false);
    });

    it('returns true for rendered version', () => {
      tracker.markRendered(5);

      expect(tracker.hasRenderedVersion(5)).toBe(true);
    });

    it('returns false for different version after render', () => {
      tracker.markRendered(5);

      expect(tracker.hasRenderedVersion(6)).toBe(false);
    });

    it('returns false after resetRenderedVersion', () => {
      tracker.markRendered(5);
      tracker.resetRenderedVersion();

      expect(tracker.hasRenderedVersion(5)).toBe(false);
    });
  });

  describe('markStale', () => {
    it('sets stale state to true', () => {
      tracker.markStale();

      expect(tracker.isStale()).toBe(true);
    });

    it('notifies when becoming stale', () => {
      const notifier = { setStale: vi.fn() };
      tracker.setNotifier(notifier);

      tracker.markStale();

      expect(notifier.setStale).toHaveBeenCalledWith(true);
    });

    it('does not notify if already stale', () => {
      const notifier = { setStale: vi.fn() };
      tracker.setNotifier(notifier);

      tracker.markStale();
      tracker.markStale();

      expect(notifier.setStale).toHaveBeenCalledTimes(1);
    });

    it('does not throw without notifier', () => {
      expect(() => tracker.markStale()).not.toThrow();
    });
  });

  describe('markRendered', () => {
    it('updates rendered version', () => {
      tracker.markRendered(10);

      expect(tracker.hasRenderedVersion(10)).toBe(true);
    });

    it('clears stale state', () => {
      tracker.markStale();
      tracker.markRendered(1);

      expect(tracker.isStale()).toBe(false);
    });

    it('notifies when clearing stale state', () => {
      const notifier = { setStale: vi.fn() };
      tracker.setNotifier(notifier);

      tracker.markStale();
      tracker.markRendered(1);

      expect(notifier.setStale).toHaveBeenCalledWith(false);
    });

    it('does not notify if not stale', () => {
      const notifier = { setStale: vi.fn() };
      tracker.setNotifier(notifier);

      tracker.markRendered(1);

      expect(notifier.setStale).not.toHaveBeenCalled();
    });

    it('updates version on each call', () => {
      tracker.markRendered(1);
      tracker.markRendered(2);

      expect(tracker.hasRenderedVersion(1)).toBe(false);
      expect(tracker.hasRenderedVersion(2)).toBe(true);
    });
  });

  describe('resetRenderedVersion', () => {
    it('clears the rendered version', () => {
      tracker.markRendered(5);
      tracker.resetRenderedVersion();

      expect(tracker.hasRenderedVersion(5)).toBe(false);
    });

    it('allows same version to be rendered again', () => {
      tracker.markRendered(5);
      tracker.resetRenderedVersion();
      tracker.markRendered(5);

      expect(tracker.hasRenderedVersion(5)).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('start is a no-op', async () => {
      await tracker.start();

      expect(tracker.isActive()).toBe(true);
    });

    it('stop changes active state but onStop is a no-op', async () => {
      await tracker.start();
      tracker.stop();

      // stop() changes active state (BaseWatcher behavior)
      expect(tracker.isActive()).toBe(false);
      // But onStop() has no cleanup logic - just test it doesn't throw
    });

    it('dispose clears notifier', () => {
      const notifier = { setStale: vi.fn() };
      tracker.setNotifier(notifier);

      tracker.dispose();
      tracker.markStale();

      // Notifier should not be called after dispose
      expect(notifier.setStale).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles version 0', () => {
      tracker.markRendered(0);

      expect(tracker.hasRenderedVersion(0)).toBe(true);
    });

    it('handles negative versions', () => {
      tracker.markRendered(-5);

      expect(tracker.hasRenderedVersion(-5)).toBe(true);
    });

    it('handles large versions', () => {
      tracker.markRendered(Number.MAX_SAFE_INTEGER);

      expect(tracker.hasRenderedVersion(Number.MAX_SAFE_INTEGER)).toBe(true);
    });
  });
});
