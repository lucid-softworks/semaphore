import { describe, expect, it, vi } from "vitest";

import { Semaphore } from "../src/index.js";

describe("Semaphore", () => {
  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid capacity %s",
    (capacity) => {
      expect(() => new Semaphore(capacity)).toThrow(
        new RangeError("capacity must be a positive integer"),
      );
    },
  );

  it("tracks permits and grants waiters in FIFO order", async () => {
    const semaphore = new Semaphore(2);
    const first = await semaphore.acquire();
    const second = await semaphore.acquire();
    const order: number[] = [];
    const thirdPromise = semaphore.acquire().then((release) => {
      order.push(3);
      return release;
    });
    const fourthPromise = semaphore.acquire().then((release) => {
      order.push(4);
      return release;
    });

    expect(semaphore.capacity).toBe(2);
    expect(semaphore.available).toBe(0);
    expect(semaphore.pending).toBe(2);

    first();
    const third = await thirdPromise;
    expect(order).toEqual([3]);
    expect(semaphore.pending).toBe(1);

    second();
    const fourth = await fourthPromise;
    expect(order).toEqual([3, 4]);

    third();
    third();
    fourth();
    expect(semaphore.available).toBe(2);
    expect(semaphore.pending).toBe(0);
  });

  it("limits concurrent runs and releases after success", async () => {
    const semaphore = new Semaphore(1);
    let active = 0;
    let maximum = 0;
    const finish: Array<() => void> = [];
    const task = vi.fn<(value: number) => Promise<number>>(async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => finish.push(resolve));
      active -= 1;
      return value * 2;
    });

    const first = semaphore.run(() => task(2));
    const second = semaphore.run(() => task(3));
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1));
    finish.shift()?.();
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(2));
    finish.shift()?.();

    await expect(Promise.all([first, second])).resolves.toEqual([4, 6]);
    expect(maximum).toBe(1);
    expect(semaphore.available).toBe(1);
  });

  it("releases after a task fails", async () => {
    const semaphore = new Semaphore(1);

    await expect(
      semaphore.run(() => {
        throw new Error("broken");
      }),
    ).rejects.toThrow("broken");
    expect(semaphore.available).toBe(1);
  });
});
