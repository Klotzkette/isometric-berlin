const PRELOAD_RECOVERY_KEY_PREFIX =
  "isometric-berlin.preload-recovery";
export const PRELOAD_RECOVERY_URL_PARAM = "ib-preload-recovery";

type RecoveryStorage = Pick<Storage, "getItem" | "setItem">;
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

let initialViewerImportsPending = 0;

/** Only the initial renderer import may replace the entire document. */
export async function withInitialViewerPreloadRecovery<T>(
  load: () => Promise<T>,
): Promise<T> {
  initialViewerImportsPending += 1;
  try {
    return await load();
  } finally {
    initialViewerImportsPending -= 1;
  }
}

function isModuleTransportFailure(event: Event): boolean {
  const payload = (event as Event & { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object" || !("message" in payload)) {
    return false;
  }
  // Vite forwards both failed chunk requests and arbitrary module evaluation
  // errors here. A syntax/constructor error is not fixed by reloading. These
  // are the transport messages used by Chromium, Safari, Firefox and Vite CSS.
  return typeof payload.message === "string" &&
    /^(?:Failed to fetch dynamically imported module\b|Importing a module script failed\b|error loading dynamically imported module\b|Unable to preload CSS for\b)/i.test(payload.message);
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

/**
 * Vite emits this event when a deployment removes a chunk that an already
 * open document still references. Only a failed initial renderer import may
 * reload, once per release/session. Later city/detail imports belong to their
 * callers' error handling and must not discard a running viewer. A successful
 * early import must not erase the durable guard for subsequent documents.
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
      initialViewerImportsPending === 0 ||
      !isModuleTransportFailure(event) ||
      reloadRequestedForDocument ||
      readGuard(storage, key) === options.version ||
      readUrlGuard(urlState) === options.version
    ) {
      return;
    }
    reloadRequestedForDocument = true;
    // sessionStorage is the invisible normal path. Only expose a version-bound
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
