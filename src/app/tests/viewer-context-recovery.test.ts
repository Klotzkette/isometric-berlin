import { expect, test } from "bun:test";
import { createViewerContextRecovery } from "../src/viewerContextRecovery";

function harness() {
  const calls: string[] = [];
  const pending = new Set<() => void>();
  const recovery = createViewerContextRecovery({
    pause: () => calls.push("pause"), resume: () => calls.push("resume"), fail: () => calls.push("fail"),
    schedule: callback => { pending.add(callback); return () => { pending.delete(callback); }; },
  });
  const lose = () => { const event = new Event("webglcontextlost", { cancelable: true }); recovery.lost(event); return event; };
  return { recovery, calls, pending, lose };
}

test("repeated temporary GPU resets preserve the runtime and cancel the fallback", () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    expect(h.lose().defaultPrevented).toBe(true);
    h.lose(); // Repeated events do not duplicate timers or pause work twice.
    expect(h.pending.size).toBe(1);
    const staleTimeout = [...h.pending][0];
    h.recovery.restored();
    staleTimeout();
    h.recovery.restored();
    expect(h.pending.size).toBe(0);
  }
  expect(h.calls).toEqual(["pause", "resume", "pause", "resume", "pause", "resume"]);
});

test("an unavailable GPU falls back exactly once, without resuming an expired runtime", () => {
  const h = harness(); h.lose();
  const timeout = [...h.pending][0]; timeout(); timeout();
  h.lose(); h.recovery.restored();
  expect(h.calls).toEqual(["pause", "fail"]);
});

test("unmount cancels pending recovery and ignores late browser events", () => {
  const h = harness(); h.lose(); const timeout = [...h.pending][0];
  h.recovery.dispose(); timeout(); h.recovery.restored(); h.lose();
  expect(h.pending.size).toBe(0);
  expect(h.calls).toEqual(["pause"]);
});


test("a cancelled older timeout cannot expire a later GPU reset", () => {
  const h = harness(); h.lose(); const oldTimeout = [...h.pending][0];
  h.recovery.restored(); h.lose(); oldTimeout();
  expect(h.calls).toEqual(["pause", "resume", "pause"]);
  h.recovery.restored();
  expect(h.calls.at(-1)).toBe("resume");
});

test("restoring a desktop startup retries deferred details even when visibility only resumes mobile work", async () => {
  const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  const start = source.indexOf("        resume: () => {", source.indexOf("contextRecovery = createViewerContextRecovery"));
  const body = source.slice(start + "        resume: () => {".length, source.indexOf("\n        },\n        fail:", start));
  const calls: string[] = [];
  const runtime = { worldFailureReported: false, contextLost: true, renderInvalidated: false,
    shadowInvalidated: false, startDeferredDetails: () => calls.push("details"),
    surroundingCity: { refresh: () => calls.push("city") } };
  const renderer = { shadowMap: { needsUpdate: false } };
  // Execute the shipped restoration callback, with an already-visible desktop
  // tab. Visibility resumption itself deliberately does not start park details.
  new Function("runtime", "renderer", "resize", "onVisibilityChange", "notifyPresentationReadyWhenPossible",
    `let disposed=false,lastAnimateAt=1,lastRenderedAt=1,lastEvaluationAt=1,lastOrdinaryEnvironmentFrameAt=1;${body}`
  )(runtime, renderer, () => calls.push("resize"), () => calls.push("visible"), () => calls.push("ready"));
  expect(runtime.contextLost).toBe(false);
  expect(runtime.renderInvalidated).toBe(true);
  expect(renderer.shadowMap.needsUpdate).toBe(true);
  expect(calls).toEqual(["resize", "visible", "details", "city", "ready"]);
});

function activityHarness(initiallyActive = true) {
  let time = 0;
  const calls: string[] = [];
  const jobs: Array<{ callback: () => void; delay: number; cancelled: boolean }> = [];
  const recovery = createViewerContextRecovery({
    initiallyActive, now: () => time,
    pause: () => calls.push("pause"), resume: () => calls.push("resume"), fail: () => calls.push("fail"),
    schedule: (callback, delay) => {
      const job = { callback, delay, cancelled: false }; jobs.push(job);
      return () => { job.cancelled = true; };
    },
  });
  const lose = () => recovery.lost(new Event("webglcontextlost", { cancelable: true }));
  return { recovery, calls, jobs, lose, advance: (ms: number) => { time += ms; } };
}

