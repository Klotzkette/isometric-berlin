const PRELOAD_RECOVERY_KEY_PREFIX =
  "isometric-berlin.preload-recovery";
export const PRELOAD_RECOVERY_URL_PARAM = "ib-preload-recovery";

type RecoveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type RecoveryUrlState = {
  getHref: () => string;
  replaceHref: (href: string) => void;
};

export type PreloadRecoveryOptions = {
  version: string;
  eventTarget?: EventTarget;
  reload?: () => void;
  storage?: RecoveryStorage | null;
  urlState?: RecoveryUrlState | null;
};

export function preloadRecoveryKey(version: string): string {
  return `${PRELOAD_RECOVERY_KEY_PREFIX}:${version}`;
}

function browserSessionStorage(): RecoveryStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function browserUrlState(): RecoveryUrlState | null {
  if (typeof window === "undefined") {
    return null;
  }
  return {
    getHref: () => window.location.href,
    replaceHref: (href) => {
      window.history.replaceState(window.history.state, "", href);
    },
  };
}

function readGuard(storage: RecoveryStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function persistStorageGuard(
  storage: RecoveryStorage | null,
  key: string,
  version: string,
): boolean {
  try {
    if (!storage) {
      return false;
    }
    storage.setItem(key, version);
    return storage.getItem(key) === version;
  } catch {
    return false;
  }
}

function readUrlGuard(urlState: RecoveryUrlState | null): string | null {
  try {
    if (!urlState) {
      return null;
    }
    return new URL(urlState.getHref()).searchParams.get(
      PRELOAD_RECOVERY_URL_PARAM,
    );
  } catch {
    return null;
  }
}

function persistUrlGuard(
  urlState: RecoveryUrlState | null,
  version: string,
): boolean {
  try {
    if (!urlState) {
      return false;
    }
    const url = new URL(urlState.getHref());
    url.searchParams.set(PRELOAD_RECOVERY_URL_PARAM, version);
    urlState.replaceHref(url.href);
    return readUrlGuard(urlState) === version;
  } catch {
    return false;
  }
}

function clearUrlGuard(
  urlState: RecoveryUrlState | null,
  version: string,
): void {
  try {
    if (!urlState) {
      return;
    }
    const url = new URL(urlState.getHref());
    if (url.searchParams.get(PRELOAD_RECOVERY_URL_PARAM) !== version) {
      return;
    }
    url.searchParams.delete(PRELOAD_RECOVERY_URL_PARAM);
    urlState.replaceHref(url.href);
  } catch {
    // A successful module import must never fail because URL cleanup did.
  }
}

/**
 * Vite emits this event when a deployment removes a chunk that an already
 * open document still references. Reload exactly once per release/session so
 * that the browser can acquire the current HTML manifest; subsequent failures
 * are deliberately allowed to reach the visible 3D error boundary.
 */
export function installPreloadErrorRecovery(
  options: PreloadRecoveryOptions,
): () => void {
  const eventTarget =
    options.eventTarget ??
    (typeof window === "undefined" ? null : window);
  if (!eventTarget) {
    return () => undefined;
  }

  const storage =
    "storage" in options ? options.storage ?? null : browserSessionStorage();
  const urlState =
    "urlState" in options ? options.urlState ?? null : browserUrlState();
  const key = preloadRecoveryKey(options.version);
  const reload =
    options.reload ??
    (() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  let reloadRequestedForDocument = false;

  const recover = (event: Event): void => {
    if (
      reloadRequestedForDocument ||
      readGuard(storage, key) === options.version ||
      readUrlGuard(urlState) === options.version
    ) {
      return;
    }
    reloadRequestedForDocument = true;
    // sessionStorage is the invisible normal path. Only expose a temporary
    // URL marker when storage cannot be written and read back reliably; this
    // marker survives the reload in the same tab without changing the route,
    // other query parameters or hash.
    const guardPersisted =
      persistStorageGuard(storage, key, options.version) ||
      persistUrlGuard(urlState, options.version);
    if (!guardPersisted) {
      // Without a cross-document guard, reloading could loop forever. Let the
      // lazy rejection reach the visible ErrorBoundary instead.
      return;
    }
    // Vite otherwise rethrows the rejected preload after dispatching this
    // cancelable event, which can race the reload and leave a blank surface.
    event.preventDefault();
    reload();
  };

  eventTarget.addEventListener("vite:preloadError", recover);
  return () => eventTarget.removeEventListener("vite:preloadError", recover);
}

/** Clear the one-shot deployment guard only after the lazy 3D module loads. */
export function clearPreloadRecoveryGuard(
  version: string,
  storage: RecoveryStorage | null = browserSessionStorage(),
  urlState: RecoveryUrlState | null = browserUrlState(),
): void {
  try {
    storage?.removeItem(preloadRecoveryKey(version));
  } catch {
    // Successful loading is enough; blocked storage never harms the viewer.
  }
  clearUrlGuard(urlState, version);
}
