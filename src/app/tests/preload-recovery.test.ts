import { describe, expect, test } from "bun:test";

import {
  PRELOAD_RECOVERY_URL_PARAM,
  installPreloadErrorRecovery,
  preloadRecoveryKey,
  withInitialViewerPreloadRecovery,
} from "../src/preloadRecovery";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
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

function preloadError(target: EventTarget, message =
  "Failed to fetch dynamically imported module: https://example.test/assets/ThreeViewer-stale.js") {
  const event = Object.assign(new Event("vite:preloadError", { cancelable: true }), {
    payload: new TypeError(message),
  });
  target.dispatchEvent(event);
  return event;
}

const mainSource = await Bun.file(
  new URL("../src/main.tsx", import.meta.url),
).text();
const engineLoaderSource = await Bun.file(
  new URL("../src/viewerEngineLoader.ts", import.meta.url),
).text();

describe("initial-renderer-only lazy-chunk recovery", () => {
  test("installs before React renders and reloads the initial import only once", async () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    const urlState = mutableUrlState("https://example.test/viewer/?theme=schwellenraum#landmark=reichstag");
    let reloads = 0;
    const remove = installPreloadErrorRecovery({
      eventTarget: target, reload: () => { reloads += 1; }, storage, urlState, version: "1.0.95",
    });
    await withInitialViewerPreloadRecovery(async () => {
      const first = preloadError(target);
      const second = preloadError(target);
      expect(reloads).toBe(1);
      expect(first.defaultPrevented).toBe(true);
      expect(second.defaultPrevented).toBe(false);
    });
    expect(storage.getItem(preloadRecoveryKey("1.0.95"))).toBe("1.0.95");
    expect(urlState.replacementCount()).toBe(0);
    const registration = mainSource.indexOf("installPreloadErrorRecovery({ version: PROJECT_VERSION })");
    expect(registration).toBeGreaterThan(-1);
    expect(registration).toBeLessThan(mainSource.indexOf("root.replaceChildren()"));
    expect(engineLoaderSource).toContain("withInitialViewerPreloadRecovery(");
    expect(engineLoaderSource).toContain('() => import("./ThreeViewer")');
    expect(engineLoaderSource).not.toContain("clearPreloadRecoveryGuard");
    remove();
  });

  test("retains the guard across successful early imports and successive documents", async () => {
    const storage = memoryStorage();
    let reloads = 0;
    for (let document = 0; document < 3; document += 1) {
      const target = new EventTarget();
      const remove = installPreloadErrorRecovery({
        eventTarget: target, reload: () => { reloads += 1; }, storage, urlState: null, version: "1.0.95",
      });
      await withInitialViewerPreloadRecovery(async () => {
        // The first stale initial chunk reloads. A subsequent early import
        // succeeds, then later optional modules fail. A third initial failure
        // must still see the same durable one-shot guard.
        if (document !== 1) expect(preloadError(target).defaultPrevented).toBe(document === 0);
        return "renderer";
      });
      expect(preloadError(target).defaultPrevented).toBe(false);
      expect(storage.getItem(preloadRecoveryKey("1.0.95"))).toBe("1.0.95");
      remove();
    }
    expect(reloads).toBe(1);
    const nextVersion = new EventTarget();
    const remove = installPreloadErrorRecovery({
      eventTarget: nextVersion, reload: () => { reloads += 1; }, storage, urlState: null, version: "1.0.96",
    });
    await withInitialViewerPreloadRecovery(async () => {
      expect(preloadError(nextVersion).defaultPrevented).toBe(true);
    });
    expect(reloads).toBe(2);
    remove();
  });

  test("leaves later optional import errors with their caller and preserves the active scene", async () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    let reloads = 0;
    const remove = installPreloadErrorRecovery({
      eventTarget: target, reload: () => { reloads += 1; }, storage, urlState: null, version: "1.0.95",
    });
    const scene = await withInitialViewerPreloadRecovery(async () => ({ ready: true }));
    const warnings: unknown[] = [];
    // Match Vite's actual helper: an unprevented event rethrows into the
    // optional module's existing catch, instead of replacing the document.
    const event = preloadError(target);
    await Promise.resolve().then(() => {
      if (!event.defaultPrevented) throw event.payload;
    }).catch((error) => warnings.push(error));
    expect(scene).toEqual({ ready: true });
    expect(warnings).toEqual([event.payload]);
    expect(reloads).toBe(0);
    expect(storage.getItem(preloadRecoveryKey("1.0.95"))).toBeNull();
    remove();
  });

  test("closes recovery eligibility on success, rejection and synchronous failure", async () => {
    const target = new EventTarget();
    let reloads = 0;
    const remove = installPreloadErrorRecovery({
      eventTarget: target, reload: () => { reloads += 1; }, storage: memoryStorage(), urlState: null, version: "1.0.95",
    });
    expect(preloadError(target).defaultPrevented).toBe(false);
    expect(await withInitialViewerPreloadRecovery(async () => 42)).toBe(42);
    const failure = new Error("module evaluation failed");
    await expect(withInitialViewerPreloadRecovery(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(withInitialViewerPreloadRecovery(() => { throw failure; })).rejects.toBe(failure);
    expect(preloadError(target).defaultPrevented).toBe(false);
    await withInitialViewerPreloadRecovery(async () => {
      expect(preloadError(target, "The drawn alphabet has no glyph for Ä").defaultPrevented).toBe(false);
      expect(preloadError(target, "Cannot read properties of undefined").defaultPrevented).toBe(false);
      const emptyEvent = new Event("vite:preloadError", { cancelable: true });
      target.dispatchEvent(emptyEvent);
      expect(emptyEvent.defaultPrevented).toBe(false);
    });
    expect(reloads).toBe(0);
    remove();
  });

  test("accepts Chromium, Safari, Firefox and Vite CSS transport failures", async () => {
    for (const message of [
      "Failed to fetch dynamically imported module: https://example.test/ThreeViewer-old.js",
      "Importing a module script failed.",
      "error loading dynamically imported module: https://example.test/ThreeViewer-old.js",
      "Unable to preload CSS for /assets/ThreeViewer-old.css",
    ]) {
      const target = new EventTarget();
      let reloads = 0;
      const remove = installPreloadErrorRecovery({
        eventTarget: target, reload: () => { reloads += 1; }, storage: memoryStorage(), urlState: null, version: "1.0.95",
      });
      await withInitialViewerPreloadRecovery(async () => {
        expect(preloadError(target, message).defaultPrevented).toBe(true);
      });
      expect(reloads).toBe(1);
      remove();
    }
  });

  test("retains a durable URL guard across documents and successful imports when storage is blocked", async () => {
    let reloads = 0;
    const urlState = mutableUrlState(
      "https://example.test/viewer/?theme=schwellenraum&lang=en#landmark=reichstag&view=N",
    );
    const blockedStorage = {
      getItem(): string | null { throw new Error("blocked"); },
      setItem(): void { throw new Error("blocked"); },
    };
    for (let document = 0; document < 3; document += 1) {
      const target = new EventTarget();
      const remove = installPreloadErrorRecovery({
        eventTarget: target, reload: () => { reloads += 1; }, storage: blockedStorage, urlState, version: "1.0.95",
      });
      await withInitialViewerPreloadRecovery(async () => {
        expect(preloadError(target).defaultPrevented).toBe(document === 0);
      });
      expect(preloadError(target).defaultPrevented).toBe(false);
      remove();
    }
    expect(reloads).toBe(1);
    expect(urlState.replacementCount()).toBe(1);
    const guardedUrl = new URL(urlState.getHref());
    expect(guardedUrl.searchParams.get("theme")).toBe("schwellenraum");
    expect(guardedUrl.searchParams.get("lang")).toBe("en");
    expect(guardedUrl.searchParams.get(PRELOAD_RECOVERY_URL_PARAM)).toBe("1.0.95");
    expect(guardedUrl.hash).toBe("#landmark=reichstag&view=N");
  });

  test("does not reload when neither durable guard can be persisted", async () => {
    const target = new EventTarget();
    let reloads = 0;
    const remove = installPreloadErrorRecovery({
      eventTarget: target, reload: () => { reloads += 1; }, storage: null, version: "1.0.95",
      urlState: { getHref: () => "https://example.test/viewer/", replaceHref: () => { throw new Error("blocked"); } },
    });
    await withInitialViewerPreloadRecovery(async () => {
      expect(preloadError(target).defaultPrevented).toBe(false);
    });
    expect(reloads).toBe(0);
    remove();
  });
});
