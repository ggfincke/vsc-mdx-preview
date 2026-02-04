// tests/extension/utils/Semaphore.test.ts
// unit tests for Semaphore concurrency limiter

import { describe, it, expect } from 'vitest';
import { Semaphore } from '@mdx-preview/shared';

function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('Semaphore', () => {
  it('allows immediate acquisition when permits available', async () => {
    const semaphore = new Semaphore(2);

    expect(semaphore.available).toBe(2);

    await semaphore.acquire();
    expect(semaphore.available).toBe(1);

    semaphore.release();
    expect(semaphore.available).toBe(2);
  });

  it('blocks when no permits available', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    let resolved = false;
    const pending = semaphore.acquire().then(() => {
      resolved = true;
    });

    await nextTick();
    expect(resolved).toBe(false);
    expect(semaphore.waiting).toBe(1);

    semaphore.release();
    await pending;

    expect(resolved).toBe(true);
  });

  it('processes waiters in FIFO order', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    const order: number[] = [];
    const first = semaphore.acquire().then(() => {
      order.push(1);
    });
    const second = semaphore.acquire().then(() => {
      order.push(2);
    });

    await nextTick();
    expect(semaphore.waiting).toBe(2);

    semaphore.release();
    await first;

    expect(order).toEqual([1]);

    semaphore.release();
    await second;

    expect(order).toEqual([1, 2]);
  });

  it('limits concurrent operations to specified count', async () => {
    const semaphore = new Semaphore(2);
    let active = 0;
    let maxActive = 0;
    const blockers: Array<() => void> = [];

    const waitForBlocker = async (): Promise<() => void> => {
      while (blockers.length === 0) {
        await nextTick();
      }
      return blockers.shift() as () => void;
    };

    const tasks = Array.from({ length: 5 }, async () => {
      await semaphore.acquire();
      active += 1;
      maxActive = Math.max(maxActive, active);

      await new Promise<void>((resolve) => {
        blockers.push(resolve);
      });

      active -= 1;
      semaphore.release();
    });

    await nextTick();
    expect(maxActive).toBe(2);

    for (let i = 0; i < 5; i += 1) {
      const release = await waitForBlocker();
      release();
      await nextTick();
    }

    await Promise.all(tasks);
    expect(maxActive).toBe(2);
  });
});
