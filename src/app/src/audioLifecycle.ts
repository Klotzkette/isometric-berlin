type PageExitTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener"
>;

/** Stop procedural audio for real navigations, tab closes and mobile pagehide. */
export function registerPageExitAudioStop(
  target: PageExitTarget,
  stop: () => void,
): () => void {
  target.addEventListener("pagehide", stop);
  target.addEventListener("beforeunload", stop);
  return () => {
    target.removeEventListener("pagehide", stop);
    target.removeEventListener("beforeunload", stop);
  };
}
