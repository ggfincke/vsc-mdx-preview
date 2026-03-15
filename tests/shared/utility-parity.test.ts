// tests/shared/utility-parity.test.ts
// verify cross-repo utility behavioral parity between vsc-mdx-preview & mdx-forge
// ! cross-repo parity: mirror test in mdx-forge/tests/cross-repo/utility-parity.test.ts
// ! changes to shared behavior must update BOTH test files

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cn } from '../../packages/webview-client/src/shared/utils/cn';
import { copyToClipboard } from '../../packages/webview-client/src/shared/utils/clipboard';
import { Semaphore } from '../../packages/runtime-utils/src/async/semaphore';

describe('cross-repo utility parity', () => {
  // cn() — shared surface: identical function
  describe('cn() behavioral contract', () => {
    it('joins class names, filters falsy values & returns empty for no args', () => {
      expect(cn('a', 'b')).toBe('a b');
      expect(cn('a', false, 'b')).toBe('a b');
      expect(cn('a', null, undefined, 'b')).toBe('a b');
      expect(cn()).toBe('');
      expect(cn(false, null, undefined)).toBe('');
      expect(cn('only')).toBe('only');
    });
  });

  // copyToClipboard() — shared surface: success & failure return values
  describe('copyToClipboard() behavioral contract', () => {
    let originalNavigator: typeof globalThis.navigator;

    beforeEach(() => {
      originalNavigator = globalThis.navigator;
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('returns true on successful clipboard write', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: async () => {} } },
        writable: true,
        configurable: true,
      });
      expect(await copyToClipboard('test')).toBe(true);
    });

    it('returns false when clipboard API throws', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: async () => {
              throw new Error('denied');
            },
          },
        },
        writable: true,
        configurable: true,
      });
      expect(await copyToClipboard('test')).toBe(false);
    });
  });

  // Semaphore — shared surface: constructor, acquire(), release()
  describe('Semaphore behavioral contract', () => {
    it('allows immediate acquire when permits available', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();
      // resolves immediately w/o hanging
    });

    it('blocks acquire when no permits & releases waiters in FIFO order', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();

      let acquired = false;
      const pending = sem.acquire().then(() => {
        acquired = true;
      });

      // yield to event loop — should NOT have acquired
      await new Promise((r) => setTimeout(r, 10));
      expect(acquired).toBe(false);

      // release unblocks the waiter
      sem.release();
      await pending;
      expect(acquired).toBe(true);

      // FIFO order: release first permit, queue two more
      const order: number[] = [];
      const p1 = sem.acquire().then(() => order.push(1));
      const p2 = sem.acquire().then(() => order.push(2));

      sem.release();
      sem.release();
      await Promise.all([p1, p2]);
      expect(order).toEqual([1, 2]);
    });

    it('supports multiple permits', async () => {
      const sem = new Semaphore(3);
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      let acquired = false;
      const pending = sem.acquire().then(() => {
        acquired = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(acquired).toBe(false);

      sem.release();
      await pending;
      expect(acquired).toBe(true);
    });
  });
});
