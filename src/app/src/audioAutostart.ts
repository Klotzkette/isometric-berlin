/**
 * First-gesture audio start.
 *
 * Browsers refuse to let an unmuted AudioContext run before the user has
 * interacted with the page, so "music on load" can only ever mean: try
 * immediately, and otherwise start on the very first gesture the visitor
 * makes. Two details decide whether that actually works on a phone:
 *
 * - the listeners must run in the CAPTURE phase on `window`, because the
 *   first gesture is nearly always a map drag, and the canvas handlers
 *   call `stopPropagation()` — a bubble-phase window listener never sees
 *   it, which is why the soundtrack stayed silent until someone happened
 *   to press a button;
 * - `AudioContext.resume()` must be reached SYNCHRONOUSLY inside the
 *   handler. iOS Safari discards the gesture the moment the call stack
 *   yields, so `start` is invoked directly and only its returned promise
 *   is awaited.
 */

/** Gestures a browser accepts as "the user interacted with the page". */
export const FIRST_GESTURE_EVENTS = [
  "pointerdown",
  "pointermove",
  "touchstart",
  "touchend",
  "mousedown",
  "keydown",
  "wheel",
  "scroll",
  "click",
] as const;

/** Keys bound to viewer shortcuts that must not double as an audio start. */
const IGNORED_KEYS = new Set(["b", "t", "n"]);

// A pointerdown/touchstart resume can remain pending in Safari and embedded
// browsers even though the later click/touchend in the same physical gesture
// is accepted. Let that stronger completion event supersede the stale attempt
// instead of leaving the soundtrack locked in "waiting" forever.
const RETRY_WHILE_PENDING_EVENTS = new Set(["click", "touchend", "keydown"]);

export interface FirstGestureTarget {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: EventListenerOptions,
  ): void;
}

export interface FirstGestureOptions {
  /** True while the visitor has explicitly muted; no attempt is made. */
  isMuted?: () => boolean;
  /**
   * Starts the engine. Called synchronously from the gesture handler and
   * must itself reach `AudioContext.resume()` before awaiting anything.
   */
  start: () => Promise<boolean>;
  target: FirstGestureTarget;
}

export interface VisibleAutoplayRetryOptions {
  documentTarget: Pick<
    Document,
    "addEventListener" | "hidden" | "removeEventListener"
  >;
  isAudible: () => boolean;
  isEnabled: () => boolean;
  start: () => Promise<boolean>;
  windowTarget: Pick<Window, "addEventListener" | "removeEventListener">;
}

/**
 * Retry a permitted load-time start when Chrome first exposes the page.
 *
 * A tab opened in the background skips App's eager attempt because starting
 * sound while hidden would be hostile and is rejected by browsers anyway.
 * `visibilitychange`, `pageshow`, and window focus are the earliest later
 * opportunities at which an origin with autoplay permission can begin. They
 * do not bypass browser policy: a fresh origin still falls through to the
 * first-gesture listener above.
 */
export function registerVisibleAutoplayRetry({
  documentTarget,
  isAudible,
  isEnabled,
  start,
  windowTarget,
}: VisibleAutoplayRetryOptions): () => void {
  let cancelled = false;
  let attempting = false;
  const retry = () => {
    if (
      cancelled ||
      attempting ||
      documentTarget.hidden ||
      !isEnabled() ||
      isAudible()
    ) {
      return;
    }
    attempting = true;
    let result: Promise<boolean>;
    try {
      result = start();
    } catch {
      attempting = false;
      return;
    }
    void result.then(
      () => {
        attempting = false;
      },
      () => {
        attempting = false;
      },
    );
  };
  documentTarget.addEventListener("visibilitychange", retry);
  windowTarget.addEventListener("focus", retry);
  windowTarget.addEventListener("pageshow", retry);
  return () => {
    cancelled = true;
    documentTarget.removeEventListener("visibilitychange", retry);
    windowTarget.removeEventListener("focus", retry);
    windowTarget.removeEventListener("pageshow", retry);
  };
}

/**
 * Arms the first-gesture start and returns the teardown.
 *
 * The listeners survive a failed attempt: an autoplay block can outlive a
 * single tap, so only a genuine start disarms them.
 */
export function registerFirstGestureStart(
  options: FirstGestureOptions,
): () => void {
  const { isMuted, start, target } = options;
  let cancelled = false;
  let attempting = false;
  let attemptGeneration = 0;
  const attempt = (event: Event) => {
    if (
      cancelled ||
      (attempting && !RETRY_WHILE_PENDING_EVENTS.has(event.type))
    ) {
      return;
    }
    if (isMuted?.()) {
      return;
    }
    if (isIgnoredGesture(event)) {
      return;
    }
    attempting = true;
    const generation = ++attemptGeneration;
    // No await before this call: the gesture must still be "active".
    const started = start();
    void started.then(
      (ok) => {
        if (generation !== attemptGeneration) {
          return;
        }
        attempting = false;
        if (ok) {
          teardown();
        }
      },
      () => {
        if (generation !== attemptGeneration) {
          return;
        }
        attempting = false;
      },
    );
  };
  const teardown = () => {
    for (const type of FIRST_GESTURE_EVENTS) {
      target.removeEventListener(type, attempt, { capture: true });
    }
  };
  for (const type of FIRST_GESTURE_EVENTS) {
    target.addEventListener(type, attempt, { capture: true, passive: true });
  }
  return () => {
    cancelled = true;
    teardown();
  };
}

/**
 * True for gestures that belong to the audio buttons or to a viewer
 * shortcut — those carry their own handlers and must not be hijacked.
 */
export function isIgnoredGesture(event: Event): boolean {
  const key = (event as KeyboardEvent).key;
  if (event.type === "keydown" && typeof key === "string") {
    if (IGNORED_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }
  const target = event.target;
  if (
    target !== null &&
    typeof target === "object" &&
    "closest" in target &&
    typeof (target as Element).closest === "function"
  ) {
    return (target as Element).closest("[data-audio-toggle]") !== null;
  }
  return false;
}

/**
 * Whether a tap on an audio toggle button ("Dusk Republic" / ambient
 * music) should STOP the engine rather than start it.
 *
 * v0.56.2 mobile bug: on a phone the visitor's very first gesture on the
 * page is often something OTHER than the audio button itself — e.g. the
 * "…" overflow button that opens the sheet the audio button lives in.
 * `registerFirstGestureStart` above still treats that as "the first
 * gesture" (correctly — `isIgnoredGesture` only special-cases taps that
 * land ON a `[data-audio-toggle]` element or the reserved shortcut keys),
 * so it can already have started the engine before the visitor's next
 * tap lands on the visible toggle. A toggle that branches on "intent"
 * state (true from first render, to auto-play on desktop where the
 * button tap itself usually IS the first gesture and no race exists)
 * then reads that pre-existing intent and immediately stops the engine
 * again — the same shape of bug as the N-shortcut collision in v0.52.1,
 * just via a race instead of a missing ignore-list entry. The fix is to
 * always branch on whether the engine is actually AUDIBLE right now, not
 * on stored intent: a silent engine always means "start", a sounding one
 * always means "stop", regardless of how it got into that state.
 */
export function shouldStopAudioOnToggleTap(isAudibleNow: boolean): boolean {
  return isAudibleNow;
}
