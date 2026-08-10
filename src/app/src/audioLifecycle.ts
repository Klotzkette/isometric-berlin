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

type PageLifecycleEvent = Event & { persisted?: boolean };

/**
 * Bind procedural audio to the browser page lifecycle.
 *
 * A hidden, frozen or BFCache page is suspended but remains resumable. A real
 * exit disposes every engine exactly once. A blocked autoplay attempt has no
 * armed scheduler, so these resume callbacks cannot start it without a fresh
 * user gesture.
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

  const suspendActive = () => {
    if (state === "active") {
      state = "hidden";
      suspend();
    }
  };
  const resumeHidden = () => {
    if (state === "hidden") {
      state = "active";
      resume();
    }
  };
  const onVisibilityChange = () => {
    if (documentTarget.hidden) {
      suspendActive();
      return;
    }
    resumeHidden();
  };
  const onExit = () => {
    if (state === "exited") {
      return;
    }
    state = "exited";
    dispose();
  };
  const onPageHide = (event: Event) => {
    if ((event as PageLifecycleEvent).persisted === true) {
      suspendActive();
      return;
    }
    onExit();
  };
  const onRestore = () => {
    if (!documentTarget.hidden) {
      resumeHidden();
    }
  };

  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  documentTarget.addEventListener("freeze", suspendActive);
  documentTarget.addEventListener("resume", onRestore);
  windowTarget.addEventListener("pagehide", onPageHide);
  windowTarget.addEventListener("beforeunload", onExit);
  windowTarget.addEventListener("pageshow", onRestore);

  // A page can mount in a background tab. Silence it immediately instead of
  // waiting for a visibility event that may never be dispatched.
  onVisibilityChange();

  return () => {
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
    documentTarget.removeEventListener("freeze", suspendActive);
    documentTarget.removeEventListener("resume", onRestore);
    windowTarget.removeEventListener("pagehide", onPageHide);
    windowTarget.removeEventListener("beforeunload", onExit);
    windowTarget.removeEventListener("pageshow", onRestore);
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
