// tests/shared/semaphore.test.ts
// unit tests for shared async semaphore behavior

import { describe, it, expect } from 'vitest';
import { Semaphore } from '../../packages/shared/utils/concurrency';

describe('Semaphore', () => {
  it('acquire uses available permits immediately', async () => {
    const semaphore = new Semaphore(2);

    await semaphore.acquire();
    await semaphore.acquire();

    expect(semaphore.available).toBe(0);
    expect(semaphore.waiting).toBe(0);
  });

  it('queues acquisitions when no permits are available', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    let acquired = false;
    const pending = semaphore.acquire().then(() => {
      acquired = true;
    });

    expect(semaphore.waiting).toBe(1);
    expect(acquired).toBe(false);

    semaphore.release();
    await pending;

    expect(acquired).toBe(true);
    expect(semaphore.available).toBe(0);
    semaphore.release();
    expect(semaphore.available).toBe(1);
  });

  it('releases queued waiters in FIFO order', async () => {
    const semaphore = new Semaphore(1);
    const order: number[] = [];

    await semaphore.acquire();
    const second = semaphore.acquire().then(() => {
      order.push(2);
    });
    const third = semaphore.acquire().then(() => {
      order.push(3);
    });

    expect(semaphore.waiting).toBe(2);

    semaphore.release();
    await second;
    expect(order).toEqual([2]);

    semaphore.release();
    await third;
    expect(order).toEqual([2, 3]);
  });

  it('release increases available permits when no waiters exist', () => {
    const semaphore = new Semaphore(1);

    semaphore.release();

    expect(semaphore.available).toBe(2);
    expect(semaphore.waiting).toBe(0);
  });
});

