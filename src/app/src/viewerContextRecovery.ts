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
  let state: "ready" | "lost" | "restored-hidden" | "failed" | "disposed" = "ready";
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
    /** Return true when this transition already resumed the viewer. */
    setActive(value: boolean): boolean {
      if (state === "disposed" || value === active) return false;
      active = value;
      if (!active) cancelTimer();
      else if (state === "restored-hidden") {
        state = "ready";
        options.resume();
        return true;
      } else arm();
      return false;
    },
    lost(event: Event): void {
      // This opts into the browser/Three renderer's context restoration.
      event.preventDefault();
      if (state !== "ready" && state !== "restored-hidden") return;
      const needsPause = state === "ready";
      state = "lost";
      remainingMs = options.timeoutMs ?? 20_000;
      if (needsPause) options.pause();
      arm();
    },
    restored(): void {
      if (state !== "lost") return;
      cancelTimer();
      // WebKit can restore GL while a page is in the back-forward cache.
      // Keep scene uploads and construction paused until the page is visible.
      state = active ? "ready" : "restored-hidden";
      if (active) options.resume();
    },
    dispose(): void {
      state = "disposed";
      cancelTimer();
    },
  };
}
