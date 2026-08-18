import { describe, expect, test } from "bun:test";

import {
  PRELOAD_RECOVERY_URL_PARAM,
  clearPreloadRecoveryGuard,
  installPreloadErrorRecovery,
  preloadRecoveryKey,
} from "../src/preloadRecovery";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function mutableUrlState(initialHref: string) {
  let href = initialHref;
  let replacements = 0;
  return {
    getHref: () => href,
    replaceHref(nextHref: string) {
      href = nextHref;
      replacements += 1;
    },
    replacementCount: () => replacements,
  };
}

const mainSource = await Bun.file(
  new URL("../src/main.tsx", import.meta.url),
).text();
const engineLoaderSource = await Bun.file(
  new URL("../src/viewerEngineLoader.ts", import.meta.url),
).text();

describe("version-bound lazy-chunk recovery", () => {
  test("installs before React renders and reloads only once", () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    const urlState = mutableUrlState(
      "https://example.test/viewer/?theme=schwellenraum#landmark=reichstag",
    );
    let reloads = 0;
    const remove = installPreloadErrorRecovery({
      eventTarget: target,
      reload: () => {
        reloads += 1;
      },
      storage,
      urlState,
      version: "0.73.0",
    });

    const first = new Event("vite:preloadError", { cancelable: true });
    const second = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(first);
    target.dispatchEvent(second);

    expect(reloads).toBe(1);
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(false);
    expect(storage.getItem(preloadRecoveryKey("0.73.0"))).toBe("0.73.0");
    expect(urlState.replacementCount()).toBe(0);

    const registration = mainSource.indexOf(
      "installPreloadErrorRecovery({ version: PROJECT_VERSION })",
    );
    expect(registration).toBeGreaterThan(-1);
    expect(registration).toBeLessThan(mainSource.indexOf("root.replaceChildren()"));
    remove();
  });

  test("honours an existing version guard instead of looping", () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    storage.setItem(preloadRecoveryKey("0.73.0"), "0.73.0");
    let reloads = 0;
    installPreloadErrorRecovery({
      eventTarget: target,
      reload: () => {
        reloads += 1;
      },
      storage,
      version: "0.73.0",
    });

    const event = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(event);

    expect(reloads).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  test("clears only the successful release guard after the lazy import", () => {
    const storage = memoryStorage();
    storage.setItem(preloadRecoveryKey("0.72.9"), "0.72.9");
    storage.setItem(preloadRecoveryKey("0.73.0"), "0.73.0");

    clearPreloadRecoveryGuard("0.73.0", storage);

    expect(storage.getItem(preloadRecoveryKey("0.73.0"))).toBeNull();
    expect(storage.getItem(preloadRecoveryKey("0.72.9"))).toBe("0.72.9");
    expect(engineLoaderSource.indexOf('await import("./ThreeViewer")')).toBeLessThan(
      engineLoaderSource.indexOf("clearPreloadRecoveryGuard(PROJECT_VERSION)"),
    );
  });

  test("uses one durable URL reload across documents when storage is blocked", () => {
    let reloads = 0;
    const originalHref =
      "https://example.test/viewer/?theme=schwellenraum&lang=en#landmark=reichstag&view=N";
    const urlState = mutableUrlState(originalHref);
    const blockedStorage = {
      getItem(): string | null {
        throw new Error("blocked");
      },
      removeItem(): void {
        throw new Error("blocked");
      },
      setItem(): void {
        throw new Error("blocked");
      },
    };
    const simulateDocument = () => {
      const target = new EventTarget();
      installPreloadErrorRecovery({
        eventTarget: target,
        reload: () => {
          reloads += 1;
        },
        storage: blockedStorage,
        urlState,
        version: "0.73.0",
      });
      const event = new Event("vite:preloadError", { cancelable: true });
      target.dispatchEvent(event);
      return event;
    };

    const first = simulateDocument();
    const second = simulateDocument();
    const third = simulateDocument();

    expect(reloads).toBe(1);
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(false);
    expect(third.defaultPrevented).toBe(false);

    const guardedUrl = new URL(urlState.getHref());
    expect(guardedUrl.searchParams.get("theme")).toBe("schwellenraum");
    expect(guardedUrl.searchParams.get("lang")).toBe("en");
    expect(guardedUrl.searchParams.get(PRELOAD_RECOVERY_URL_PARAM)).toBe(
      "0.73.0",
    );
    expect(guardedUrl.hash).toBe("#landmark=reichstag&view=N");

    clearPreloadRecoveryGuard("0.73.0", blockedStorage, urlState);

    const cleanedUrl = new URL(urlState.getHref());
    expect(cleanedUrl.searchParams.get(PRELOAD_RECOVERY_URL_PARAM)).toBeNull();
    expect(cleanedUrl.searchParams.get("theme")).toBe("schwellenraum");
    expect(cleanedUrl.searchParams.get("lang")).toBe("en");
    expect(cleanedUrl.hash).toBe("#landmark=reichstag&view=N");
  });

  test("does not reload when neither durable guard can be persisted", () => {
    const target = new EventTarget();
    let reloads = 0;
    installPreloadErrorRecovery({
      eventTarget: target,
      reload: () => {
        reloads += 1;
      },
      storage: null,
      urlState: {
        getHref: () => "https://example.test/viewer/",
        replaceHref: () => {
          throw new Error("blocked");
        },
      },
      version: "0.73.0",
    });

    const event = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(event);

    expect(reloads).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