test("background context loss does not expire before the browser can restore it", () => {
  const h = activityHarness(false);
  h.lose(); h.advance(120_000);
  expect(h.jobs).toHaveLength(0);
  expect(h.calls).toEqual(["pause"]);
  h.recovery.setActive(true);
  expect(h.jobs).toHaveLength(1);
  expect(h.jobs[0].delay).toBe(20_000);
  h.recovery.restored(); h.jobs[0].callback();
  expect(h.jobs[0].cancelled).toBe(true);
  expect(h.calls).toEqual(["pause", "resume"]);
});

test("suspension preserves the remaining foreground deadline and rejects stale timeout jobs", () => {
  const h = activityHarness(); h.lose(); h.advance(6_000);
  h.recovery.setActive(false);
  expect(h.jobs[0].cancelled).toBe(true);
  h.advance(120_000); h.jobs[0].callback();
  expect(h.calls).toEqual(["pause"]);
  h.recovery.setActive(true); h.recovery.setActive(true);
  expect(h.jobs).toHaveLength(2);
  expect(h.jobs[1].delay).toBe(14_000);
  h.jobs[0].callback();
  expect(h.calls).toEqual(["pause"]);
  h.advance(14_000); h.jobs[1].callback(); h.jobs[1].callback();
  h.recovery.restored();
  expect(h.calls).toEqual(["pause", "fail"]);
});

test("restoration while hidden and disposal never rearm an obsolete loss", () => {
  const h = activityHarness(); h.lose();
  h.recovery.setActive(false); h.recovery.restored();
  expect(h.calls).toEqual(["pause"]);
  expect(h.recovery.setActive(true)).toBe(true);
  expect(h.recovery.setActive(true)).toBe(false);
  expect(h.calls).toEqual(["pause", "resume"]);
  expect(h.jobs).toHaveLength(1);
  h.lose(); h.recovery.setActive(false); h.recovery.dispose();
  h.recovery.setActive(true); h.recovery.restored();
  for (const job of h.jobs) job.callback();
  expect(h.calls).toEqual(["pause", "resume", "pause"]);
  expect(h.jobs).toHaveLength(2);
});

test("a second hidden loss supersedes a hidden restoration without prematurely resuming", () => {
  const h = activityHarness(false);
  h.lose(); h.recovery.restored(); h.lose();
  expect(h.recovery.setActive(true)).toBe(false);
  expect(h.calls).toEqual(["pause"]);
  expect(h.jobs).toHaveLength(1);
  h.recovery.restored();
  expect(h.calls).toEqual(["pause", "resume"]);
});

test("discarding a page while its restored context is hidden never resumes the old viewer", () => {
  const h = activityHarness(false);
  h.lose(); h.recovery.restored(); h.recovery.dispose();
  expect(h.recovery.setActive(true)).toBe(false);
  expect(h.calls).toEqual(["pause"]);
});

test("mobile page suspension releases the full-size frame targets once and restores their exact size", async () => {
  const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  const start = source.indexOf("const onVisibilityChange = () => {");
  const handlers = source.slice(start, source.indexOf("const onDoubleClick", start));
  const calls: boolean[] = [], construction: boolean[] = [], sizes: number[][] = [];
  const browser = { hidden: false };
  const runtime = { contextLost: false, renderInvalidated: false, progressiveWorldState: "complete",
    mobileConstruction: { setActive: (value: boolean) => construction.push(value) } };
  const bindings = {
    document: browser, runtime, coarsePointer: true, appliedWidth: 390, appliedHeight: 844, appliedPixelRatio: 1.35,
    resetTouchGesture() {}, cancelScheduledProgressiveWorld() {}, progressiveWorldVisibilityTransition: () => "none",
    contextRecovery: { setActive: (active: boolean) => { calls.push(active); return false; } },
    composer: { setSize: (w: number, h: number) => sizes.push([w, h]) },
    resize: () => {},
  };
  const compiled = new Bun.Transpiler({loader: "ts"}).transformSync(handlers);
  const mount = new Function(...Object.keys(bindings), `
    let recoveryPageHidden=false, mobileFrameTargetsSuspended=false, gpuWarmupTimer=null;
    ${compiled}
    return { onVisibilityChange, onPageHide, onPageShow };
  `);
  const events = mount(...Object.values(bindings));
  events.onPageHide(); events.onVisibilityChange();
  browser.hidden = true;
  events.onPageShow({persisted:true});
  expect(sizes).toEqual([[1, 1]]);
  browser.hidden = false;
  events.onVisibilityChange(); events.onVisibilityChange();
  expect(calls).toEqual([false, false, false, true, true]);
  expect(construction).toEqual(calls);
  expect(sizes).toEqual([[1, 1], [390 * 1.35, 844 * 1.35]]);
  expect(runtime.renderInvalidated).toBe(true);
  runtime.contextLost = true;
  events.onVisibilityChange();
  expect(calls.at(-1)).toBe(true);
  expect(construction.at(-1)).toBe(false);
});
