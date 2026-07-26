# `@lucid-softworks/semaphore`

A fair, promise-based counting semaphore for limiting concurrent work. Waiting
callers acquire permits in FIFO order, and release functions are idempotent.

```ts
import { Semaphore } from "@lucid-softworks/semaphore";

const semaphore = new Semaphore(3);

const response = await semaphore.run(() => fetch("/api/report"));
```

`capacity` must be a positive integer. Use `acquire()` when a permit needs to
span custom setup and cleanup:

```ts
const release = await semaphore.acquire();

try {
  await useSharedResource();
} finally {
  release();
}
```

The `available` and `pending` getters expose the current number of free permits
and queued acquisitions.
