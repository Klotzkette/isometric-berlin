/** Keep each viewer's cooperative build slices in foreground browser tasks. */
export function createMobileConstructionTasks(
  yieldTask: () => Promise<void>, signal: AbortSignal, initiallyActive: boolean,
) {
  let active = initiallyActive;
  let serial = 0;
  const waiting = new Map<number, { queued: boolean; resolve: () => void; reject: (reason: unknown) => void }>();

  const abort = () => {
    for (const task of waiting.values()) task.reject(signal.reason);
    waiting.clear();
  };
  signal.addEventListener("abort", abort, { once: true });

  const queue = (id: number) => {
    const task = waiting.get(id);
    if (!task || task.queued || !active) return;
    task.queued = true;
    const failed = (error: unknown) => {
      const pending = waiting.get(id);
      waiting.delete(id);
      pending?.reject(error);
    };
    try {
      void yieldTask().then(() => {
        const pending = waiting.get(id);
        if (!pending) return;
        pending.queued = false;
        if (!active) return;
        waiting.delete(id);
        pending.resolve();
      }, failed);
    } catch (error) { failed(error); }
  };

  return {
    get suspended() { return !active; },
    setActive(value: boolean) {
      if (active === value || signal.aborted) return;
      active = value;
      if (active) for (const id of waiting.keys()) queue(id);
    },
    yieldTask(): Promise<void> {
      if (signal.aborted) return Promise.reject(signal.reason);
      return new Promise((resolve, reject) => {
        const id = ++serial;
        waiting.set(id, { queued: false, resolve, reject });
        queue(id);
      });
    },
  };
}
