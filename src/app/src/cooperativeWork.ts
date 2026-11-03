/** Keep unpublished construction interruptible without cloning its buffers. */
export async function completeCooperatively<T>(
  steps: Generator<void, T>,
  options: {
    yieldTask: () => Promise<void>;
    isCancelled: () => boolean;
    budgetMs?: number;
    now?: () => number;
    onCheckpoint?: (completedSteps: number) => void;
    /** Synchronous final publication, before a resolved-Promise microtask gap. */
    onComplete?: (value: T) => void;
  },
): Promise<T> {
  const now = options.now ?? (() => performance.now());
  const budgetMs = options.budgetMs ?? 8;
  let complete = false;
  let completedSteps = 0;
  try {
    await options.yieldTask();
    let deadline = now() + budgetMs;
    for (;;) {
      if (options.isCancelled()) {
        throw new DOMException("World construction cancelled", "AbortError");
      }
      const next = steps.next();
      if (next.done) {
        options.onCheckpoint?.(completedSteps);
        options.onComplete?.(next.value);
        complete = true;
        return next.value;
      }
      completedSteps += 1;
      if (now() >= deadline) {
        options.onCheckpoint?.(completedSteps);
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
