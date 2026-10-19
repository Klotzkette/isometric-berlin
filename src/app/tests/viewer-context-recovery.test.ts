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
  h.recovery.setActive(false); h.recovery.restored(); h.recovery.setActive(true);
  expect(h.calls).toEqual(["pause", "resume"]);
  expect(h.jobs).toHaveLength(1);
  h.lose(); h.recovery.setActive(false); h.recovery.dispose();
  h.recovery.setActive(true); h.recovery.restored();
  for (const job of h.jobs) job.callback();
  expect(h.calls).toEqual(["pause", "resume", "pause"]);
  expect(h.jobs).toHaveLength(2);
});

test("production visibility/page suspension feeds the recovery clock independently of contextLost", async () => {
  const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  const calls: boolean[] = [];
  const contextRecovery = { setActive: (active: boolean) => calls.push(active) };
  const prefix = (start: string, end: string) => {
    const from = source.indexOf(start) + start.length;
    return source.slice(from, source.indexOf(end, from));
  };
  const visible = prefix("const onVisibilityChange = () => {", "if (document.hidden || runtime.contextLost)");
  const hide = prefix("const onPageHide = () => {", "if (gpuWarmupTimer !== null)");
  const show = prefix("const onPageShow = (event: PageTransitionEvent) => {", "if (!event.persisted)");
  // A bfcache pagehide remains suspended even if visibility changes first;
  // pageshow rearms only once the actual document is visible too.
  new Function("contextRecovery", `let recoveryPageHidden=false; const document={hidden:false};
    ${hide} ${visible} ${show} document.hidden=true; ${visible}`)(contextRecovery);
  expect(calls).toEqual([false, false, true, false]);
});
