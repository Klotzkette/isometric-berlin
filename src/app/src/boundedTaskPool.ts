export type TaskFailure<T> = {
  error: unknown;
  index: number;
  item: T;
};

export type TaskPoolOptions = {
  shouldStop?: () => boolean;
};

export async function runBoundedTasks<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
  options: TaskPoolOptions = {},
): Promise<TaskFailure<T>[]> {
  let nextIndex = 0;
  const failures: TaskFailure<T>[] = [];
  const workerCount = Math.min(
    Math.max(1, Math.floor(concurrency)),
    Math.max(1, items.length),
  );
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length && !options.shouldStop?.()) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        await task(items[index], index);
      } catch (error: unknown) {
        failures.push({ error, index, item: items[index] });
      }
    }
  });
  await Promise.all(workers);
  return failures.sort((left, right) => left.index - right.index);
}
