// packages/runtime-utils/src/async/semaphore.ts
// concurrency control primitives shared across packages
// ! cross-repo duplicate: mdx-forge/src/browser/internal/semaphore.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

// concurrency limiting semaphore for async operations
// prevent resource exhaustion from unbounded parallelism
export class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.waitQueue.push(resolve));
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  get available(): number {
    return this.permits;
  }

  get waiting(): number {
    return this.waitQueue.length;
  }
}
