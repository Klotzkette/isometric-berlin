/** Recover a temporary GPU reset without constructing a second city. */
export function createViewerContextRecovery(options: {
  pause: () => void;
  resume: () => void;
  fail: () => void;
  timeoutMs?: number;
  schedule?: (callback: () => void, delay: number) => () => void;
}) {
  const schedule = options.schedule ?? ((callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  });
  let state: "ready" | "lost" | "failed" | "disposed" = "ready";
  let cancel: (() => void) | undefined;
  let generation = 0;
  return {
    lost(event: Event): void {
      // This opts into the browser/Three renderer's context restoration.
      event.preventDefault();
      if (state !== "ready") return;
      state = "lost";
      options.pause();
      const loss = ++generation;
      cancel = schedule(() => {
        if (state !== "lost" || loss !== generation) return;
        state = "failed";
        cancel = undefined;
        options.fail();
      }, options.timeoutMs ?? 20_000);
    },
    restored(): void {
      if (state !== "lost") return;
      cancel?.();
      cancel = undefined;
      state = "ready";
      options.resume();
    },
    dispose(): void {
      state = "disposed";
      cancel?.();
      cancel = undefined;
    },
  };
}
