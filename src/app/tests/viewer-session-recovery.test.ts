import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NavigationSnapshot } from "../src/navigationContinuity";
import { PRELOAD_RECOVERY_URL_PARAM } from "../src/preloadRecovery";
import {
  readViewerVisit,
  saveViewerVisit,
  VIEWER_VISIT_HISTORY_KEY,
  watchViewerVisit,
  type ViewerVisit,
} from "../src/viewerSessionRecovery";

function browser() {
  let state: unknown = { retainedKey: { count: 7 } };
  let writes = 0;
  const location = new URL("https://example.test/berlin/?theme=day&lang=en&source=walking%20tour#landmark=reichstag");
  const history = {
    get state() { return structuredClone(state); },
    replaceState(value: unknown, _unused: string, url?: string) {
      expect(url).toBeUndefined();
      state = structuredClone(value);
      writes++;
    },
  };
  const target = { history, location } as unknown as Parameters<typeof readViewerVisit>[0];
  return {
    target, location, history, writes: () => writes,
    setState: (next: unknown) => { state = next; },
  };
}

function checkpoint(): ViewerVisit {
  const walking = {
    grounded: false, groundLayer: "tunnel", groundY: -12.75, insideTunnel: true, jumpOffset: 1.75,
    jumpOriginY: -14.5, pitch: -.25, verticalVelocity: -3.75, x: 1500.25, yaw: 1.75, z: -110.5,
  } as const;
  const navigation: NavigationSnapshot = {
    pose: { position: [1500.25, -9.2, -110.5], target: [1496, -10, -115] },
    fov: 66, near: .08, far: 16000, minDistance: .5, maxDistance: 12000,
    focusedCameraFov: null, underside: false,
    pedestrian: {
      enabled: true, requested: true, state: walking,
      savedPose: { position: [1500, 250, -100], target: [1501, 10, -107] },
      savedFov: 16, savedNear: .25, savedUnderside: true,
      recoveryHistory: { checkpoints: [{ ...walking, grounded: true, jumpOffset: 0 }], lastRecorded: walking },
    },
  };
  return { mode: "night", navigation, selected: "Reichstagsgebäude" };
}

test("only a re-created same entry resumes the exact selected mode and navigation", () => {
  const b = browser(), visit = checkpoint();
  const original = b.location.href;
  saveViewerVisit(b.target, visit);
  expect(b.history.state).toHaveProperty("retainedKey", { count: 7 });
  expect(b.location.href).toBe(original);
  const retained = b.history.state;
  // A new entry for the exact same URL has no classic history state.
  b.setState(null);
  expect(readViewerVisit(b.target)).toBeNull();
  // Going back into a re-created document exposes the original entry's state.
  b.setState(retained);
  expect(readViewerVisit(b.target)).toEqual(visit);
  b.location.searchParams.set(PRELOAD_RECOVERY_URL_PARAM, "1.0.212");
  expect(readViewerVisit(b.target)).toEqual(visit);
  b.location.hash = "#landmark=brandenburger-tor";
  expect(readViewerVisit(b.target)).toBeNull();
  b.location.href = original;
  b.location.searchParams.set("theme", "minecraft");
  expect(readViewerVisit(b.target)).toBeNull();
});

test("a mode change keeps a usable checkpoint through a pending renderer remount", () => {
  const b = browser(), visit = checkpoint();
  saveViewerVisit(b.target, visit);
  saveViewerVisit(b.target, checkpoint());
  expect(b.writes()).toBe(1);
  saveViewerVisit(b.target, { mode: "minecraft", navigation: null, selected: null });
  expect(readViewerVisit(b.target)).toEqual({ ...visit, mode: "minecraft" });
  saveViewerVisit(b.target, {
    ...visit, mode: "day",
    navigation: { ...visit.navigation!, pose: { position: [40, 50, 60], target: [1, 2, 3] } },
  });
  expect(readViewerVisit(b.target)?.navigation?.pose.position).toEqual([40, 50, 60]);
  expect(b.writes()).toBe(3);
});

