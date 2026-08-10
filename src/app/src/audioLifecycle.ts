type WindowLifecycleTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener"
>;

type DocumentLifecycleTarget = Pick<
  Document,
  "addEventListener" | "hidden" | "removeEventListener"
>;

export type AudioLifecycleCallbacks = {
  dispose: () => void;
  resume: () => void;
  suspend: () => void;
};

type AudioLifecycleOptions = AudioLifecycleCallbacks & {
  documentTarget: DocumentLifecycleTarget;
  windowTarget: WindowLifecycleTarget;
};

/**
 * Bind procedural audio to the browser page lifecycle.
 *
 * A hidden page is suspended but remains resumable. A real exit or page
 * freeze disposes every engine exactly once. Restoring a BFCache/frozen page
 * merely rearms lifecycle observation; it never starts audio without a new
 * visibility transition or explicit user gesture.
 */
export function registerAudioLifecycle({
  dispose,
  documentTarget,
  resume,
  suspend,
  windowTarget,
}: AudioLifecycleOptions): () => void {
  type State = "active" | "exited" | "hidden";
  let state: State = "active";

  const onVisibilityChange = () => {
    if (documentTarget.hidden) {
      if (state === "active") {
        state = "hidden";
        suspend();
      }
      return;
    }
    if (state === "hidden") {
      state = "active";
      resume();
    }
  };
  const onExit = () => {
    if (state === "exited") {
      return;
    }
    state = "exited";
    dispose();
  };
  const onRestore = () => {
    if (state !== "exited") {
      return;
    }
    // `pagehide`/`freeze` may be followed by BFCache `pageshow`/`resume`.
    // Do not restart here: a fresh gesture or visibility transition owns that.
    state = documentTarget.hidden ? "hidden" : "active";
  };

  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  documentTarget.addEventListener("freeze", onExit);
  documentTarget.addEventListener("resume", onRestore);
  windowTarget.addEventListener("pagehide", onExit);
  windowTarget.addEventListener("beforeunload", onExit);
  windowTarget.addEventListener("pageshow", onRestore);
  windowTarget.addEventListener("focus", onRestore);

  // A page can mount in a background tab. Silence it immediately instead of
  // waiting for a visibility event that may never be dispatched.
  onVisibilityChange();

  return () => {
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
    documentTarget.removeEventListener("freeze", onExit);
    documentTarget.removeEventListener("resume", onRestore);
    windowTarget.removeEventListener("pagehide", onExit);
    windowTarget.removeEventListener("beforeunload", onExit);
    windowTarget.removeEventListener("pageshow", onRestore);
    windowTarget.removeEventListener("focus", onRestore);
  };
}

/** Stop procedural audio for real navigations, tab closes and mobile pagehide. */
export function registerPageExitAudioStop(
  target: WindowLifecycleTarget,
  stop: () => void,
): () => void {
  target.addEventListener("pagehide", stop);
  target.addEventListener("beforeunload", stop);
  return () => {
    target.removeEventListener("pagehide", stop);
    target.removeEventListener("beforeunload", stop);
  };
}
