/** Recover a temporary GPU reset without constructing a second city. */
export function createViewerContextRecovery(options: {
  pause: () => void;
  resume: () => void;
  fail: () => void;
  timeoutMs?: number;
  initiallyActive?: boolean;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => () => void;
}) {
  const schedule = options.schedule ?? ((callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  });
  let state: "ready" | "lost" | "failed" | "disposed" = "ready";
  let cancel: (() => void) | undefined;
  let generation = 0;
  let active = options.initiallyActive ?? true;
  const now = options.now ?? (() => performance.now());
  let remainingMs = options.timeoutMs ?? 20_000;
  let armedAt: number | undefined;
  const cancelTimer = (): void => {
    generation++;
    cancel?.();
    cancel = undefined;
    if (armedAt !== undefined) remainingMs = Math.max(0, remainingMs - (now() - armedAt));
    armedAt = undefined;
  };
  const arm = (): void => {
    if (state !== "lost" || !active || cancel) return;
    const loss = ++generation;
    armedAt = now();
    cancel = schedule(() => {
      if (state !== "lost" || !active || loss !== generation) return;
      state = "failed";
      cancel = undefined;
      armedAt = undefined;
      options.fail();
    }, remainingMs);
  };
  return {
    /** Count only foreground recovery time; background GPU restoration may be suspended. */
    setActive(value: boolean): void {
      if (state === "disposed" || value === active) return;
      active = value;
      if (!active) cancelTimer();
      else arm();
    },
    lost(event: Event): void {
      // This opts into the browser/Three renderer's context restoration.
      event.preventDefault();
      if (state !== "ready") return;
      state = "lost";
      remainingMs = options.timeoutMs ?? 20_000;
      options.pause();
      arm();
    },
    restored(): void {
      if (state !== "lost") return;
      cancelTimer();
      state = "ready";
      options.resume();
    },
    dispose(): void {
      state = "disposed";
      cancelTimer();
    },
  };
}
