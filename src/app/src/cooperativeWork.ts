/** Keep unpublished construction interruptible without cloning its buffers. */
export async function completeCooperatively<T>(
  steps: Generator<void, T>,
  options: {
    yieldTask: () => Promise<void>;
    isCancelled: () => boolean;
    budgetMs?: number;
    now?: () => number;
  },
): Promise<T> {
  const now = options.now ?? (() => performance.now());
  const budgetMs = options.budgetMs ?? 8;
  let complete = false;
  try {
    await options.yieldTask();
    let deadline = now() + budgetMs;
    for (;;) {
      if (options.isCancelled()) {
        throw new DOMException("World construction cancelled", "AbortError");
      }
      const next = steps.next();
      if (next.done) {
        complete = true;
        return next.value;
      }
      if (now() >= deadline) {
        await options.yieldTask();
        deadline = now() + budgetMs;
      }
    }
  } finally {
    // Release suspended locals on cancellation or scheduler failure. The
    // caller owns and disposes any unpublished Three.js resources.
    if (!complete) steps.return(undefined as T);
  }
}