test("invalid pose, lenses or pedestrian payloads fall back to the mode alone", () => {
  const b = browser(), visit = checkpoint();
  const original = visit.navigation!;
  saveViewerVisit(b.target, visit);
  const persisted = (b.history.state as Record<string, object>)[VIEWER_VISIT_HISTORY_KEY];
  for (const navigation of [
    { ...original, pose: { ...original.pose, position: [0, NaN, 0] } },
    { ...original, pose: { ...original.pose, position: original.pose.target } },
    { ...original, pose: { ...original.pose, position: [1e300, 0, 0] } },
    { ...original, near: original.far },
    { ...original, focusedCameraFov: 180 },
    { ...original, pedestrian: { ...original.pedestrian, environment: {} } },
    { ...original, pedestrian: { ...original.pedestrian, state: { ...original.pedestrian.state!, groundLayer: "sky" } } },
    { ...original, pedestrian: { ...original.pedestrian, recoveryHistory: {
      ...original.pedestrian.recoveryHistory, checkpoints: Array(49).fill(original.pedestrian.state),
    } } },
    { ...original, pedestrian: { ...original.pedestrian, recoveryHistory: {
      ...original.pedestrian.recoveryHistory, checkpoints: Array(2),
    } } },
  ]) {
    b.setState({ [VIEWER_VISIT_HISTORY_KEY]: { ...persisted, navigation } });
    expect(readViewerVisit(b.target)).toEqual({ ...visit, navigation: null });
  }
  b.setState({ [VIEWER_VISIT_HISTORY_KEY]: { ...persisted, schema: 2 } });
  expect(readViewerVisit(b.target)).toBeNull();
});

test("keeps unrelated non-record history and tolerates blocked history", () => {
  const b = browser(), visit = checkpoint();
  b.setState(["host history"]);
  saveViewerVisit(b.target, visit);
  expect(b.history.state).toEqual(["host history"]);
  expect(b.writes()).toBe(0);
  Object.defineProperty(b.target, "history", { get: () => { throw new Error("Blocked"); } });
  expect(() => saveViewerVisit(b.target, visit)).not.toThrow();
  expect(readViewerVisit(b.target)).toBeNull();
});

test("checkpoints use one foreground timer plus hide and pagehide, with complete cleanup", () => {
  let run: (() => void) | undefined;
  const windowTarget = Object.assign(new EventTarget(), {
    setInterval(callback: () => void, delay: number) {
      expect(delay).toBe(10_000);
      run = callback;
      return 1;
    },
    clearInterval(id: number) {
      expect(id).toBe(1);
      run = undefined;
    },
  }) as unknown as Parameters<typeof watchViewerVisit>[0];
  const page = Object.assign(new EventTarget(), { hidden: false });
  let calls = 0;
  const unwatch = watchViewerVisit(windowTarget, page, () => { calls++; });
  page.dispatchEvent(new Event("visibilitychange"));
  run!();
  page.hidden = true;
  page.dispatchEvent(new Event("visibilitychange"));
  run!();
  windowTarget.dispatchEvent(new Event("pagehide"));
  expect(calls).toBe(3);
  unwatch();
  expect(run).toBeUndefined();
  page.dispatchEvent(new Event("visibilitychange"));
  windowTarget.dispatchEvent(new Event("pagehide"));
  expect(calls).toBe(3);
});

async function renderApp(b: ReturnType<typeof browser>, entry: "retained" | "fresh-link" | "fresh-plain") {
  const globals = new Map(["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      ...b.target, localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }),
    } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { baseURI: b.location.href } });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language: "en", maxTouchPoints: 0 } });
    // Distinct document boots evaluate the same production module independently.
    const { App } = await import(`../src/App.tsx?viewer-session=${entry}`);
    return renderToStaticMarkup(createElement(App));
  } finally {
    for (const [key, descriptor] of globals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  }
}

test("the actual App restores the traversed entry's live mode and walking shell without timing APIs", async () => {
  const b = browser();
  saveViewerVisit(b.target, checkpoint());
  const markup = await renderApp(b, "retained");
  expect(markup).toContain("app-shell--night");
  expect(markup).toContain("app-shell--pedestrian");
  expect(markup).toContain('aria-busy="true"');
  expect(markup).not.toContain("startup-mode-selection");
});

test("the actual App respects a fresh empty entry with and without a theme link", async () => {
  const b = browser();
  saveViewerVisit(b.target, checkpoint());
  b.setState(null);
  const linked = await renderApp(b, "fresh-link");
  expect(linked).toContain("app-shell--day");
  expect(linked).not.toContain("app-shell--night");
  expect(linked).not.toContain("app-shell--pedestrian");
  expect(linked).not.toContain("startup-mode-selection");

  b.location.search = "";
  b.location.hash = "";
  expect(await renderApp(b, "fresh-plain")).toContain("startup-mode-selection");
});
