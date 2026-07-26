export type Release = () => void;

type Waiter = (release: Release) => void;

/**
 * A fair, counting semaphore.
 *
 * Waiting acquisitions are granted in first-in, first-out order. Every release
 * function is idempotent, which makes it safe to call from cleanup paths.
 */
export class Semaphore {
  readonly capacity: number;

  private availableCount: number;
  private readonly waiters: Waiter[] = [];

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("capacity must be a positive integer");
    }

    this.capacity = capacity;
    this.availableCount = capacity;
  }

  get available(): number {
    return this.availableCount;
  }

  get pending(): number {
    return this.waiters.length;
  }

  acquire(): Promise<Release> {
    if (this.availableCount > 0) {
      this.availableCount -= 1;
      return Promise.resolve(this.createRelease());
    }

    return new Promise<Release>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  async run<T>(task: () => T | PromiseLike<T>): Promise<T> {
    const release = await this.acquire();

    try {
      return await task();
    } finally {
      release();
    }
  }

  private createRelease(): Release {
    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      const next = this.waiters.shift();

      if (next) {
        next(this.createRelease());
      } else {
        this.availableCount += 1;
      }
    };
  }
}
